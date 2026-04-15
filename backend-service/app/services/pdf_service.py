import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.schemas.request import CertificateDownloadRequest


class PdfService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.primary = colors.HexColor("#1E3A5F")
        self.primary_light = colors.HexColor("#EAF0F8")
        self.teal = colors.HexColor("#0F766E")
        self.teal_light = colors.HexColor("#CCFBF1")
        self.amber = colors.HexColor("#B45309")
        self.amber_light = colors.HexColor("#FEF3C7")
        self.red = colors.HexColor("#DC2626")
        self.red_light = colors.HexColor("#FEE2E2")
        self.green = colors.HexColor("#059669")
        self.green_light = colors.HexColor("#D1FAE5")
        self.grey = colors.HexColor("#F8FAFC")
        self.grey_mid = colors.HexColor("#CBD5E1")
        self.title_style = ParagraphStyle(
            'CertificateTitle',
            parent=self.styles['Title'],
            textColor=self.primary,
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
        )
        self.heading_style = ParagraphStyle(
            'CertificateHeading',
            parent=self.styles['Heading2'],
            textColor=self.teal,
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=15,
            spaceBefore=4,
            spaceAfter=6,
        )
        self.normal_style = ParagraphStyle(
            'CertificateBody',
            parent=self.styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0F172A"),
        )
        self.bold_style = ParagraphStyle(
            'BoldNormal',
            parent=self.normal_style,
            fontName='Helvetica-Bold'
        )

    @staticmethod
    def _format_metric(value: object) -> str:
        if value is None:
            return "N/A"
        try:
            return f"{float(value):.4f}"
        except (TypeError, ValueError):
            return "N/A"

    @staticmethod
    def _format_optional(value: object) -> str:
        if value is None:
            return "N/A"
        text = str(value).strip()
        return text or "N/A"

    @staticmethod
    def _parse_subgroup_label(label: object) -> tuple[str, str]:
        text = str(label or "Unknown Subgroup").strip() or "Unknown Subgroup"
        if " = " in text:
            feature, group = text.split(" = ", 1)
            return feature.strip() or "Demographic Feature", group.strip() or text
        if " — " in text:
            feature, group = text.split(" — ", 1)
            return feature.strip() or "Demographic Feature", group.strip() or text
        if " - " in text:
            feature, group = text.split(" - ", 1)
            return feature.strip() or "Demographic Feature", group.strip() or text
        return "Detected Subgroup", text

    def _build_bias_review(self, payload: CertificateDownloadRequest) -> list:
        metrics_by_feature: dict[str, list[dict[str, object]]] = {}
        for metric in payload.subgroup_metrics:
            sensitivity = metric.get("sensitivity")
            if sensitivity is None:
                continue
            try:
                sensitivity_value = float(sensitivity)
            except (TypeError, ValueError):
                continue

            feature_name, group_name = self._parse_subgroup_label(metric.get("group"))
            metrics_by_feature.setdefault(feature_name, []).append({
                "feature_name": feature_name,
                "group_name": group_name,
                "sensitivity": sensitivity_value,
            })

        selected: tuple[str, dict[str, object], dict[str, object], float] | None = None
        for feature_name, entries in metrics_by_feature.items():
            if len(entries) < 2:
                continue
            high = max(entries, key=lambda item: float(item["sensitivity"]))
            low = min(entries, key=lambda item: float(item["sensitivity"]))
            gap = float(high["sensitivity"]) - float(low["sensitivity"])
            if selected is None or gap > selected[3]:
                selected = (feature_name, high, low, gap)

        if selected is None:
            if metrics_by_feature:
                feature_name, entries = next(iter(metrics_by_feature.items()))
                high = entries[0]
                low = entries[0]
                gap = 0.0
                selected = (feature_name, high, low, gap)
            else:
                return [
                    Paragraph("[STATUS: PASSED - WITHIN SAFE LIMITS]", self.bold_style),
                    Paragraph("<b>Finding Summary:</b> No comparable subgroup sensitivity values were provided for this run. A quantitative demographic performance gap could not be computed from the submitted fairness payload.", self.normal_style),
                    Paragraph("<b>Clinical Advisory:</b> The model should not be interpreted as having completed a subgroup fairness review until comparable demographic sensitivity metrics are available.", self.normal_style),
                ]

        feature_name, high_group, low_group, gap = selected
        threshold = float(payload.bias_threshold or 0.0)
        gap_pp = gap * 100
        threshold_pct = threshold * 100
        exceeded = gap > threshold
        status = "[STATUS: CRITICAL REVIEW REQUIRED]" if exceeded else "[STATUS: PASSED - WITHIN SAFE LIMITS]"
        status_color = "#DC2626" if exceeded else "#059669"

        group_a_name = str(high_group["group_name"])
        group_b_name = str(low_group["group_name"])
        group_a_sensitivity = float(high_group["sensitivity"]) * 100
        group_b_sensitivity = float(low_group["sensitivity"]) * 100

        summary = (
            f"For target feature <b>{feature_name}</b>, subgroup <b>{group_a_name}</b> achieved a sensitivity of "
            f"<b>{group_a_sensitivity:.1f}%</b>, while subgroup <b>{group_b_name}</b> achieved a sensitivity of "
            f"<b>{group_b_sensitivity:.1f}%</b>. The calculated performance gap is <b>{gap_pp:.1f} percentage points</b> "
            f"against a maximum allowable clinical threshold of <b>{threshold_pct:.1f}%</b>."
        )

        if exceeded:
            advisory = (
                "The observed disparity exceeds the predefined clinical fairness threshold. The model requires a "
                "manual bias audit before high-risk deployment. This sensitivity differential may stem from imbalanced "
                "training data, subgroup under-representation, or inherent biological variance in cancer prevalence."
            )
        else:
            advisory = (
                "The observed disparity does not exceed the predefined clinical fairness threshold. The model exhibits "
                "equitable diagnostic accuracy across the evaluated demographic subgroups and satisfies the predefined "
                "fairness criteria for this audit."
            )

        detail_data = [
            ["Target Feature", feature_name],
            [f"Subgroup A ({group_a_name}) Sensitivity", f"{group_a_sensitivity:.1f}%"],
            [f"Subgroup B ({group_b_name}) Sensitivity", f"{group_b_sensitivity:.1f}%"],
            ["Calculated Performance Gap", f"{gap_pp:.1f} percentage points (pp)"],
            ["Maximum Allowable Clinical Threshold", f"{threshold_pct:.1f}%"],
        ]
        detail_table = Table(detail_data, colWidths=[220, 220])
        detail_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, self.grey_mid),
            ('BACKGROUND', (0, 0), (0, -1), self.primary_light),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))

        return [
            Paragraph(f"<font color='{status_color}'><b>{status}</b></font>", self.normal_style),
            Spacer(1, 6),
            detail_table,
            Spacer(1, 8),
            Paragraph(f"<b>Finding Summary:</b> {summary}", self.normal_style),
            Spacer(1, 5),
            Paragraph(f"<b>Clinical Advisory:</b> {advisory}", self.normal_style),
        ]

    def _table_style(self, header_bg=None, row_backgrounds=None) -> TableStyle:
        commands = [
            ('BACKGROUND', (0, 0), (-1, 0), header_bg or self.primary),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.grey_mid),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]
        if row_backgrounds:
            commands.append(('ROWBACKGROUNDS', (0, 1), (-1, -1), row_backgrounds))
        return TableStyle(commands)

    def generate_model_validation_pdf(self, payload: CertificateDownloadRequest) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=50,
            leftMargin=50,
            topMargin=50,
            bottomMargin=50
        )
        story = []

        story.append(Paragraph("Health AI - Technical Model Validation Certificate", self.title_style))
        story.append(Spacer(1, 12))

        # 1. HEADER
        story.append(Paragraph("1. HEADER", self.heading_style))
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        header_data = [
            ["Date:", date_str],
            ["Model ID:", payload.model_id],
            ["Champion Algorithm:", payload.champion_name],
        ]
        
        t1 = Table(header_data, colWidths=[180, 260])
        t1.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (0, -1), self.primary),
            ('BACKGROUND', (0, 0), (-1, 0), self.primary_light),
            ('GRID', (0, 0), (-1, -1), 0.4, self.grey_mid),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t1)
        story.append(Spacer(1, 15))

        # 2. MODEL EVIDENCE
        story.append(Paragraph("2. MODEL EVIDENCE", self.heading_style))
        evidence_data = [
            ["Field", "Value"],
            ["Champion Algorithm", self._format_optional(payload.champion_name)],
            ["Model ID", self._format_optional(payload.model_id)],
            ["Run ID", self._format_optional(payload.run_id)],
            ["Train-Test Gap", self._format_metric(payload.train_test_gap)],
            ["Overfitting Risk", self._format_optional(payload.overfitting_risk.upper())],
        ]
        evidence_table = Table(evidence_data, colWidths=[180, 260])
        evidence_table.setStyle(self._table_style(header_bg=self.teal, row_backgrounds=[colors.white, self.grey]))
        story.append(evidence_table)
        story.append(Spacer(1, 15))

        # 3. PERFORMANCE METRICS
        story.append(Paragraph("3. PERFORMANCE METRICS", self.heading_style))
        
        metric_data = [
            ["Metric", "Value", "Metric", "Value"],
            ["Accuracy", self._format_metric(payload.accuracy), "Precision", self._format_metric(payload.precision)],
            ["Recall (Sensitivity)", self._format_metric(payload.sensitivity), "F1 Score", self._format_metric(payload.f1_score)],
            ["AUC-ROC", self._format_metric(payload.auc), "Specificity", self._format_metric(payload.specificity)]
        ]
        t2 = Table(metric_data, colWidths=[120, 100, 120, 100])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.primary),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (1, 1), self.teal_light),
            ('BACKGROUND', (2, 1), (3, 1), self.teal_light),
            ('BACKGROUND', (0, 2), (1, 2), self.primary_light),
            ('BACKGROUND', (2, 2), (3, 2), self.primary_light),
            ('BACKGROUND', (0, 3), (1, 3), self.amber_light),
            ('BACKGROUND', (2, 3), (3, 3), self.amber_light),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.grey_mid),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t2)
        story.append(Spacer(1, 15))

        # 4. TOP FEATURE INFLUENCES
        story.append(Paragraph("4. TOP FEATURE INFLUENCES", self.heading_style))
        if payload.top_features:
            feature_data = [["Rank", "Feature", "Importance"]]
            for index, feature in enumerate(payload.top_features[:8], start=1):
                feature_data.append([
                    str(index),
                    self._format_optional(feature.get("feature")),
                    self._format_metric(feature.get("importance")),
                ])
            feature_table = Table(feature_data, colWidths=[50, 270, 120])
            feature_table.setStyle(self._table_style(header_bg=self.primary, row_backgrounds=[colors.white, self.primary_light]))
            story.append(feature_table)
        else:
            story.append(Paragraph("No feature influence data was provided for this run.", self.normal_style))
        story.append(Spacer(1, 15))

        # 5. SUBGROUP FAIRNESS ANALYSIS
        story.append(Paragraph("5. SUBGROUP FAIRNESS ANALYSIS", self.heading_style))
        if payload.subgroup_metrics:
            sub_data = [["Subgroup", "N", "Accuracy", "Sensitivity", "Specificity"]]
            for g in payload.subgroup_metrics:
                sub_data.append([
                    g.get("group", "Unknown"),
                    str(g.get("n", 0)),
                    self._format_metric(g.get("accuracy")),
                    self._format_metric(g.get("sensitivity")),
                    self._format_metric(g.get("specificity")),
                ])
            t3 = Table(sub_data, colWidths=[140, 50, 80, 80, 80])
            t3.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.primary),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.grey]),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, self.grey_mid),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(t3)
        else:
            story.append(Paragraph("No subgroup fairness data available.", self.normal_style))
            
        story.append(Spacer(1, 15))

        # 6. BIAS REVIEW & FAIRNESS ANALYSIS
        story.append(Paragraph("6. BIAS REVIEW & FAIRNESS ANALYSIS", self.heading_style))
        story.extend(self._build_bias_review(payload))

        story.append(Spacer(1, 15))

        # 7. FULL COMPLIANCE CHECKLIST
        story.append(Paragraph("7. FULL COMPLIANCE CHECKLIST", self.heading_style))
        if payload.checklist:
            checklist_data = [["Compliance Item", "Status"]]
            checklist_style = [
                ('BACKGROUND', (0, 0), (-1, 0), self.primary),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, self.grey_mid),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]
            for index, item in enumerate(payload.checklist, start=1):
                done = bool(item.get("done"))
                status_text = "Complete" if done else "Pending"
                status_color = "#059669" if done else "#DC2626"
                row_bg = self.green_light if done else self.red_light
                checklist_data.append([
                    Paragraph(str(item.get("label", "Unnamed item")), self.normal_style),
                    Paragraph(f"<font color='{status_color}'><b>{status_text}</b></font>", self.normal_style),
                ])
                checklist_style.append(('BACKGROUND', (1, index), (1, index), row_bg))
                if not done:
                    checklist_style.append(('TEXTCOLOR', (1, index), (1, index), self.red))
                elif index % 2 == 0:
                    checklist_style.append(('BACKGROUND', (0, index), (0, index), self.grey))

            t4 = Table(checklist_data, colWidths=[330, 110])
            t4.setStyle(TableStyle(checklist_style))
            story.append(t4)
        else:
            story.append(Paragraph("No compliance checklist state was provided for this run.", self.normal_style))

        doc.build(story)
        buffer.seek(0)
        return buffer

pdf_service = PdfService()
