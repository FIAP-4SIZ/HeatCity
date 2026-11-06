// Requer API e Vite em execução. CHROMIUM_PATH permite reutilizar navegador local.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

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
  await page.evaluate(()=> {
    window.FaceMesh=class {
      setOptions(){} onResults(callback){this.callback=callback} close(){}
      async send(){
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
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Ativar câmera',exact:true}).click();
  const calibrationStarted=Date.now();
  await page.getByRole('button',{name:'Iniciar calibração',exact:true}).click();
  await page.locator('.fullscreen-panel strong').filter({hasText:'Calibração aprovada.'}).waitFor({timeout:120000});
  assert.ok(Date.now()-calibrationStarted<30000, 'Calibração deve terminar em menos de 30 s');
  assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
  assert.equal(await page.locator('.camera-preview video').isVisible(),true);
  assert.equal(await page.locator('.camera-guidance').isVisible(),true);
  assert.equal(await page.getByText(/Desloque levemente/).count(),0);
  await page.locator('.fullscreen-panel').getByRole('button',{name:'Iniciar prévia',exact:true}).click();
  await page.locator('.gaze').waitFor();
  await page.evaluate(()=>{window.testBlink=true;});
  await page.waitForFunction(()=>!document.querySelector('.gaze'));
  await page.locator('.camera-guidance').filter({hasText:'Piscada'}).waitFor();
  await page.evaluate(()=>{window.testBlink=false;});
  await page.locator('.gaze').waitFor();
  await page.evaluate(()=>document.exitFullscreen());
  await page.getByRole('status').filter({hasText:'Tela cheia encerrada. Refaça a calibração para continuar.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Iniciar prévia',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox').uncheck();
  assert.deepEqual(errors,[]);
  console.log('PASS: trajetórias sintéticas em tela cheia, API real, piscada, recuperação e invalidação ao sair.');
} finally { await browser.close(); }
