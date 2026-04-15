"""Clinical-grade Model Audit & Safety Certificate — reportlab PDF generator.

POST /certificate/download-pdf

Accepts a rich JSON payload from the frontend containing the full pipeline
state (demographics, evaluation metrics, SHAP features, subgroup fairness,
checklist state, bias flags).  No backend cache lookups needed — all data
travels in the request body so the document is 100% reproducible.

Document structure
──────────────────
  Page 1 – Cover / Header
    • Institutional letterhead (thick top border)
    • Full title: "AI Clinical Decision Support — Model Audit & Safety Certificate"
    • Generated date, participant, organization
    • Review badge: clinical review required or pilot deployment cleared

  Section 1 – Champion Model Summary (table)
  Section 2 – Data Representation (demographics + mismatch warning)
  Section 3 – Top Feature Influences (Global SHAP / numbered list)
  Section 4 – Subgroup Fairness Analysis (styled table)
              + Bias warnings paragraph
  Section 5 – EU AI Act Compliance Checklist (table with ✅ / ❌)
  Sign-off   – 4 signature lines
  Footer     – UID, confidentiality notice
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import KeepTogether

router = APIRouter(prefix="/certificate", tags=["certificate"])

# ─── Color palette ─────────────────────────────────────────────────────────────
_NAVY       = colors.HexColor("#1E3A5F")
_NAVY_LIGHT = colors.HexColor("#EAF0F8")
_RED        = colors.HexColor("#DC2626")
_RED_LIGHT  = colors.HexColor("#FEE2E2")
_GREEN      = colors.HexColor("#059669")
_GREEN_LIGHT= colors.HexColor("#D1FAE5")
_AMBER      = colors.HexColor("#92400E")
_AMBER_LIGHT= colors.HexColor("#FEF3C7")
_GREY       = colors.HexColor("#F8FAFC")
_GREY_MID   = colors.HexColor("#E2E8F0")
_TEXT_DARK  = colors.HexColor("#0F172A")
_TEXT_MID   = colors.HexColor("#475569")
_TEXT_LIGHT = colors.HexColor("#94A3B8")
_WHITE      = colors.white


# ─── Request schema ─────────────────────────────────────────────────────────────

class DemographicItem(BaseModel):
    label: str
    training_pct: float | None = None
    population_pct: float | None = None

class SubgroupMetric(BaseModel):
    group: str
    n: int = 0
    accuracy: float | None = None
    sensitivity: float | None = None
    specificity: float | None = None

class ChecklistEntry(BaseModel):
    label: str
    done: bool = False

class AuditReportRequest(BaseModel):
    # Identity
    session_id: str = Field(default="demo-session")
    run_id: str = Field(default="run-1")
    participant: str = Field(default="ML Practitioner")
    organization: str = Field(default="Clinical Institution")

    # Step 2 – dataset demographics (optional)
    demographics: list[DemographicItem] = Field(default_factory=list)

    # Step 5 – champion model + evaluation
    champion_name: str = Field(default="Champion Model")
    model_id: str = Field(default="")
    cv_score: float | None = None
    train_test_gap: float | None = None
    overfitting_risk: str = Field(default="unknown")
    accuracy: float | None = None
    precision: float | None = None
    sensitivity: float | None = None
    specificity: float | None = None
    f1_score: float | None = None
    auc: float | None = None

    # Step 6 – top SHAP features
    top_features: list[dict[str, Any]] = Field(default_factory=list)

    # Step 7 – fairness
    bias_detected: bool = False
    bias_threshold: float = 0.10
    subgroup_metrics: list[SubgroupMetric] = Field(default_factory=list)
    fairness_warnings: list[str] = Field(default_factory=list)

    # EU AI Act checklist
    checklist: list[ChecklistEntry] = Field(default_factory=list)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:.1f}%"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "kicker", parent=base["Normal"],
            fontSize=7, textColor=_TEXT_LIGHT,
            alignment=TA_CENTER, spaceAfter=4,
        ),
        "main_title": ParagraphStyle(
            "main_title", parent=base["Normal"],
            fontSize=20, textColor=_NAVY,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=4,
        ),
        "sub_title": ParagraphStyle(
            "sub_title", parent=base["Normal"],
            fontSize=13, textColor=_NAVY,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=6,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base["Normal"],
            fontSize=8, textColor=_TEXT_MID,
            alignment=TA_CENTER, spaceAfter=8,
        ),
        "badge_red": ParagraphStyle(
            "badge_red", parent=base["Normal"],
            fontSize=13, textColor=_RED,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=6,
        ),
        "badge_green": ParagraphStyle(
            "badge_green", parent=base["Normal"],
            fontSize=13, textColor=_GREEN,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=6,
        ),
        "section_heading": ParagraphStyle(
            "section_heading", parent=base["Normal"],
            fontSize=11, textColor=_NAVY,
            fontName="Helvetica-Bold",
            spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_DARK,
            spaceAfter=4,
        ),
        "body_italic": ParagraphStyle(
            "body_italic", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_MID,
            fontName="Helvetica-Oblique",
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_DARK,
            leftIndent=14, firstLineIndent=-14,
            spaceAfter=3,
        ),
        "numbered": ParagraphStyle(
            "numbered", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_DARK,
            leftIndent=20, firstLineIndent=-20,
            spaceAfter=3,
        ),
        "footnote": ParagraphStyle(
            "footnote", parent=base["Normal"],
            fontSize=7, textColor=_TEXT_LIGHT,
            fontName="Helvetica-Oblique",
            spaceAfter=3,
        ),
        "warning": ParagraphStyle(
            "warning", parent=base["Normal"],
            fontSize=9, textColor=_AMBER,
            fontName="Helvetica-Bold",
            spaceAfter=3,
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"],
            fontSize=7, textColor=_TEXT_LIGHT,
            fontName="Helvetica-Oblique",
            alignment=TA_CENTER, spaceAfter=2,
        ),
        "signoff_label": ParagraphStyle(
            "signoff_label", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_DARK,
            fontName="Helvetica-Bold",
            spaceAfter=2,
        ),
        "signoff_line": ParagraphStyle(
            "signoff_line", parent=base["Normal"],
            fontSize=9, textColor=_TEXT_LIGHT,
            spaceAfter=14,
        ),
    }


def _hr(color=_NAVY_LIGHT, thickness=1) -> HRFlowable:
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)


def _spacer(h_cm: float = 0.3) -> Spacer:
    return Spacer(1, h_cm * cm)


# ─── Section builders ──────────────────────────────────────────────────────────

def _build_cover(payload: AuditReportRequest, doc_id: str, s: dict) -> list:
    story = []
    story.append(HRFlowable(width="100%", thickness=5, color=_NAVY, spaceAfter=8))
    story.append(Paragraph("CONFIDENTIAL — FOR INTERNAL CLINICAL AUDIT USE ONLY", s["kicker"]))
    story.append(_spacer(0.2))
    story.append(Paragraph("AI Clinical Decision Support", s["main_title"]))
    story.append(Paragraph("Model Audit &amp; Safety Certificate", s["sub_title"]))
    story.append(_spacer(0.2))

    now = datetime.utcnow()
    story.append(Paragraph(
        f"Generated: {now.strftime('%d %B %Y  %H:%M UTC')} &nbsp;|&nbsp; "
        f"UID: {doc_id} &nbsp;|&nbsp; Session: {payload.session_id}",
        s["meta"],
    ))
    story.append(_spacer(0.2))

    if payload.bias_detected:
        badge_text = "FAIRNESS REVIEW: CLINICAL REVIEW REQUIRED"
        badge_style = s["badge_red"]
    else:
        badge_text = "FAIRNESS REVIEW: CLEARED FOR PILOT DEPLOYMENT"
        badge_style = s["badge_green"]

    story.append(Paragraph(badge_text, badge_style))
    story.append(HRFlowable(width="100%", thickness=3, color=_NAVY, spaceAfter=10))
    story.append(_spacer(0.2))

    # Participant / org table
    meta_data = [
        [
            Paragraph("<b>Participant / Analyst</b><br/>" + payload.participant, s["body"]),
            Paragraph("<b>Organization / Institution</b><br/>" + payload.organization, s["body"]),
        ],
        [
            Paragraph("<b>Champion Model</b><br/>" + payload.champion_name, s["body"]),
            Paragraph("<b>Risk Classification</b><br/>" + payload.overfitting_risk.capitalize() + " Risk", s["body"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=["50%", "50%"])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), _GREY),
        ("GRID",        (0, 0), (-1, -1), 0.5, _GREY_MID),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("ROWPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(_spacer(0.4))
    return story


def _build_model_summary(payload: AuditReportRequest, s: dict) -> list:
    story = [Paragraph("1.  CHAMPION MODEL SUMMARY", s["section_heading"]), _hr()]

    rows = [
        ["Model Algorithm",          payload.champion_name],
        ["Model ID",                 payload.model_id or "—"],
        ["Cross-Validation Score",   _pct(payload.cv_score)],
        ["Train → Test Gap",         _pct(payload.train_test_gap)],
        ["Overfitting Risk",         payload.overfitting_risk.capitalize()],
        ["Test Accuracy",            _pct(payload.accuracy)],
        ["Test Precision",           _pct(payload.precision)],
        ["Test Sensitivity (Recall)",_pct(payload.sensitivity)],
        ["Test Specificity",         _pct(payload.specificity)],
        ["Test F1 Score",            _pct(payload.f1_score)],
        ["AUC-ROC",                  _pct(payload.auc)],
    ]

    table_data = [
        [Paragraph(f"<b>{k}</b>", s["body"]), Paragraph(v, s["body"])]
        for k, v in rows
    ]
    tbl = Table(table_data, colWidths=["45%", "55%"])
    style_cmds = [
        ("GRID",          (0, 0), (-1, -1), 0.5, _GREY_MID),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]
    # Shade label column
    for i in range(len(rows)):
        style_cmds.append(("BACKGROUND", (0, i), (0, i), _NAVY_LIGHT))
    # Flag poor sensitivity
    for i, (k, _) in enumerate(rows):
        if "Sensitivity" in k and payload.sensitivity is not None and payload.sensitivity < 0.50:
            style_cmds.append(("BACKGROUND", (1, i), (1, i), _RED_LIGHT))
            style_cmds.append(("TEXTCOLOR",  (1, i), (1, i), _RED))
            style_cmds.append(("FONTNAME",   (1, i), (1, i), "Helvetica-Bold"))

    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)
    return story


def _build_data_representation(payload: AuditReportRequest, s: dict) -> list:
    story = [_spacer(), Paragraph("2.  DATA REPRESENTATION &amp; DEMOGRAPHICS", s["section_heading"]), _hr()]

    if not payload.demographics:
        story.append(Paragraph(
            "No demographic data provided. Attach Step 2 dataset profile to enable this section.",
            s["body_italic"],
        ))
        return story

    mismatch_items: list[str] = []
    for item in payload.demographics:
        pct_train = f"{item.training_pct * 100:.1f}%" if item.training_pct is not None else "N/A"
        pct_pop   = f"{item.population_pct * 100:.1f}%" if item.population_pct is not None else "N/A"
        story.append(Paragraph(
            f"• <b>{item.label}:</b>  Training = {pct_train}  |  Reference population = {pct_pop}",
            s["bullet"],
        ))
        if (item.training_pct is not None and item.population_pct is not None
                and abs(item.training_pct - item.population_pct) > 0.10):
            gap = abs(item.training_pct - item.population_pct) * 100
            mismatch_items.append(f"{item.label}: training {pct_train} vs population {pct_pop} (gap = {gap:.1f}pp)")

    if mismatch_items:
        story.append(_spacer(0.2))
        story.append(Paragraph(
            "⚠  Representativeness Warning: The following demographic groups have a &gt;10% gap "
            "between training data and the reference population. This may introduce systematic bias.",
            s["warning"],
        ))
        for m in mismatch_items:
            story.append(Paragraph(f"• {m}", s["bullet"]))

    return story


def _build_top_features(payload: AuditReportRequest, s: dict) -> list:
    story = [_spacer(), Paragraph("3.  TOP FEATURE INFLUENCES (GLOBAL SHAP)", s["section_heading"]), _hr()]

    if not payload.top_features:
        story.append(Paragraph(
            "Global SHAP feature data not available. Run Step 6 (Explainability) to populate this section.",
            s["body_italic"],
        ))
        return story

    for i, feat in enumerate(payload.top_features[:8], 1):
        name = str(feat.get("feature", "?"))
        imp  = float(feat.get("importance", 0.0))
        story.append(Paragraph(
            f"{i}.  <b>{name}</b>  <font color='#64748B'>— SHAP importance: {imp:.4f}</font>",
            s["numbered"],
        ))

    return story


def _build_subgroup_table(payload: AuditReportRequest, s: dict) -> list:
    story = [_spacer(), Paragraph("4.  SUBGROUP FAIRNESS ANALYSIS", s["section_heading"]), _hr()]

    if not payload.subgroup_metrics:
        story.append(Paragraph(
            "No demographic subgroups detected. The dataset may not contain recognised "
            "demographic columns (sex, gender, age, race, ethnicity).",
            s["body_italic"],
        ))
        if payload.bias_detected:
            story.append(Paragraph(
                "⚠  Bias flag is still raised from the API response. Manual review recommended.",
                s["warning"],
            ))
        return story

    sens_vals = [m.sensitivity for m in payload.subgroup_metrics if m.sensitivity is not None]
    best_sens = max(sens_vals) if sens_vals else 1.0

    headers = [
        Paragraph("<b>Subgroup</b>", s["body"]),
        Paragraph("<b>N</b>", s["body"]),
        Paragraph("<b>Accuracy</b>", s["body"]),
        Paragraph("<b>Sensitivity ★</b>", s["body"]),
        Paragraph("<b>Specificity</b>", s["body"]),
    ]
    col_widths = [5.5*cm, 1.4*cm, 2.2*cm, 2.8*cm, 2.5*cm]

    table_data = [headers]
    style_cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), _NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), _WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID",          (0, 0), (-1, -1), 0.5, _GREY_MID),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]

    for i, m in enumerate(payload.subgroup_metrics):
        row_idx = i + 1
        sens = m.sensitivity
        poor = sens is not None and (sens < 0.50 or (best_sens - sens) > payload.bias_threshold)

        cells = [
            Paragraph(m.group, s["body"]),
            Paragraph(str(m.n), s["body"]),
            Paragraph(_pct(m.accuracy), s["body"]),
            Paragraph(_pct(m.sensitivity), s["body"]),
            Paragraph(_pct(m.specificity), s["body"]),
        ]
        table_data.append(cells)

        if poor:
            style_cmds.append(("BACKGROUND", (3, row_idx), (3, row_idx), _RED_LIGHT))
            style_cmds.append(("TEXTCOLOR",  (3, row_idx), (3, row_idx), _RED))
            style_cmds.append(("FONTNAME",   (3, row_idx), (3, row_idx), "Helvetica-Bold"))
        elif i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), _GREY))

    tbl = Table(table_data, colWidths=col_widths)
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    story.append(Paragraph(
        f"★ Sensitivity (True Positive Rate) is the primary fairness metric in high-risk clinical AI. "
        f"Red = Sensitivity &lt; 50% or gap &gt; {int(payload.bias_threshold * 100)}pp vs. best performing group.",
        s["footnote"],
    ))

    if payload.fairness_warnings:
        story.append(_spacer(0.2))
        for w in payload.fairness_warnings:
            story.append(Paragraph(f"• {w}", s["warning"]))

    return story


def _build_checklist(payload: AuditReportRequest, s: dict) -> list:
    story = [_spacer(), Paragraph("5.  EU AI ACT COMPLIANCE CHECKLIST", s["section_heading"]), _hr()]

    items = payload.checklist
    if not items:
        items = [
            ChecklistEntry(label="Training data documented and version-controlled", done=False),
            ChecklistEntry(label="Performance metrics computed on held-out test set", done=False),
            ChecklistEntry(label="Model trained, validated, and champion selected", done=False),
            ChecklistEntry(label="Model is explainable (SHAP global & local)", done=False),
            ChecklistEntry(label="Subgroup fairness audit completed", done=False),
            ChecklistEntry(label="Human oversight plan approved by clinical lead", done=False),
            ChecklistEntry(label="Risk classification assigned (EU AI Act Art. 6)", done=False),
            ChecklistEntry(label="Incident reporting procedure documented", done=False),
            ChecklistEntry(label="Post-deployment monitoring plan defined", done=False),
            ChecklistEntry(label="Patient data anonymised / pseudonymised (GDPR Art. 4(5))", done=False),
        ]

    headers = [Paragraph("<b>EU AI Act Compliance Item</b>", s["body"]),
               Paragraph("<b>Status</b>", s["body"])]
    table_data = [headers]
    style_cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), _NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), _WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID",          (0, 0), (-1, -1), 0.5, _GREY_MID),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]

    for i, item in enumerate(items):
        row_idx = i + 1
        if item.done:
            status = Paragraph('<font color="#059669"><b>✅  Complete</b></font>', s["body"])
            style_cmds.append(("BACKGROUND", (1, row_idx), (1, row_idx), _GREEN_LIGHT))
        else:
            status = Paragraph('<font color="#DC2626"><b>❌  Pending</b></font>', s["body"])

        table_data.append([Paragraph(item.label, s["body"]), status])

        if i % 2 == 0 and not item.done:
            style_cmds.append(("BACKGROUND", (0, row_idx), (0, row_idx), _GREY))

    tbl = Table(table_data, colWidths=["75%", "25%"])
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    completed = sum(1 for it in items if it.done)
    progress_color = "#059669" if completed == len(items) else "#DC2626"
    story.append(Paragraph(
        f'<font color="{progress_color}"><b>Compliance Progress: {completed} of {len(items)} items completed.</b></font>',
        s["body"],
    ))
    return story


def _build_signoff(payload: AuditReportRequest, s: dict) -> list:
    story = [_spacer(), Paragraph("6.  AUTHORISATION &amp; SIGN-OFF", s["section_heading"]), _hr()]
    story.append(Paragraph(
        "The undersigned confirm that this model has undergone the audit process described in this "
        "certificate and that the findings have been reviewed prior to any deployment decision.",
        s["body"],
    ))
    story.append(_spacer(0.4))

    for role in [
        "Clinical Lead / Principal Investigator",
        "Data Science / ML Lead",
        "Data Protection Officer (DPO)",
        "Institutional Review Board Representative",
    ]:
        story.append(Paragraph(f"<b>{role}:</b>", s["signoff_label"]))
        story.append(Paragraph(
            "_" * 48 + "     Date:  _______ / _______ / _______",
            s["signoff_line"],
        ))

    return story


def _build_footer(doc_id: str, s: dict) -> list:
    return [
        _hr(color=_NAVY, thickness=2),
        Paragraph(
            f"Generated by ImportMath ML Platform  •  UID: {doc_id}  •  "
            f"Classification: CONFIDENTIAL  •  {datetime.utcnow().strftime('%d %B %Y')}",
            s["footer"],
        ),
        Paragraph(
            "This document is auto-generated and intended solely for internal clinical audit purposes. "
            "Unauthorised distribution is prohibited.",
            s["footer"],
        ),
    ]


# ─── Master PDF builder ────────────────────────────────────────────────────────

def _build_pdf(payload: AuditReportRequest) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm,
        leftMargin=2.2*cm,
        rightMargin=2.2*cm,
    )

    doc_id = str(uuid.uuid4())[:8].upper()
    s = _styles()

    story: list = []
    story += _build_cover(payload, doc_id, s)
    story += _build_model_summary(payload, s)
    story += _build_data_representation(payload, s)
    story += _build_top_features(payload, s)
    story += _build_subgroup_table(payload, s)
    story += _build_checklist(payload, s)
    story += _build_signoff(payload, s)
    story += _build_footer(doc_id, s)

    doc.build(story)
    buf.seek(0)
    return buf


# ─── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/download-pdf")
def download_audit_pdf(payload: AuditReportRequest) -> StreamingResponse:
    """Generate and stream the clinical audit certificate as a PDF file."""
    pdf_buf = _build_pdf(payload)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    filename = f"audit_certificate_{payload.session_id}_{ts}.pdf"
    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
