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
    paragraph("2. Métodos e qualidade", "Heading2")
    paragraph(
        "Cenas e áreas de interesse são normalizadas em [0,1]. OpenCV calcula luminância, contraste local (percentis 1 e 99), nitidez pela variância do Laplaciano e mapas de densidade espacial. São indicadores descritivos, sem certificação de acessibilidade ou OCR."
    )
    paragraph(
        "A câmera é processada localmente pelo detector pronto MediaPipe. O alvo móvel percorre linhas, bordas, cantos, diagonais e centro. Amostras válidas em movimento próximas das referências podem antecipar a coleta. A geometria é conferida a cada linha, com reparos locais limitados e preservação de dados parciais quando falha. Vinte e cinco referências oculares registradas automaticamente após coleta estável formam uma malha de triângulos, interpolada geometricamente, sem regressão, classificação, treinamento ou seleção de modelo. Treze alvos posteriores, incluindo bordas e cantos, conferem o erro por quadro e por região; cada região deve atender ao limite 0,100; dados fora da malha reprovam a cobertura, sem extrapolação. RMSE <= 0.100, compatibilidade com o tamanho da placa, ao menos 30 amostras válidas e cobertura temporal >= 60% são critérios heurísticos declarados; não comprovam precisão humana."
    )
    paragraph(
        "Taxa de sucesso = participantes que localizaram o alvo / participantes elegíveis da mesma tarefa, cenário e modo. Tempo até localizar é resumido somente entre sucessos; falhas permanecem no denominador da taxa. Para repetições, seleciona-se a última sessão concluída elegível por participante/grupo. Sessões abortadas e rastreamento insuficiente são excluídos. Nas sessões novas, a margem empírica por eixo usa o maior P90 absoluto observado entre os alvos e é convertida da tela para o tamanho real da imagem exibida. A área de erro deve caber inteiramente na placa e permanecer por pelo menos 0,2 s para confirmar observação. Permanência apenas na faixa ambígua torna o resultado inconclusivo e excluído das taxas; ausências conclusivas continuam no denominador. Uma aquisição com menos de 60% dos intervalos adjacentes válidos dentro de 0,2 s também é inconclusiva, em vez de contar como ausência. Sessões históricas preservam seu método anterior. A margem é heurística, não um intervalo de confiança nem garantia de conter o olhar real."
    )
    paragraph("3. Resultados persistidos", "Heading2")
    paragraph(
        f"Sessões: {summary['sessions_total']}. Concluídas: {summary['completed']}. Excluídas/incompletas: {summary['excluded']}."
    )
    if not summary["completed"]:
        paragraph(
            "Sem dados de participantes. Este relatório é uma estrutura técnica provisória, não comprova desempenho humano."
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
                str(metrics.get("uncertain_samples", "—")),
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
        for mode in ("gaze",):
            sessions = [
                s
                for s in data["sessions"]
                if s["scenario_id"] == scenario["id"] and s["mode"] == mode and s["id"] in selected
            ]
            points = [p for s in sessions for p in s["points"] if p["valid"]]
            if not points:
                continue
            story.append(PageBreak())
            paragraph(scenario["name"], "Heading2")
            paragraph("Densidade de estimativas de olhar (experimental)")
            raw = heatmap(decode_scene(scenario["image"]), points)
            width = 440
            height = width * scenario["height"] / scenario["width"]
            if height > 400:
                width *= 400 / height
                height = 400
            story.append(Image(io.BytesIO(raw), width=width, height=height))
            paragraph(
                f"{len(sessions)} sessões elegíveis; {len(points)} pontos válidos. Cores normalizadas por imagem: intensidade não é comparável diretamente entre mapas nem mede duração de fixações."
            )
    paragraph("4. Análise crítica e considerações finais", "Heading2")
    paragraph(
        "Resultados observacionais dependem da tarefa, imagem, tamanho das áreas e ordem de apresentação. Para comparar A/B, usar tarefas equivalentes, contrabalançar a ordem e registrar o mesmo protocolo. Não concluir superioridade de um cenário com amostra pequena ou sem controlar esses fatores."
    )
    paragraph(
        "Os relatos prévios de RMSE entre 0.146 e 0.206 motivaram critérios de qualidade e marcação de resultados inconclusivos. A existência da aplicação e seus testes sintéticos não comprovam precisão com pessoas. O relatório final acadêmico deve acrescentar os resultados reais, análise das falhas e discussão individual da equipe."
    )
    paragraph("5. Privacidade e reprodução", "Heading2")
    paragraph(
        "Aplicação local de operador único, sem autenticação: não publicar em rede compartilhada. Consentimento antecede captura. Participantes usam códigos. Frames/vídeos de webcam não são enviados nem salvos. Exportações JSON/CSV permitem reproduzir os indicadores; a exclusão de estudo remove seus cenários e sessões. Executar os testes Python e os testes de navegador conforme README."
    )
    paragraph(
        "Referências: enunciado Cognitive Computing-GS2-2026 (Arnaldo Jr); documentação MediaPipe Face Mesh/Iris; código e protocolo do repositório FIAP-4SIZ/HeatCity. Consulte docs/requisitos-mvp.md e docs/protocolo-experimental.md."
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
