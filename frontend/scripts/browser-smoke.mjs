// Requer API e Vite em execução. CHROMIUM_PATH permite reutilizar navegador local.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

async function checkContrast(page) {
  const ratios=await page.evaluate(()=>{
    const luminance=color=>{
      const rgb=color.match(/[\d.]+/g).slice(0,3).map(v=>{const c=Number(v)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    return [['aside label','aside'],['.intro>p:last-child','body'],['.camera-guidance','.camera-guidance'],['.fullscreen-panel strong','.fullscreen-panel'],['.placeholder p','.visual-field'],['.theme-toggle','.theme-toggle']].map(([text,back])=>{
      const a=luminance(getComputedStyle(document.querySelector(text)).color),b=luminance(getComputedStyle(document.querySelector(back)).backgroundColor);
      return {text,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
  });
  for(const item of ratios)assert.ok(item.ratio>=4.5,`${item.text}: contraste ${item.ratio}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport:{width:1280,height:1000},permissions:['camera']});
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await checkContrast(page);
  await page.getByRole('button',{name:'Tema escuro',exact:true}).click();
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await checkContrast(page);
  assert.equal(await page.locator('.visual-field').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');

  assert.equal(await page.getByRole('button',{name:'Iniciar prévia',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Ativar câmera',exact:true}).click();
  await page.getByRole('button',{name:'Desligar câmera',exact:true}).waitFor({timeout:60000});
  // A câmera sintética não contém rosto: detector real deve manter o bloqueio.
  await page.waitForTimeout(1500);
  assert.equal(await page.getByRole('button',{name:'Iniciar calibração',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox').uncheck();
  assert.equal(await page.locator('video').evaluate(v=>v.srcObject.getTracks().every(t=>t.readyState==='ended')),true);
  console.log('PASS: MediaPipe/WASM real, câmera sintética sem rosto e retirada de consentimento.');

  // Substitui APENAS o detector para testar a máquina de estados. Não mede precisão.
  await page.reload();
  await page.evaluate(slow=> {
    window.testFrameDelay=slow?150:0;
    window.FaceMesh=class {
      setOptions(){} onResults(callback){this.callback=callback} close(){}
      async send(){
        if(window.testFrameDelay)await new Promise(resolve=>setTimeout(resolve,window.testFrameDelay));
        const target=document.querySelector('.target');
        const x=target?parseFloat(target.style.left)/100:.5;
        const y=target?parseFloat(target.style.top)/100:.5;
        const points=Array.from({length:478},()=>({x:.5,y:.5}));
        for(const [a,b,u,l,i] of [[33,133,159,145,468],[362,263,386,374,473]]){
          points[a]={x:.2,y:.5};points[b]={x:.4,y:.5};
          points[u]={x:.3,y:.47};points[l]={x:.3,y:.53};
          if(window.testBlink) points[l]=points[u];
          points[i]={x:.2+.2*(.3+.2*x),y:.5+.02*(y-.5)};
        }
        this.callback({multiFaceLandmarks:[points]});
      }
    };
  },Boolean(process.env.HEATCITY_TEST_SLOW));
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Ativar câmera',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.fullscreen-panel button').disabled);
  await page.evaluate(()=>{window.testBlink=true;});
  await page.waitForTimeout(250);
  assert.equal(await page.getByRole('button',{name:'Iniciar calibração',exact:true}).isEnabled(),true);
  await page.evaluate(()=>{window.testBlink=false;});
  assert.equal(await page.getByLabel('Método de calibração').inputValue(),'fixed');
  if(!process.env.HEATCITY_TEST_FIXED)await page.getByLabel('Método de calibração').selectOption('motion');
  const calibrationStarted=Date.now();
  await page.getByRole('button',{name:'Iniciar calibração',exact:true}).click();
  await page.getByRole('timer').filter({hasText:'3'}).waitFor();
  assert.equal(await page.locator('.target').count(),0);
  await page.getByRole('timer').filter({hasText:'2'}).waitFor();
  await page.getByRole('timer').filter({hasText:'1'}).waitFor();
  await page.locator('.fullscreen-panel strong').filter({hasText:'Calibração aprovada.'}).waitFor({timeout:120000});
  assert.ok(Date.now()-calibrationStarted<(process.env.HEATCITY_TEST_SLOW?90000:process.env.HEATCITY_TEST_FIXED?45000:30000), 'Calibração deve concluir dentro do limite do cenário');
  assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
  assert.equal(await page.locator('.camera-preview video').isVisible(),true);
  assert.equal(await page.locator('.camera-guidance').isVisible(),true);
  assert.equal(await page.getByText(/Desloque levemente/).count(),0);
  await page.locator('.fullscreen-panel').getByRole('button',{name:'Iniciar prévia',exact:true}).click();
  await page.locator('.gaze').waitFor();
  const field=await page.locator('.visual-field').boundingBox();
  const viewport=page.viewportSize();
  assert.equal(field.width,viewport.width);
  assert.equal(field.height,viewport.height);
  assert.equal(await page.locator('.camera-preview').isVisible(),false);
  assert.equal(await page.locator('.fullscreen-panel').isVisible(),false);
  assert.equal(await page.locator('video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
  await page.evaluate(()=>{window.testBlink=true;});
  await page.waitForFunction(()=>!document.querySelector('.gaze'));
  assert.equal(await page.locator('.camera-preview.warning').count(),0);
  await page.evaluate(()=>{window.testBlink=false;});
  await page.locator('.gaze').waitFor();
  await page.screenshot({path:'/tmp/heatcity-white-layout.png'});
  await page.evaluate(()=>document.exitFullscreen());
  await page.getByRole('status').filter({hasText:'Tela cheia encerrada. Refaça a calibração para continuar.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Iniciar prévia',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox').uncheck();
  assert.deepEqual(errors,[]);
  console.log('PASS: trajetórias sintéticas em tela cheia, API real, piscada, recuperação e invalidação ao sair.');
} finally { await browser.close(); }
