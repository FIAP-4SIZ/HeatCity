"""Gera apresentação e pacote reproduzível a partir das medições versionadas."""

import html
import json
import zipfile
from pathlib import Path

import cv2
import numpy as np
from presentation_pptx import build_presentation

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/apresentacao"
REPORTS = ROOT / "docs/reports"
SOURCES = [
    (
        "OpenCV — Template Matching",
        "https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html",
    ),
    (
        "OpenCV — Laplacian Operator",
        "https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html",
    ),
    (
        "Aula — Template matching",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html",
    ),
    (
        "Aula — Histograma e equalização",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab03/atividade3.html",
    ),
    (
        "Aula — Crop e ROI",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab02/atividade2.html",
    ),
    (
        "Aula — Filtros de convolução",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab04/Filtros_de_Convolu%C3%A7%C3%A3o.html",
    ),
    ("ONU — ODS 3", "https://sdgs.un.org/goals/goal3"),
    ("ONU — ODS 11", "https://sdgs.un.org/goals/goal11"),
]


def main():
    data = json.loads(
        (REPORTS / "deteccao-placas-benchmark.json").read_text(encoding="utf-8")
    )
    s = data["summary"]
    metric = lambda v: "indisponível" if v is None else f"{v:.3f}".replace(".", ",")
    percent = lambda v: "indisponível" if v is None else f"{v:.1%}".replace(".", ",")
    condition_names = {
        "referencia_nitida": "Imagem nítida",
        "deslocamento": "Deslocamento",
        "desfoque": "Desfoque",
        "recepcao_ausente": "Recepção ausente",
    }
    condition_rows = []
    for condition in dict.fromkeys(f["condition"] for f in data["frames"]):
        frames = [f for f in data["frames"] if f["condition"] == condition]
        tp = sum(f["metrics"]["tp"] for f in frames)
        fn = sum(f["metrics"]["fn"] for f in frames)
        condition_rows.append(
            (condition_names[condition], tp, fn, tp / (tp + fn) if tp + fn else 0)
        )
    graph = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 270" role="img" aria-label="Recall por condição do vídeo sintético">',
        '<rect width="900" height="270" fill="#f5f7f3"/>',
    ]
    for i, (name, tp, fn, recall) in enumerate(condition_rows):
        y = 35 + i * 55
        graph += [
            f'<text x="15" y="{y + 18}" font-family="sans-serif" font-size="17" fill="#173b31">{html.escape(name)}</text>',
            f'<rect x="270" y="{y}" width="{recall * 420}" height="28" fill="#28775c"/>',
            f'<text x="{285 + recall * 420}" y="{y + 20}" font-family="sans-serif" font-size="17">{percent(recall)} · TP {tp} / FN {fn}</text>',
        ]
    graph.append("</svg>")
    (OUT / "deteccao-resultados.svg").write_text("".join(graph), encoding="utf-8")
    capture = cv2.VideoCapture(str(ROOT / "frontend/public/detection-demo.mp4"))
    ok, picture = capture.read()
    capture.release()
    if ok:
        for sign in data["frames"][0]["signs"]:
            if not sign["box"]:
                continue
            x, y, w, h = sign["box"]
            height, width = picture.shape[:2]
            cv2.rectangle(
                picture,
                (int(x * width), int(y * height)),
                (int((x + w) * width), int((y + h) * height)),
                (50, 240, 130),
                2,
            )
        cv2.imwrite(str(OUT / "deteccao-quadro.jpg"), picture)
    original = cv2.imread(str(ROOT / "backend/heatcity/fixtures/hospital.jpg"))
    fixture = json.loads(
        (ROOT / "backend/heatcity/fixtures/hospital-reference.json").read_text(
            encoding="utf-8"
        )
    )
    plate = fixture["reference"]["plates"][0]
    ih, iw = original.shape[:2]
    crop = original[
        int(plate["y"] * ih) : int((plate["y"] + plate["height"]) * ih),
        int(plate["x"] * iw) : int((plate["x"] + plate["width"]) * iw),
    ]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    magnitude = np.abs(lap)
    display = (magnitude / max(1, magnitude.max()) * 255).astype(np.uint8)
    chart = np.full((210, 900, 3), (243, 247, 245), np.uint8)
    for i, (label, patch) in enumerate(
        [
            ("Original", crop),
            ("Cinza", cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)),
            ("|Laplaciano|", cv2.cvtColor(display, cv2.COLOR_GRAY2BGR)),
        ]
    ):
        x = 15 + i * 220
        chart[45:125, x : x + 205] = cv2.resize(patch, (205, 80))
        cv2.putText(
            chart, label, (x, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (49, 59, 23), 1
        )
    hist = np.bincount(gray.ravel(), minlength=256)
    pts = np.array(
        [
            [690 + i * 190 / 255, 125 - float(v) / max(hist.max(), 1) * 85]
            for i, v in enumerate(hist)
        ],
        np.int32,
    )
    cv2.polylines(chart, [pts], False, (65, 105, 35), 1)
    cv2.putText(
        chart, "Histograma", (690, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (49, 59, 23), 1
    )
    cv2.putText(
        chart,
        "0",
        (690, 150),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.35,
        (49, 59, 23),
        1,
    )
    cv2.putText(
        chart, "255", (860, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (49, 59, 23), 1
    )
    cv2.putText(
        chart,
        f"Recepcao: media cinza {gray.mean():.1f}; variancia Laplaciano {lap.var():.1f}",
        (15, 180),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (49, 59, 23),
        1,
    )
    cv2.imwrite(str(OUT / "deteccao-pdi.png"), chart)
    details = s["details"]
    plate_lines = [
        f"{d['name']}: {s['counts'][d['name']]['detected']}/{s['frames']} quadros; {str(d['detected_seconds']).replace('.', ',')} s estimados; recall {percent(d['recall'])}."
        for d in details
    ]
    slides = [
        (
            "HeatCity — placas em vídeo",
            [
                "Onde a placa cadastrada aparece e por quanto tempo é detectada?",
                "Foto com placas cadastradas + vídeo ou webcam → posição, tempo estimado e relatório por placa.",
                "MVP de PDI e visão computacional · CitizenTech · FIAP. Exemplo sintético reproduzido pelo usuário.",
            ],
        ),
        (
            "Problema: encontrar a Recepção",
            [
                "Um visitante chega ao hospital e precisa encontrar a Recepção antes de escolher o corredor. Uma placa pouco visível pode exigir retorno ou pedido de ajuda.",
                "CitizenTech: apoiar equipes que revisam a sinalização para pacientes, acompanhantes e visitantes. O caso é ilustrativo; falta escuta e teste em campo.",
                "Contribuição pretendida: ODS 3.8, acesso a serviços de saúde; ODS 11.7, espaços coletivos acessíveis. Benefício humano ainda não medido.",
            ],
        ),
        (
            "Escopo: referências conhecidas",
            [
                "Entrada: vídeo de arquivo ou webcam. Saída: posição da placa, estado da detecção e tempo estimado por identidade.",
                "Uso proposto: cidadãos relatam barreiras; a equipe registra o percurso; manutenção testa mudanças e verifica o benefício com os usuários.",
                "Placas são cadastradas por imagem e recorte. Não há OCR, detecção de placas desconhecidas nem treinamento de um modelo.",
                "As anotações servem para medir acerto, após a detecção; não ensinam nem corrigem as respostas do algoritmo.",
            ],
        ),
        (
            "PDI e visão computacional",
            [
                "Quadros até 800 px de largura → tons de cinza → busca dos recortes em 7 escalas por TM_CCOEFF_NORMED.",
                "Aceitação: similaridade ≥ 0,72; margem espacial ≥ 0,06; margem entre identidades em conflito ≥ 0,08. Regras fixas, sem treino.",
                "PDI visual: recorte original, cinza, Laplaciano e histograma. Contraste, nitidez e tamanho são indícios; não comprovam legibilidade.",
            ],
            "deteccao-pdi.png",
        ),
        (
            "Cenário, recortes e posição",
            [
                "Uma foto de referência, quatro ROIs: Recepção, Pronto Socorro, Ambulatório e Triagem. Cada recorte é um template.",
                "Na imagem abaixo, os retângulos são localizações calculadas pelo detector no primeiro quadro do vídeo.",
                "A foto foi gerada por IA; o vídeo aplica transformações controladas. As caixas são normalizadas entre 0 e 1.",
            ],
            "deteccao-quadro.jpg",
        ),
        (
            "Por quanto tempo foi detectada?",
            [
                "Somar Δt apenas quando a mesma placa é detectada em dois quadros consecutivos da mesma fonte, com 0 < Δt ≤ 1,5 s.",
                "Falha, ambiguidade ou intervalo maior interrompe o trecho. Um quadro isolado representa 0 s.",
                "Recepção: 5,5 s; demais placas: 8 s. São intervalos amostrados, não duração física exata de visibilidade ou tempo de leitura.",
                "Exemplo: 24 quadros fixos reprocessados na API. Vídeo próprio/webcam: até 2 amostras/s, podendo perder detalhes entre capturas.",
            ],
        ),
        (
            "Resultado conferido do exemplo",
            [
                "MP4 de 12 s / 12 FPS construído com imagem de IA: nitidez, deslocamento, desfoque e remoção da Recepção.",
                f"24 quadros decodificados; {s['annotations']} anotações geométricas conhecidas. TP {s['tp']}, FP {s['fp']}, FN {s['fn']}, TN {s['tn']}.",
                f"Precisão = {s['tp']}/({s['tp']}+{s['fp']}) = {percent(s['precision'])}; recall = {s['tp']}/({s['tp']}+{s['fn']}) = {percent(s['recall'])}.",
                "O relatório enviado pelo usuário reproduziu contagens e tempos esperados. Isso confirma o exemplo controlado; não comprova desempenho em campo.",
            ],
        ),
        (
            "Onde o detector acertou e falhou",
            [
                f"{name}: TP {tp}, FN {fn}, recall {percent(recall)}."
                for name, tp, fn, recall in condition_rows
            ]
            + [
                "No último trecho, 6 ausências da Recepção foram reconhecidas corretamente. As 24 perdas do desfoque continuam contabilizadas."
            ],
            "deteccao-resultados.svg",
        ),
        (
            "Análise final por placa",
            plate_lines
            + [
                "Precisão por placa: 100% entre detecções anotadas. Acerto exige nome correto e IoU ≥ 0,5; IoU é a sobreposição entre caixas.",
                f"IoU médio dos positivos anotados no benchmark: {metric(s['mean_iou'])}. Não significa {percent(s['mean_iou'])} de probabilidade de acerto.",
            ],
        ),
        (
            "Dúvidas e sugestões de local",
            [
                "Neste exemplo: 0 correspondências ambíguas; as perdas coincidem com o desfoque aplicado. Não houve confusão entre identidades nas detecções aceitas.",
                "Em vídeo real, baixa correlação pode ter várias causas. Contraste, nitidez e borda só fundamentam alertas geométricos em detecções confirmadas.",
                "Testar placa frontal ao percurso, antes da bifurcação, sem obstruções e com tamanho aparente suficiente. São hipóteses de melhoria.",
                "Comparar antes/depois com trajeto, distância e iluminação equivalentes; anotar as caixas e medir acerto. Não há local ideal comprovado.",
            ],
        ),
        (
            "Demonstração e próxima evidência",
            [
                "1. Iniciar-HeatCity.cmd → Ver exemplo funcionando.",
                "2. Aguardar 24/24 quadros e o relatório. Mostrar 100% de precisão, 73,3% de recall e as ausências separadas das falhas.",
                "3. Para outro ambiente: Começar com meu vídeo → cadastrar foto e placas → selecionar vídeo e analisar.",
                "4. Baixar PDF, JSON e CSV. Próxima evidência: vídeo real anotado; depois, verificar com pessoas se a sinalização ajuda.",
                "MVP funcional no ensaio controlado; perspectiva, desfoque e generalização para outros ambientes permanecem limites.",
            ],
        ),
        (
            "Fontes e referências",
            [
                "Documentação OpenCV, laboratórios de PDI e objetivos de desenvolvimento sustentável da ONU."
            ],
        ),
    ]
    talks = [
        "O HeatCity procura placas previamente cadastradas em vídeo ou webcam. Ele mostra onde aparecem, por quanto tempo são detectadas e quais dificuldades merecem investigação.",
        "Imagine chegar a um hospital e não encontrar a Recepção antes de escolher o corredor. Queremos apoiar a revisão dessa sinalização. A relação com CitizenTech é a orientação do cidadão; o benefício ainda precisa ser testado.",
        "Cadastramos uma foto e delimitamos cada placa. O programa procura essas referências, sem reconhecer texto ou treinar um modelo. As anotações de posição são usadas depois, apenas para conferir o acerto.",
        "Aqui vemos o processamento digital de imagens: recorte, cinza, Laplaciano e histograma. A busca compara cada recorte em sete tamanhos. Similaridade e margens mínimas evitam aceitar qualquer região parecida.",
        "São quatro placas da mesma foto. Os retângulos mostram as posições encontradas no primeiro quadro. A imagem foi gerada por IA e o vídeo é sintético; não é uma gravação de um hospital real.",
        "O tempo acumula apenas entre detecções consecutivas. Uma falha interrompe a contagem. Recepção teve 5,5 segundos e as demais, 8 segundos. É uma estimativa amostrada, não tempo de leitura.",
        f"O relatório reproduziu o esperado: {s['tp']} acertos, {s['fp']} falsos positivos, {s['fn']} perdas e {s['tn']} ausências corretas. Precisão foi {percent(s['precision'])}, mas recall foi {percent(s['recall'])}: o sistema deixou passar placas presentes.",
        "O gráfico separa os quatro trechos. Nitidez e deslocamento tiveram todas as placas recuperadas. O desfoque provocou as 24 perdas. No final, não encontrar a Recepção removida foi a resposta correta.",
        "Recepção apareceu em 12 dos 24 quadros; as outras, em 18. Isso inclui seis ausências reais da Recepção. Acerto exige identidade correta e sobreposição suficiente entre a caixa encontrada e a anotada.",
        "O desfoque é conhecido porque o aplicamos no vídeo. Em uma captura real, similaridade baixa não revela sozinha a causa. Posição frontal, tamanho e iluminação são melhorias a testar, não conclusões comprovadas.",
        "Vou abrir o exemplo, aguardar o relatório e mostrar as exportações. Para outro ambiente, cadastramos uma foto e usamos um vídeo das mesmas placas. A próxima evidência é testar uma captura real anotada.",
        "Usamos OpenCV e conteúdos das aulas de PDI e template matching. Código, fontes, vídeo e notebook estão no material. O exemplo funciona de forma reproduzível; ainda faltam avaliação em campo e benefício demonstrado aos cidadãos.",
    ]
    assert len(talks) == len(slides)
    explanation = """EXPLICAÇÃO DO PROGRAMA E DOS TERMOS

O QUE O HEATCITY FAZ

O programa procura placas conhecidas em um vídeo ou na webcam.
Por exemplo: procura a placa Recepção e registra onde ela aparece.
No final, mostra as detecções, as falhas e o tempo estimado de detecção.

COMO FUNCIONA, PASSO A PASSO

1. Mostramos ao programa qual placa procurar.
Cadastramos uma foto e desenhamos um retângulo em volta da placa.
Esse retângulo é uma ROI (região de interesse).
O recorte da placa é o template (imagem usada como referência na busca).
Não há treinamento de um modelo: o recorte é comparado diretamente com o vídeo.

2. O programa examina imagens do vídeo.
Cada imagem é um frame (quadro do vídeo).
O programa reduz seu tamanho e transforma as cores em tons de cinza.
Isso faz parte do PDI (processamento digital de imagens).
Usamos OpenCV (biblioteca que fornece funções para trabalhar com imagens).

3. O programa procura regiões parecidas com o recorte.
Essa técnica se chama template matching (busca por semelhança com uma imagem de referência).
A busca usa sete tamanhos do recorte. Isso é multiescala (comparação em tamanhos diferentes).
Essa é uma adaptação do HeatCity à busca por template. Ela permite procurar a placa maior ou menor que na referência, dentro dos tamanhos pesquisados.

4. O programa decide se encontrou a placa.
Cada região recebe um score (valor de correspondência).
Usamos o método TM_CCOEFF_NORMED do OpenCV: correlação normalizada (comparação dos padrões de claro e escuro, descontando a média de intensidade).
O resultado precisa passar por limiares (limites mínimos de aceitação).
Também verificamos a margem (diferença entre a melhor opção e outra opção parecida).
Esse é um critério adicional do HeatCity para evitar confirmações duvidosas.
Se houver dúvida, o programa pode deixar de confirmar a detecção.
Importante: score de 0,8 não significa 80% de chance de acerto.

5. O programa registra posição e tempo.
Uma bounding box (retângulo de localização) marca a placa encontrada.
O acompanhamento temporal (registro da mesma placa ao longo dos quadros) permite estimar o tempo detectado.
Aqui repetimos a detecção e reunimos os resultados pelo nome da placa. Não calculamos seu movimento nem prevemos sua posição entre quadros.
Somamos o intervalo entre duas detecções consecutivas, se ele for de até 1,5 segundo.
Uma falha interrompe a contagem. Um quadro isolado soma zero segundo.
Esse tempo não informa quanto tempo uma pessoa leu ou olhou para a placa.

COMO SABEMOS SE ACERTOU?

Precisamos de ground truth (resposta conhecida usada para conferir o resultado).
No exemplo sintético, sabemos onde cada placa deveria estar e quando foi removida.
Essa informação serve para conferir a resposta; não corrige a busca do programa.

A IoU (medida de sobreposição entre dois retângulos) compara a posição encontrada com a posição conhecida.
Ela vale 1 quando os retângulos coincidem e 0 quando não se sobrepõem.
Para contar um acerto, exigimos a placa correta, detecção aceita e IoU de pelo menos 0,5.

As contagens são:
- TP (acerto): encontrou a placa correta no lugar correto.
- FP (falso positivo): confirmou uma detecção incorreta.
- FN (perda): a placa estava presente, mas não foi localizada corretamente.
- TN (ausência correta): a placa não estava presente e não foi detectada.
Uma posição errada aceita pode contar como FP e FN ao mesmo tempo.

Precisão (proporção de acertos entre as detecções confirmadas):
No exemplo, as 66 detecções confirmadas estavam corretas. Por isso, a precisão foi 100%.

Recall (proporção de placas presentes que foram recuperadas):
Havia 90 presenças de placas nos quadros. O programa recuperou 66 e perdeu 24.
Por isso, o recall foi 73,3%. As seis ausências corretas ficam fora dessa conta.
Sem respostas conhecidas para comparação, não podemos medir essas taxas.

O QUE MOSTRAM AS IMAGENS DE PDI?

- Histograma (gráfico da quantidade de pixels claros e escuros): mostra como a iluminação está distribuída na imagem.
- Contraste da região da placa (diferença entre intensidades claras e escuras): ajuda a descrever a separação visual dos detalhes.
- Laplaciano (filtro que destaca mudanças de intensidade): evidencia contornos e detalhes.
- Convolução (cálculo que aplica uma pequena máscara sobre pixels vizinhos): é a base desse tipo de filtro.
- Variância do Laplaciano (quanto a resposta desse filtro varia): medida adicional do HeatCity para indicar perda de detalhes em comparação com a referência.
Essas medidas fornecem indícios. Sozinhas, não provam que uma pessoa consegue ler a placa.

O QUE O EXEMPLO COMPROVA?

O vídeo sintético tem quatro placas em 24 quadros analisados: são 96 anotações de presença ou ausência.
O programa refaz a busca no arquivo de vídeo; não copia respostas prontas.
O resultado confirma o funcionamento nesse exemplo controlado.
Ainda precisamos testar vídeos reais e verificar com pessoas se as mudanças na sinalização ajudam.
As sugestões de posição são possibilidades para testar, não garantias de um local ideal.
"""
    guide = "# HeatCity — roteiro de apresentação\n\n"
    guide += "Abra `slides.pptx` no PowerPoint e preencha os quatro campos de nome completo e RM (seis dígitos) da capa. Apresentação de aproximadamente 5–7 minutos, incluindo demonstração.\n\n"
    guide += "\n\n".join(
        f"## Slide {i} — {slide[0]}\n\n{talk}"
        for i, (slide, talk) in enumerate(zip(slides, talks), 1)
    )
    guide += "\n\n## Plano B\n\nSe a demonstração não abrir, mostrar o PPTX e o relatório técnico incluído no pacote. Informar que são resultados do exemplo sintético.\n\n"
    guide += (
        "## Explicação do programa e dos termos\n\n"
        + explanation.split("\n", 1)[1].strip()
        + "\n"
    )
    guide += "\n## Reprodução dos slides\n\nInstale as dependências do backend e `scripts/requirements-presentation.txt`. Na raiz, execute `.venv/bin/python scripts/build_sign_presentation.py`; no Windows, use `.venv\\Scripts\\python.exe`. Para regenerar o vídeo, use `scripts/build_sign_video_demo.py`, com PYTHONPATH=backend e ffmpeg disponível. O MP4 já está incluído.\n"
    (OUT / "ROTEIRO.md").write_text(guide, encoding="utf-8")
    build_presentation(OUT, slides, talks, s, condition_rows, SOURCES)
    package = ROOT / "docs/HeatCity-pacote-apresentacao.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as z:
        paths = [
            ROOT / "docs/ENTREGA-PROFESSOR.md",
            ROOT / "README.md",
            ROOT / "backend/heatcity/services/sign_detection.py",
            OUT / "slides.pptx",
            OUT / "ROTEIRO.md",
            OUT / "Abrir-apresentacao.cmd",
            OUT / "deteccao-quadro.jpg",
            OUT / "deteccao-pdi.png",
            OUT / "referencias.md",
            OUT / "deteccao-resultados.svg",
            REPORTS / "deteccao-placas-benchmark.json",
            REPORTS / "HeatCity-deteccao-placas-exemplo.pdf",
            ROOT / "frontend/public/detection-demo.mp4",
            ROOT / "frontend/public/detection-demo.json",
            Path(__file__).resolve(),
            ROOT / "scripts/presentation_pptx.py",
            ROOT / "scripts/requirements-presentation.txt",
            ROOT / "scripts/build_sign_video_demo.py",
            ROOT / "notebooks/analise-deteccao-placas.ipynb",
            ROOT / "notebooks/requirements.txt",
            ROOT / "scripts/build_analysis_notebook.py",
            ROOT / "docs/verificacao-requisitos.md",
            ROOT / "docs/verificacao-exemplo-sintetico.md",
        ]
        for path in paths:
            z.write(path, path.relative_to(ROOT))
    print(
        f"{len(slides)} slides; números medidos, gráfico, roteiro e pacote atualizados."
    )


if __name__ == "__main__":
    main()
