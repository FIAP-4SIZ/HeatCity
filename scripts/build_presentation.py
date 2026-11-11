"""Slides offline com estatísticas agregadas do diagnóstico; nunca publica features oculares."""

import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("diagnostic")
args = parser.parse_args()
data = json.loads(Path(args.diagnostic).read_text(encoding="utf-8"))
complete = [
    c
    for c in data.get("page_diagnostic", {}).get("calibrations", [])
    if c.get("quality", {}).get("basis") == "mesh"
]
rows = []
for i, c in enumerate(complete):
    q = c["quality"]
    total = sum(r["count"] for r in q["target_errors"])
    rows.append(
        {
            "attempt": i + 1,
            "rmse": round(q["validation_rmse"], 3),
            "median": round(q["validation_median_rmse"], 3),
            "unsupported": q["unsupported_validation_samples"],
            "total": total,
            "approved": bool(q["approved"]),
        }
    )
summary = {
    "completed_attempts": len(complete),
    "attempts": len(data["page_diagnostic"]["calibrations"]),
    "rows": rows,
    "source": "heatcity-diagnostico-completo.json enviado em 11/11/2026",
    "note": "Tentativas, não participantes distintos. RMSE calculado apenas nos quadros com previsão.",
}
root = Path(__file__).resolve().parents[1] / "docs/apresentacao"
(root / "evidencias-agregadas.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
body = "".join(
    f"<tr><td>{i + 1}</td><td>{r['rmse']:.3f}</td><td>{r['unsupported']} / {r['total']}</td><td>Reprovada</td></tr>"
    for i, r in enumerate(rows)
)
slides = [
    (
        "HEATCITY",
        "Visão computacional aplicada à sinalização",
        '<p class="lead">MVP exploratório: da imagem e das áreas de interesse às estimativas de olhar e aos registros reproduzíveis.</p><div class="badge">DEMONSTRAÇÃO TÉCNICA · PRECISÃO OCULAR NÃO VALIDADA</div><p class="muted">Cognitive Computing · Global Solution · FIAP · 2026</p>',
    ),
    (
        "01 · PROBLEMA",
        "Como investigar uma cena de sinalização?",
        '<div class="cols"><div><h3>Entrada</h3><p>Imagem do ambiente e regiões das placas, delimitadas antes da sessão.</p><h3>Questão</h3><p>Como descrever a cena e registrar estimativas oculares com limites explícitos?</p></div><div><h3>Saída do MVP</h3><p>Indicadores da imagem, coordenadas estimadas, cobertura, mapa de densidade e relatório.</p><div class="note">Um mapa de estimativas não comprova leitura, compreensão ou atenção.</div></div></div>',
    ),
    (
        "02 · IMPLEMENTAÇÃO",
        "Uma cadeia que pode ser demonstrada",
        '<div class="pipeline"><span>Cena + AOIs</span><b>→</b><span>PDI</span><b>→</b><span>Webcam / MediaPipe</span><b>→</b><span>Geometria</span><b>→</b><span>Estimativas + exportações</span></div><div class="cols"><div><h3>PDI</h3><p>Luminância, contraste local por percentis, nitidez pelo Laplaciano e densidade espacial por suavização gaussiana.</p></div><div><h3>Execução local</h3><p>FastAPI + SQLite · React + Vite · Windows/Chrome/Edge. Frames faciais não são enviados nem salvos.</p></div></div><p class="muted">MediaPipe pronto para detectar olhos; sem criar regressão, classificador ou novo modelo de aprendizado.</p>',
    ),
    (
        "03 · EVIDÊNCIA REAL",
        "A precisão ainda limita a interpretação",
        f'<table><thead><tr><th>Tentativa concluída</th><th>RMSE com previsão</th><th>Quadros sem previsão</th><th>Critério oficial</th></tr></thead><tbody>{body}</tbody></table><p>O arquivo contém quatro tentativas: duas concluídas reprovadas, uma interrupção geométrica e uma falha de comunicação.</p><div class="note">O menor RMSE não é suficiente: a cobertura espacial também falhou. Não foram obtidos resultados oficiais de localização com essas tentativas.</div><p class="muted">Fonte: diagnóstico enviado em 11/11/2026. Tentativas não equivalem a participantes distintos; protocolos anteriores não são diretamente comparáveis.</p>',
    ),
    (
        "04 · DECISÃO DE ESCOPO",
        "Dois caminhos com resultados separados",
        '<table><thead><tr><th></th><th>Estudo oficial</th><th>Ensaio exploratório</th></tr></thead><tbody><tr><td>Entrada</td><td>Calibração aprovada e vinculada</td><td>Malha concluída; pode ser reprovada/importada</td></tr><tr><td>Resultado</td><td>Critérios de margem, cobertura e duração</td><td>Estimativas, cobertura e mapa descritivo</td></tr><tr><td>Taxas e tempos</td><td>Somente sessões elegíveis</td><td>Não calculados nem incluídos</td></tr></tbody></table><div class="badge">EXPLORATÓRIO NÃO É UMA CALIBRAÇÃO APROVADA</div>',
    ),
    (
        "05 · DEMONSTRAÇÃO",
        "Um ensaio curto, sem repetir a calibração",
        '<ol><li>Abrir um estudo e seu cenário com áreas de interesse.</li><li>Entrar em <strong>Ensaio exploratório</strong>; informar apenas código e consentimento.</li><li>Importar o diagnóstico com a malha já concluída.</li><li>Gravar 15 segundos de estimativas oculares.</li><li>Mostrar mapa, qualidade de captura, JSON e PDF; indicadores oficiais permanecem vazios.</li></ol><p class="muted">Geometria importada não é reconferida na postura atual. Se não houver estimativas válidas, apresentar a falha como resultado do ensaio.</p>',
    ),
    (
        "06 · LIMITES",
        "O que o MVP demonstra — e o que falta medir",
        '<div class="cols"><div><h3>Demonstrado no software</h3><ul><li>Gerenciamento de cena e AOIs</li><li>PDI e persistência local</li><li>Captura, diagnóstico e exportação</li><li>Separação de resultados não validados</li></ul></div><div><h3>Ainda necessário</h3><ul><li>Precisão com pessoas e câmeras diversas</li><li>Estabilidade com postura e iluminação</li><li>Cobertura confiável de cantos e bordas</li><li>Repetibilidade em tarefas conhecidas</li></ul></div></div><div class="note">Testes sintéticos verificam funcionamento do sistema; não comprovam precisão humana.</div>',
    ),
    (
        "07 · CONCLUSÃO",
        "Um MVP inicial, com limites rastreáveis",
        '<p class="lead">A entrega integra processamento de imagem, captura ocular experimental e documentação reproduzível.</p><p>A limitação de precisão foi medida e passou a orientar o escopo: demonstração exploratória agora, conclusões sobre sinalização somente após dados adequados.</p><div class="badge">CÓDIGO · DIAGNÓSTICOS · MAPAS · RELATÓRIO · LIMITAÇÕES</div><p class="muted">Referências: enunciado Cognitive Computing-GS2-2026; MediaPipe Tasks Vision; código e documentação do HeatCity. Evidência numérica: diagnóstico do usuário, sem publicar vetores oculares.</p>',
    ),
]
html = """<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HeatCity · apresentação</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f1;color:#163b30;font:24px/1.4 'Segoe UI',Arial,sans-serif}.slide{display:none;width:100vw;height:100vh;padding:42px 58px;overflow:hidden}.slide.active{display:block}.eyebrow{font-size:16px;letter-spacing:2px;font-weight:700;color:#5b675b}h1{font-size:46px;line-height:1.12;margin:18px 0 28px;max-width:1100px}h3{font-size:25px;margin:14px 0}p{margin:14px 0}.lead{font-size:32px;max-width:1000px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:42px}.badge,.note{padding:16px 20px;border-radius:10px;margin:22px 0}.badge{background:#173e30;color:white;font-size:22px;font-weight:650}.note{background:#f4e6c6;color:#4f3609;font-size:22px}.muted{font-size:17px;color:#526456}.pipeline{display:flex;align-items:center;gap:8px;margin:30px 0}.pipeline span{padding:14px;background:#dfebe2;border-radius:8px;font-size:19px;flex:1}table{width:100%;border-collapse:collapse;font-size:22px}th,td{text-align:left;padding:14px;border-bottom:1px solid #9daf9f}th{background:#dfeae1}li{margin:12px 0}footer{position:fixed;bottom:12px;left:58px;font-size:15px;color:#526456}nav{position:fixed;bottom:12px;right:24px}button{padding:10px 14px;background:#173e30;color:white;border:0;border-radius:6px;margin-left:6px;font-size:16px} @media(max-width:900px){body{font-size:18px}h1{font-size:32px}.slide{padding:28px}.lead{font-size:24px}.cols{gap:20px}table{font-size:17px}} @page{size:13.333in 7.5in;margin:0}@media print{nav,footer{display:none}.slide{display:block!important;width:13.333in;height:7.5in;break-after:page;min-height:0}.slide:last-of-type{break-after:auto}}
</style><main>"""
for eyebrow, title, content in slides:
    html += f'<section class="slide"><div class="eyebrow">{eyebrow}</div><h1>{title}</h1>{content}</section>'
html += """</main><footer>HeatCity · MVP exploratório <span id="number"></span></footer><nav><button onclick="go(-1)">← Anterior</button><button onclick="go(1)">Próximo →</button><button onclick="document.documentElement.requestFullscreen()">Tela cheia</button></nav><script>let index=0;const slides=[...document.querySelectorAll('.slide')];function show(){slides.forEach((s,i)=>s.classList.toggle('active',i===index));document.querySelector('#number').textContent=`· ${index+1}/${slides.length}`;}function go(step){index=Math.max(0,Math.min(slides.length-1,index+step));show();}document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();go(1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(-1)}});show();</script></html>"""
(root / "slides.html").write_text(html, encoding="utf-8")
print(
    "Apresentação offline e evidências agregadas geradas; nenhum vetor ocular incluído."
)
