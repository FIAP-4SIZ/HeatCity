"""Relatório PDF reproduzível com dados reais persistidos e limitações explícitas."""

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .vision import decode_scene, heatmap


def build_report(data):
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    story = []

    def paragraph(text, style="BodyText"):
        story.append(Paragraph(escape(str(text)), styles[style]))
        story.append(Spacer(1, 8))

    study = data["study"]
    summary = data["summary"]
    paragraph("HeatCity · Relatório técnico", "Title")
    paragraph(study["title"], "Heading1")
    paragraph(study["objective"])
    paragraph("1. Contexto e problema", "Heading2")
    paragraph(
        "Avaliar a localização de sinalizações em cenas de espaços públicos. O estudo usa exclusivamente estimativas experimentais de olhar. Elas não comprovam leitura, compreensão ou acessibilidade."
    )
    paragraph(
        "Exemplo ilustrativo: ao entrar pela primeira vez em um hospital, um visitante procura a recepção; a placa fica acima de uma porta lateral, fora do percurso inicial de busca em direção ao corredor. Ele pode precisar parar e pedir orientação. Não é um episódio observado pelo projeto: não houve coleta em hospital ou medição de impacto no atendimento. A hipótese seria comparar, em imagens equivalentes, a placa original e uma alternativa no ponto de decisão, mantendo texto, tamanho e tarefa e alternando a ordem entre participantes. Não há conclusão A/B disponível."
    )
    paragraph(
        "A contribuição proposta à Global Solution é aplicar PDI e visão computacional à experiência de orientação em espaços de uso coletivo. Equipes de sinalização poderiam investigar alternativas de organização antes de intervir. Esse alinhamento com inclusão urbana e ODS 11 é uma motivação, não impacto medido, certificação de acessibilidade ou comprovação de legibilidade. O endereço institucional da Global Solution foi indicado pelo usuário; o conteúdo atual da página não pôde ser confirmado neste ambiente."
    )
    paragraph("2. Métodos e qualidade", "Heading2")
    paragraph(
        "Cenas e áreas de interesse são normalizadas em [0,1]. OpenCV calcula luminância, contraste local (percentis 1 e 99), nitidez pela variância do Laplaciano e mapas de densidade espacial. São indicadores descritivos, sem certificação de acessibilidade ou OCR."
    )
    paragraph(
        "A câmera é processada localmente pelo detector pronto MediaPipe. O alvo móvel percorre linhas, bordas, cantos, diagonais e centro. Amostras válidas em movimento próximas das referências podem antecipar a coleta. A geometria é conferida a cada linha, com reparos locais limitados e preservação de dados parciais quando falha. Vinte e cinco referências oculares registradas automaticamente após coleta estável formam uma malha de triângulos, interpolada geometricamente, sem regressão, classificação, treinamento ou seleção de modelo. Treze alvos posteriores, incluindo bordas e cantos, conferem o erro por quadro e por região; na política atual os quatro cantos externos não têm limite individual, mas continuam no erro global; demais alvos exigem 0,100 e dados fora da malha reprovam a cobertura, sem extrapolação. RMSE <= 0.100, compatibilidade com o tamanho da placa, ao menos 30 amostras válidas e cobertura temporal >= 60% são critérios heurísticos declarados; não comprovam precisão humana."
    )
    paragraph(
        "Taxa de sucesso = participantes que localizaram o alvo / participantes elegíveis da mesma tarefa, cenário e modo. Tempo até localizar é resumido somente entre sucessos; falhas permanecem no denominador da taxa. Para repetições, seleciona-se a última sessão concluída elegível por participante/grupo. Sessões abortadas e rastreamento insuficiente são excluídos. Nas sessões novas, a margem empírica por eixo usa o maior P90 absoluto observado entre os alvos e é convertida da tela para o tamanho real da imagem exibida. A área de erro deve caber inteiramente na placa e permanecer por pelo menos 0,2 s para confirmar observação. Permanência apenas na faixa ambígua torna o resultado inconclusivo e excluído das taxas; ausências conclusivas continuam no denominador. Uma aquisição com menos de 60% dos intervalos adjacentes válidos dentro de 0,2 s também é inconclusiva, em vez de contar como ausência. Sessões históricas preservam seu método anterior. A margem é heurística, não um intervalo de confiança nem garantia de conter o olhar real."
    )
    paragraph("Ensaios exploratórios", "Heading2")
    paragraph(
        "Ensaios com mode=exploratory são demonstrações técnicas não validadas, inclusive com calibração reprovada ou importada de outra postura. São excluídos das taxas, tempos e atenção oficiais. Seus mapas representam densidade de estimativas, sem comprovar onde a pessoa olhou."
    )
    evidence = data.get("calibration_analysis")
    if evidence:
        story.append(PageBreak())
        paragraph("3. Experimentos reais de calibração", "Heading1")
        paragraph(evidence["source_label"])
        paragraph("Proveniência SHA-256: " + evidence["source_sha256"])
        completed = [r for r in evidence["attempts"] if r["status"] == "completed"]
        paragraph(
            f"Unidade: tentativa, não participante distinto. Total: {len(evidence['attempts'])}; concluídas: {len(completed)}. "
            "Condições favoráveis foram relatadas pelo usuário, sem medição independente. Não há metadados suficientes para quantificar FPS e resolução efetiva nesta fonte."
        )
        for row in evidence["attempts"]:
            if row["status"] != "completed":
                paragraph(
                    f"Tentativa {row['attempt']}: interrompida ({row['reason']}); {row['references']} referências. Sem RMSE final; não atribuída como erro zero."
                )
        paragraph(
            "Método reproduzível: scripts/analyze_calibration.py recalcula a interpolação geométrica usando referências e amostras de conferência do JSON original e compara RMSE, reprovação e número de quadros sem previsão aos valores registrados. Nenhum modelo é treinado. RMSE = raiz da média de [(x estimado - x alvo)² + (y estimado - y alvo)²], em eixos normalizados separadamente por largura e altura; não é erro em graus visuais ou pixels. Quadros fora da malha são contados separadamente e não entram no RMSE."
        )
        paragraph(
            "O código versionado publica apenas contagens, erros e posições dos alvos exibidos; não publica vetores oculares ou imagens faciais. Com o JSON agregado, qualquer pessoa pode regenerar os gráficos; para recalcular a projeção ocular é necessário o diagnóstico original privado. A comparação numérica verifica consistência do cálculo, não precisão humana independente."
        )
        for figure in data.get("calibration_figures", []):
            story.append(figure)
            story.append(Spacer(1, 12))
        paragraph("Interpretação e limites", "Heading2")
        for row in completed:
            paragraph(
                f"Tentativa {row['attempt']}: RMSE {row['rmse']:.6f}, RMSE das referências medianas {row['median_rmse']:.6f}, P90 {row['p90']:.6f}; "
                f"{row['predicted']} previstos, {row['unsupported']}/{row['total']} sem previsão ({row['unsupported_percent']:.1f}%). "
                f"Critério original: {'aprovada' if row['approved'] else 'reprovada'}."
            )
        paragraph(
            "Nesta fonte, a última coleta teve menos quadros sem previsão, mas maior RMSE nos previstos; não há evidência de melhora geral. Quadros consecutivos não são participantes independentes, e não se calcula significância estatística com estas duas tentativas. O erro ausente não é zero."
        )
        paragraph(
            "Os gráficos espaciais posicionam cada alvo conhecido e mostram seu RMSE e a contagem sem previsão. Não são heatmaps de atenção. Um alvo sem previsão não recebe erro zero. O rastreamento livre sem referência conhecida não comprova acerto. Não foram demonstradas localização confiável de placas, superioridade A/B, leitura ou acessibilidade."
        )
        paragraph(
            "Escolhas e conclusão: MediaPipe fornece detecção pronta de landmarks, não gaze pronto; a malha geométrica evita treinamento próprio e explicita a ausência de extrapolação. OpenCV fornece descritores da cena; SQLite permite execução local simples. Preserva-se o bloqueio oficial e usa-se o modo exploratório apenas para demonstrar a integração. Próximos experimentos devem manter protocolo e versão, registrar condições de captura, controlar a postura e repetir alvos conhecidos com códigos anônimos. O resultado atual é um limite empírico do protótipo nas condições registradas, sem generalização para populações ou tipos de olhos."
        )
        story.append(PageBreak())
    paragraph(f"{4 if evidence else 3}. Sessões de estudo persistidas", "Heading2")
    paragraph(
        f"Sessões: {summary['sessions_total']}. Concluídas: {summary['completed']}. Excluídas/incompletas: {summary['excluded']}."
    )
    if not summary["completed"]:
        paragraph(
            "Sem sessões de estudo persistidas neste relatório. Diagnósticos de calibração, quando incluídos, são analisados separadamente; não equivalem a participantes elegíveis ou resultados de localização."
        )
    rows = [["Cenário / alvo", "Modo", "N", "Sucesso", "Tempo (s)"]]
    for row in summary["rows"]:
        if not row["participants"]:
            continue
        rows.append(
            [
                Paragraph(escape(row["scenario"] + " / " + row["target"]), styles["BodyText"]),
                "Olhar",
                str(row["participants"]),
                f"{row['success_rate']:.1f}%",
                "—" if row["mean_first_seconds"] is None else f"{row['mean_first_seconds']:.2f}",
            ]
        )
    table = Table(rows, colWidths=[220, 60, 30, 65, 65], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#163d32")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8d5cd")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(table)
    if data["sessions"]:
        paragraph("Margem e captura por sessão", "Heading2")
        quality_rows = [
            ["Código", "Margem imagem X/Y", "Ambíguas", "FPS webcam / processo", "Resultado"]
        ]
        for session in data["sessions"]:
            metrics = session.get("metrics", {})
            margin = (session.get("calibration") or {}).get("uncertainty")
            axes = margin.get("image_axes") if margin else None
            camera = session.get("capture_settings") or {}
            processing = session.get("processing_stats") or {}

            def rate(value):
                return f"{value:.1f}" if isinstance(value, (int, float)) else "—"

            values = [
                session["participant"],
                " / ".join(f"{v * 100:.1f}%" for v in axes) if axes else "histórico",
                str(metrics.get("uncertain_samples"))
                if metrics.get("uncertain_samples") is not None
                else "—",
                f"{rate(camera.get('frame_rate'))} / {rate(processing.get('average_fps'))}",
                metrics.get("outcome", session["status"]),
            ]
            quality_rows.append([Paragraph(escape(str(v)), styles["BodyText"]) for v in values])
        quality_table = Table(quality_rows, colWidths=[66, 102, 62, 112, 158], repeatRows=1)
        quality_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e4ebe5")),
                ]
            )
        )
        story.append(quality_table)
        story.append(Spacer(1, 12))
    selected = set(summary["selected_session_ids"])
    for scenario in study.get("scenarios", []):
        for mode in ("gaze", "exploratory"):
            sessions = [
                s
                for s in data["sessions"]
                if s["scenario_id"] == scenario["id"]
                and s["mode"] == mode
                and (s["id"] in selected if mode == "gaze" else s["status"] == "completed")
            ]
            points = [p for s in sessions for p in s["points"] if p["valid"]]
            if not points:
                continue
            story.append(PageBreak())
            paragraph(scenario["name"], "Heading2")
            paragraph(
                "ENSAIO EXPLORATÓRIO — NÃO VALIDADO"
                if mode == "exploratory"
                else "Densidade de estimativas de olhar (experimental)"
            )
            raw = heatmap(decode_scene(scenario["image"]), points)
            width = 440
            height = width * scenario["height"] / scenario["width"]
            if height > 400:
                width *= 400 / height
                height = 400
            story.append(Image(io.BytesIO(raw), width=width, height=height))
            paragraph(
                f"{len(sessions)} sessões (modo {mode}); {len(points)} pontos válidos. Cores normalizadas por imagem: intensidade não é comparável diretamente entre mapas nem mede duração de fixações."
            )
    paragraph(f"{5 if evidence else 4}. Análise crítica e considerações finais", "Heading2")
    paragraph(
        "Resultados observacionais dependem da tarefa, imagem, tamanho das áreas e ordem de apresentação. Para comparar A/B, usar tarefas equivalentes, contrabalançar a ordem e registrar o mesmo protocolo. Não concluir superioridade de um cenário com amostra pequena ou sem controlar esses fatores."
    )
    paragraph(
        "Os relatos prévios de RMSE entre 0.146 e 0.206 motivaram critérios de qualidade e marcação de resultados inconclusivos. A existência da aplicação e seus testes sintéticos não comprovam precisão com pessoas. O relatório final deve complementar os diagnósticos com sessões reais de estudo quando viáveis e com a discussão individual da equipe."
    )
    paragraph(f"{6 if evidence else 5}. Privacidade e reprodução", "Heading2")
    paragraph(
        "Aplicação local de operador único, sem autenticação: não publicar em rede compartilhada. Consentimento antecede captura. Participantes usam códigos. Frames/vídeos de webcam não são enviados nem salvos. Exportações JSON/CSV permitem reproduzir os indicadores; a exclusão de estudo remove seus cenários e sessões. Executar os testes Python e os testes de navegador conforme README."
    )
    paragraph(
        "Referências: enunciado Cognitive Computing-GS2-2026 (Arnaldo Jr); documentação MediaPipe Face Mesh/Iris; código e protocolo do repositório FIAP-4SIZ/HeatCity. Consulte docs/requisitos-mvp.md e docs/protocolo-experimental.md."
    )

    if data.get("references"):
        paragraph("Fontes identificadas e links", "Heading2")
        paragraph(
            "Enunciado primário: Arnaldo Jr / FIAP, Cognitive Computing, Computer Vision And IOT Systems — Global Solution, 2026. PDF fornecido pelo usuário, duas páginas, sem endereço público informado. Os demais endereços abaixo foram identificados, mas a consulta externa foi bloqueada neste ambiente em 11/11/2026. Referências conceituais OpenCV 4.x; runtime instalado OpenCV 5.0.0.93. A fórmula de contraste local e o limite 0,100 são escolhas do projeto."
        )
        for reference in data["references"]:
            label = f"[{reference['id']}] {reference['author']}. {reference['title']}"
            url = escape(reference["url"], {'"': "&quot;"})
            story.append(
                Paragraph(
                    escape(label)
                    + '<br/><link href="'
                    + url
                    + '">'
                    + escape(reference["url"])
                    + "</link>",
                    styles["BodyText"],
                )
            )
            paragraph(reference["purpose"])
        paragraph(
            "Bibliografia completa: docs/referencias.md. Implementação e versões: backend/requirements.lock, frontend/package-lock.json e código do repositório FIAP-4SIZ/HeatCity."
        )

    def footer(canvas, document):
        canvas.setFont("Helvetica", 8)
        canvas.drawString(
            42,
            25,
            "HeatCity · Global Solution FIAP · Relatório gerado a partir dos registros locais",
        )
        canvas.drawRightString(550, 25, str(document.page))

    SimpleDocTemplate(
        output, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=45
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
