#!/usr/bin/env python3
"""Render a Mandate post-meeting report to PDF. Reads JSON from stdin, writes PDF bytes to stdout."""

import io
import json
import sys
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


NAVY = colors.HexColor("#12233E")
INDIGO = colors.HexColor("#5B6DF7")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#E8EBF1")
MINT = colors.HexColor("#E6F8F4")
AMBER = colors.HexColor("#FFF4DF")


def safe(value):
    """Keep report generation robust across arbitrary local meeting text."""
    return str(value or "").encode("ascii", "replace").decode("ascii")


def clean_list(value):
    return [safe(item) for item in (value or []) if str(item).strip()]


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(0.7 * inch, 0.58 * inch, 7.8 * inch, 0.58 * inch)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.38 * inch, "MANDATE  |  EVIDENCE-GROUNDED REPRESENTATION RECORD")
    canvas.drawRightString(7.8 * inch, 0.38 * inch, f"Page {document.page}")
    canvas.restoreState()


def make_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "MandateTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24,
            leading=29, textColor=NAVY, spaceAfter=6, alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "MandateSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
            leading=15, textColor=MUTED, spaceAfter=16,
        ),
        "section": ParagraphStyle(
            "MandateSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12,
            leading=15, textColor=NAVY, spaceBefore=17, spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "MandateBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4,
            leading=14, textColor=colors.HexColor("#344054"), spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "MandateSmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2,
            leading=11.5, textColor=MUTED,
        ),
        "label": ParagraphStyle(
            "MandateLabel", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.3,
            leading=9, textColor=MUTED,
        ),
        "table": ParagraphStyle(
            "MandateTable", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2,
            leading=11, textColor=colors.HexColor("#344054"),
        ),
    }


def bullet_items(items, styles, empty_message="None recorded."):
    if not items:
        return [Paragraph(safe(empty_message), styles["small"])]
    return [Paragraph(f"<font color='#5B6DF7'>&bull;</font>&nbsp;&nbsp;{safe(item)}", styles["body"]) for item in items]


def report_pdf(data):
    styles = make_styles()
    output = io.BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=letter, leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.68 * inch, bottomMargin=0.75 * inch,
        title="Mandate meeting report", author="Mandate",
    )

    brief = data.get("brief") or {}
    report = data.get("report") or {}
    ledger = data.get("ledger") or []
    approvals = data.get("approvals") or []
    transcript = brief.get("transcript") or []
    generated_at = data.get("generatedAt") or datetime.now(timezone.utc).isoformat()

    story = []
    story.append(Paragraph("POST-MEETING REPORT", styles["label"]))
    story.append(Paragraph(safe(brief.get("title") or "Meeting report"), styles["title"]))
    story.append(Paragraph(
        f"Prepared for {safe(brief.get('owner') or 'the meeting owner')} &nbsp;&middot;&nbsp; "
        f"Generated {safe(generated_at[:19].replace('T', ' '))} UTC",
        styles["subtitle"],
    ))

    meeting_data = [
        [Paragraph("MEETING", styles["label"]), Paragraph("OWNER", styles["label"]), Paragraph("ATTENDEES", styles["label"])],
        [Paragraph(safe(brief.get("meetingTime") or "Not recorded"), styles["body"]),
         Paragraph(safe(brief.get("owner") or "Not recorded"), styles["body"]),
         Paragraph(safe(brief.get("attendees") or "Not recorded"), styles["body"])],
    ]
    meeting_table = Table(meeting_data, colWidths=[2.25 * inch, 1.75 * inch, 2.7 * inch])
    meeting_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F8FC")),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([meeting_table, Spacer(1, 12)])

    story.append(Paragraph("Executive summary", styles["section"]))
    story.append(Paragraph(safe(report.get("executive_summary") or "No summary was returned."), styles["body"]))

    story.append(Paragraph("Delegate mandate", styles["section"]))
    mandate_data = [
        [Paragraph("OWNER POSITION", styles["label"]), Paragraph("SCOPE / AUTHORITY", styles["label"])],
        [Paragraph(safe(brief.get("position") or "Not recorded"), styles["body"]),
         Paragraph("<br/>".join(safe(item) for item in brief.get("authority") or []) or "No authority recorded", styles["body"])],
        [Paragraph("MUST ESCALATE", styles["label"]), Paragraph("DELEGATE POSITION", styles["label"])],
        [Paragraph("<br/>".join(safe(item) for item in brief.get("escalation") or []) or "No escalation rule recorded", styles["body"]),
         Paragraph(safe(report.get("delegate_position") or "No delegate position recorded."), styles["body"])],
    ]
    mandate_table = Table(mandate_data, colWidths=[3.35 * inch, 3.35 * inch])
    mandate_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), MINT), ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#F7F8FC")),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(mandate_table)

    story.append(Paragraph("Decisions and next actions", styles["section"]))
    decision_flow = [Paragraph("DECISIONS", styles["label"])] + bullet_items(clean_list(report.get("decisions")), styles)
    action_flow = [Paragraph("OWNER ACTIONS", styles["label"])] + bullet_items(clean_list(report.get("owner_actions")), styles)
    decision_table = Table([[decision_flow, action_flow]], colWidths=[3.35 * inch, 3.35 * inch])
    decision_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(decision_table)

    story.append(Paragraph("Representation record", styles["section"]))
    ledger_rows = [[
        Paragraph("WHEN", styles["label"]), Paragraph("WHAT MANDATE DID", styles["label"]),
        Paragraph("EVIDENCE", styles["label"]), Paragraph("OUTCOME", styles["label"]),
    ]]
    if ledger:
        for entry in ledger[-30:]:
            ledger_rows.append([
                Paragraph(safe(entry.get("time") or "-"), styles["table"]),
                Paragraph(f"<b>{safe(entry.get('item') or 'Record')}</b><br/>{safe(entry.get('detail') or '')}", styles["table"]),
                Paragraph(safe(", ".join(entry.get("evidence") or []) or "-"), styles["table"]),
                Paragraph(safe(str(entry.get("outcome") or "recorded").upper()), styles["table"]),
            ])
    else:
        ledger_rows.append([Paragraph("-", styles["table"]), Paragraph("No representation record was captured.", styles["table"]), Paragraph("-", styles["table"]), Paragraph("-", styles["table"])])
    ledger_table = Table(ledger_rows, colWidths=[0.78 * inch, 3.6 * inch, 1.15 * inch, 1.17 * inch], repeatRows=1)
    ledger_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(ledger_table)

    if approvals:
        story.append(Paragraph("Open owner approvals", styles["section"]))
        approval_rows = [[Paragraph("QUESTION", styles["label"]), Paragraph("RECOMMENDATION", styles["label"]), Paragraph("EVIDENCE", styles["label"])]]
        for approval in approvals:
            approval_rows.append([
                Paragraph(safe(approval.get("question") or "-"), styles["table"]),
                Paragraph(safe(approval.get("recommendation") or "-"), styles["table"]),
                Paragraph(safe(", ".join(approval.get("evidence") or []) or "-"), styles["table"]),
            ])
        approval_table = Table(approval_rows, colWidths=[2.2 * inch, 3.35 * inch, 1.15 * inch], repeatRows=1)
        approval_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), AMBER), ("BOX", (0, 0), (-1, -1), 0.7, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.append(approval_table)

    if transcript:
        story.append(PageBreak())
        story.append(Paragraph("Transcript appendix", styles["section"]))
        story.append(Paragraph("The record below captures the meeting conversation and Mandate responses.", styles["small"]))
        story.append(Spacer(1, 7))
        for entry in transcript[-80:]:
            speaker = safe(entry.get("speaker") or "Participant")
            time = safe(entry.get("time") or "")
            body = safe(entry.get("text") or "")
            evidence = ", ".join(entry.get("evidence") or [])
            content = [Paragraph(f"<b>{speaker}</b> <font color='#667085'>{time}</font>", styles["table"]), Paragraph(body, styles["table"])]
            if evidence:
                content.append(Paragraph(f"Evidence: {safe(evidence)}", styles["small"]))
            transcript_table = Table([[content]], colWidths=[6.7 * inch])
            transcript_table.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.45, LINE), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFBFC")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            story.extend([KeepTogether(transcript_table), Spacer(1, 5)])

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


if __name__ == "__main__":
    try:
        source = json.loads(sys.stdin.read())
        sys.stdout.buffer.write(report_pdf(source))
    except Exception as error:  # The Node endpoint returns stderr as an actionable HTTP error.
        print(str(error), file=sys.stderr)
        sys.exit(1)
