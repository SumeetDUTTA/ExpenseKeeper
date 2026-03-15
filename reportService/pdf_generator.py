"""
PDF report generator.
Produces a styled, multi-section A4 PDF that includes:
  • Header bar with brand + month label
  • Four KPI metric cards
  • Side-by-side pie chart (category distribution) and bar chart (category amounts)
  • Weekly spending trend area-line chart
  • Budget bucket adherence horizontal bar chart (if buckets exist)
  • AI narrative sections (all 7 fields)
  • Footer

Dependencies: reportlab, matplotlib, numpy
"""

from __future__ import annotations

import io
import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING

# Non-interactive backend MUST be set before importing pyplot
import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

if TYPE_CHECKING:
    from schemas import GenerateReportRequest, NarrativeOutput

logger = logging.getLogger(__name__)

# ─── Unicode font registration (DejaVu Sans ships with matplotlib) ────────────
_FONTS_REGISTERED = False


def _ensure_unicode_fonts() -> None:
    """Register DejaVu Sans from matplotlib's bundled font directory.

    DejaVu Sans covers the full Unicode BMP including the Indian Rupee sign
    (U+20B9 ₹).  We use matplotlib's copy so no extra font files are needed.
    """
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    font_dir = os.path.join(matplotlib.get_data_path(), "fonts", "ttf")
    regular = os.path.join(font_dir, "DejaVuSans.ttf")
    bold    = os.path.join(font_dir, "DejaVuSans-Bold.ttf")
    try:
        pdfmetrics.registerFont(TTFont("DejaVuSans",      regular))
        pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold))
        pdfmetrics.registerFontFamily(
            "DejaVuSans",
            normal="DejaVuSans",
            bold="DejaVuSans-Bold",
            italic="DejaVuSans",
            boldItalic="DejaVuSans-Bold",
        )
        _FONTS_REGISTERED = True
        logger.debug("DejaVu Sans fonts registered for ReportLab")
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not register DejaVu fonts — rupee sign may not render: %s", exc)

# ─── Colour palette (mirrors frontend Recharts palette) ──────────────────────
_P = colors.HexColor
PRIMARY       = _P("#6366f1")
SECONDARY     = _P("#8b5cf6")
ACCENT        = _P("#10b981")
DANGER        = _P("#ef4444")
WARNING       = _P("#f59e0b")
LIGHT_BG      = _P("#f8fafc")
DARK_TEXT     = _P("#0f172a")
GREY_TEXT     = _P("#64748b")
BORDER        = _P("#e2e8f0")
WARN_BG       = _P("#fffbeb")
WARN_TEXT     = _P("#92400e")

CHART_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
    "#10b981", "#3b82f6", "#f97316", "#06b6d4",
    "#84cc16", "#a8a29e",
]

PAGE_W, PAGE_H = A4  # 595.27 × 841.89 pt


# ─────────────────────────────────────────────────────────────────────────────


class PDFReportGenerator:
    """Stateless PDF generator — call generate() once per report."""

    def generate(
        self,
        request: "GenerateReportRequest",
        narrative: "NarrativeOutput",
        model_info: dict,
    ) -> bytes:
        """Return a complete PDF as raw bytes."""
        _ensure_unicode_fonts()
        buf = io.BytesIO()
        meta = request.reportMeta

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=f"Expense Report — {meta.monthLabel}",
            author="ExpenseKeeper",
            subject=f"Monthly expense analysis for {meta.userName}",
        )

        styles = self._build_styles()
        story: list = []

        # 1 – Header
        story += self._section_header(request, styles)
        story.append(Spacer(1, 5 * mm))

        # 2 – KPI cards
        story += self._section_kpi(request, styles)
        story.append(Spacer(1, 5 * mm))

        # 3 – Pie + bar charts side-by-side
        story += self._section_charts_row(request, styles)
        story.append(Spacer(1, 5 * mm))

        # 4 – Weekly trend
        trend_section = self._section_trend(request, styles)
        if trend_section:
            story += trend_section
            story.append(Spacer(1, 5 * mm))

        # 5 – Budget adherence
        budget_section = self._section_budget_adherence(request, styles)
        if budget_section:
            story += budget_section
            story.append(Spacer(1, 5 * mm))

        # 6 – AI narrative
        story += self._section_narrative(narrative, model_info, request, styles)

        # 7 – Footer
        story.append(Spacer(1, 4 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 2 * mm))
        story.append(
            Paragraph(
                f"Generated by ExpenseKeeper AI  ·  "
                f"{request.reportMeta.monthLabel}  ·  "
                f"Model: {model_info.get('modelName', 'N/A')}",
                styles["footer"],
            )
        )

        doc.build(story)
        return buf.getvalue()

    # ─────────────────────────────────────────────────────────────────────────
    # Section builders
    # ─────────────────────────────────────────────────────────────────────────

    def _section_header(self, request: "GenerateReportRequest", styles: dict) -> list:
        meta = request.reportMeta
        generated = datetime.now().strftime("%d %b %Y, %I:%M %p")
        data = [[
            Paragraph("ExpenseKeeper", styles["brand"]),
            Paragraph(
                f"Monthly Expense Report<br/><font size='9'>{meta.monthLabel}</font>",
                styles["report_title_right"],
            ),
        ]]
        t = Table(data, colWidths=[90 * mm, 90 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
            ("TEXTCOLOR",  (0, 0), (-1, -1), colors.white),
            ("ALIGN",      (0, 0), (0, 0),  "LEFT"),
            ("ALIGN",      (1, 0), (1, 0),  "RIGHT"),
            ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("LEFTPADDING",   (0, 0), (0, -1), 12),
            ("RIGHTPADDING",  (1, 0), (1, -1), 12),
        ]))
        meta_table = Table(
            [[
                Paragraph(f"Prepared for: <b>{meta.userName}</b>", styles["sub_header"]),
                Paragraph(f"Profile: <b>{meta.userType.replace('_', ' ').title()}</b>", styles["sub_header"]),
                Paragraph(f"Timezone: <b>{meta.timezone}</b>", styles["sub_header"]),
                Paragraph(f"Generated: <b>{generated}</b>", styles["sub_header_right"]),
            ]],
            colWidths=[44 * mm, 44 * mm, 44 * mm, 48 * mm],
        )
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        return [t, Spacer(1, 2 * mm), meta_table]

    # ── KPI cards ─────────────────────────────────────────────────────────────

    def _section_kpi(self, request: "GenerateReportRequest", styles: dict) -> list:
        m = request.metrics
        meta = request.reportMeta
        variance = m.budgetVariance
        vs_last = m.periodChange.vsLastMonth

        kpis = [
            ("Total Spent",      f"₹{m.totalSpent:,.0f}",            DARK_TEXT,
             f"{m.transactionCount} transactions"),
            ("Monthly Budget",   f"₹{meta.monthlyBudget:,.0f}",      PRIMARY,
             f"{m.budgetAdherencePercent:.1f}% adherence"),
            ("Budget Variance",  f"₹{variance:+,.0f}",
             ACCENT if variance >= 0 else DANGER,
             "under budget" if variance >= 0 else "over budget"),
            ("vs Last Month",
             f"{vs_last:+.1f}%" if vs_last is not None else "N/A",
             ACCENT if (vs_last or 0) <= 0 else DANGER,
             f"₹{m.dailyAverage:,.0f}/day avg"),
        ]

        cells = []
        for title, value, val_color, subtitle in kpis:
            val_style = ParagraphStyle(
                f"kv_{title}", parent=styles["kpi_value"], textColor=val_color
            )
            inner = Table(
                [
                    [Paragraph(title,    styles["kpi_title"])],
                    [Paragraph(value,    val_style)],
                    [Paragraph(subtitle, styles["kpi_subtitle"])],
                ],
                colWidths=[43 * mm],
            )
            inner.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_BG),
                ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING",    (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING",   (0, 0), (-1, -1), 7),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
            ]))
            cells.append(inner)

        row = Table([cells], colWidths=[45 * mm] * 4)
        row.setStyle(TableStyle([
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 1),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 1),
        ]))
        return [row]

    # ── Charts row (pie + bar) ────────────────────────────────────────────────

    def _section_charts_row(self, request: "GenerateReportRequest", styles: dict) -> list:
        cats = request.metrics.categoryBreakdown
        if not cats:
            return [Paragraph("No category data available.", styles["body"])]

        display_cats = cats[:8]
        labels  = [c.name for c in display_cats]
        amounts = [c.amount for c in display_cats]
        c_colors = CHART_COLORS[:len(labels)]

        # ── Pie chart ────────────────────────────────────────────────────────
        fig_pie, ax_pie = plt.subplots(figsize=(3.9, 3.7))
        wedges, _, autotexts = ax_pie.pie(
            amounts,
            labels=None,
            colors=c_colors,
            autopct="%1.1f%%",
            startangle=140,
            pctdistance=0.76,
            wedgeprops={"linewidth": 0.8, "edgecolor": "white"},
        )
        for at in autotexts:
            at.set_fontsize(7)
        ax_pie.set_title("Category Distribution", fontsize=10, fontweight="bold", pad=8)
        patches = [
            mpatches.Patch(color=c_colors[i], label=labels[i][:16])
            for i in range(len(labels))
        ]
        ax_pie.legend(
            handles=patches, loc="lower center",
            bbox_to_anchor=(0.5, -0.28), ncol=2, fontsize=6.5, frameon=False,
        )
        plt.tight_layout(pad=0.4)
        pie_img = self._fig_to_img(fig_pie, 84 * mm, 78 * mm)
        plt.close(fig_pie)

        # ── Bar chart ────────────────────────────────────────────────────────
        fig_bar, ax_bar = plt.subplots(figsize=(3.9, 3.7))
        short_labels = [n.replace(" & ", "\n& ") for n in labels]
        bars = ax_bar.bar(
            short_labels, amounts, color=c_colors, edgecolor="white", linewidth=0.5
        )
        max_v = max(amounts) if amounts else 1
        for bar, v in zip(bars, amounts):
            ax_bar.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + max_v * 0.02,
                f"₹{v:,.0f}",
                ha="center", va="bottom", fontsize=6, fontweight="bold",
            )
        ax_bar.set_title("Spending by Category (₹)", fontsize=10, fontweight="bold", pad=8)
        ax_bar.set_ylabel("Amount (₹)", fontsize=8)
        ax_bar.yaxis.set_major_formatter(
            plt.FuncFormatter(lambda x, _: f"₹{x:,.0f}")
        )
        ax_bar.tick_params(axis="x", labelsize=6, rotation=25)
        ax_bar.tick_params(axis="y", labelsize=7)
        ax_bar.spines[["top", "right"]].set_visible(False)
        ax_bar.grid(axis="y", alpha=0.3, linewidth=0.5)
        plt.tight_layout(pad=0.4)
        bar_img = self._fig_to_img(fig_bar, 84 * mm, 78 * mm)
        plt.close(fig_bar)

        t = Table([[pie_img, bar_img]], colWidths=[90 * mm, 90 * mm])
        t.setStyle(TableStyle([
            ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        return [t]

    # ── Weekly trend ──────────────────────────────────────────────────────────

    def _section_trend(self, request: "GenerateReportRequest", styles: dict) -> list | None:
        trend = request.chartData.weeklyTrend
        if not trend or len(trend) < 2:
            return None

        labels  = [p.label for p in trend]
        amounts = [p.amount for p in trend]
        max_v   = max(amounts) if amounts else 1

        fig, ax = plt.subplots(figsize=(7.2, 2.5))
        ax.fill_between(labels, amounts, alpha=0.12, color="#6366f1")
        ax.plot(
            labels, amounts,
            color="#6366f1", linewidth=2,
            marker="o", markersize=5,
            markerfacecolor="white", markeredgewidth=2, markeredgecolor="#6366f1",
        )
        for x, y in zip(labels, amounts):
            ax.annotate(
                f"₹{y:,.0f}", (x, y),
                xytext=(0, 9), textcoords="offset points",
                ha="center", fontsize=7, fontweight="bold", color="#374151",
            )
        ax.set_title(
            f"Weekly Spending Trend — {request.reportMeta.monthLabel}",
            fontsize=10, fontweight="bold",
        )
        ax.set_ylabel("Amount (₹)", fontsize=8)
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"₹{x:,.0f}"))
        ax.set_ylim(bottom=0, top=max_v * 1.2)
        ax.tick_params(axis="both", labelsize=8)
        ax.spines[["top", "right"]].set_visible(False)
        ax.grid(axis="y", alpha=0.3, linewidth=0.5)
        plt.tight_layout(pad=0.4)
        img = self._fig_to_img(fig, 180 * mm, 62 * mm)
        plt.close(fig)

        return [
            Paragraph("<b>Weekly Spending Trend</b>", styles["section_title"]),
            Spacer(1, 2 * mm),
            img,
        ]

    # ── Budget adherence ──────────────────────────────────────────────────────

    def _section_budget_adherence(
        self, request: "GenerateReportRequest", styles: dict
    ) -> list | None:
        items = request.metrics.budgetItems
        if not items:
            return None

        names     = [i.name[:22] for i in items]
        allocated = [i.allocated for i in items]
        spent     = [i.spent for i in items]
        bar_h     = 0.35
        y         = np.arange(len(names))
        max_val   = max(allocated + spent) if (allocated + spent) else 1

        fig_h = max(2.0, len(names) * 0.65)
        fig, ax = plt.subplots(figsize=(7.2, fig_h))

        ax.barh(
            y + bar_h / 2, allocated, bar_h,
            label="Allocated", color="#e2e8f0", edgecolor="#cbd5e1", linewidth=0.5,
        )
        spent_colors = [
            "#ef4444" if s > a else "#6366f1"
            for s, a in zip(spent, allocated)
        ]
        spent_bars = ax.barh(
            y - bar_h / 2, spent, bar_h,
            label="Spent", color=spent_colors, edgecolor="white", linewidth=0.5,
        )
        for bar in spent_bars:
            w = bar.get_width()
            if w > 0:
                ax.text(
                    w + max_val * 0.01,
                    bar.get_y() + bar.get_height() / 2,
                    f"₹{w:,.0f}",
                    va="center", fontsize=6.5,
                )

        ax.set_yticks(y)
        ax.set_yticklabels(names, fontsize=8)
        ax.set_xlabel("Amount (₹)", fontsize=8)
        ax.set_title("Budget Bucket Adherence", fontsize=10, fontweight="bold")
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"₹{x:,.0f}"))
        ax.spines[["top", "right"]].set_visible(False)
        ax.legend(fontsize=7, loc="lower right")
        ax.grid(axis="x", alpha=0.3, linewidth=0.5)
        plt.tight_layout(pad=0.4)

        img_h = max(40 * mm, len(names) * 16 * mm)
        img = self._fig_to_img(fig, 180 * mm, img_h)
        plt.close(fig)

        return [
            Paragraph("<b>Budget Bucket Adherence</b>", styles["section_title"]),
            Spacer(1, 2 * mm),
            img,
        ]

    # ── AI narrative ──────────────────────────────────────────────────────────

    def _section_narrative(
        self,
        narrative: "NarrativeOutput",
        model_info: dict,
        request: "GenerateReportRequest",
        styles: dict,
    ) -> list:
        els: list = []
        els.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=4))
        els.append(Paragraph("AI-Generated Insights", styles["section_title"]))
        els.append(Spacer(1, 2 * mm))

        fallback = model_info.get("usedFallback", False)
        model_lbl = model_info.get("modelName", "N/A")
        els.append(
            Paragraph(
                f"<font color='#64748b' size='7'>Analyst engine: {model_lbl}"
                + (" &nbsp;(template mode — provider unavailable)" if fallback else " (LLM)")
                + "</font>",
                styles["body"],
            )
        )
        els.append(Spacer(1, 3 * mm))

        # Prose sections
        for heading, content in [
            ("Executive Summary",  narrative.executive_summary),
            ("Spending Highlights", narrative.spending_highlights),
            ("Budget Insights",    narrative.budget_insights),
        ]:
            els.append(Paragraph(heading, styles["narrative_h"]))
            els.append(Spacer(1, 1 * mm))
            els.append(Paragraph(content, styles["body"]))
            els.append(Spacer(1, 3 * mm))

        # Category analysis
        if narrative.category_analysis:
            block = [
                Paragraph("Category Analysis", styles["narrative_h"]),
                Spacer(1, 1 * mm),
            ]
            for item in narrative.category_analysis:
                block.append(Paragraph(f"- {item}", styles["body_list"]))
            block.append(Spacer(1, 3 * mm))
            els.extend(block)

        # Anomalies
        if narrative.anomalies:
            block = [
                Paragraph("Anomalies Detected", styles["narrative_h"]),
                Spacer(1, 1 * mm),
            ]
            for item in narrative.anomalies:
                block.append(Paragraph(f"Warning: {item}", styles["body_warn"]))
            block.append(Spacer(1, 3 * mm))
            els.extend(block)

        # Recommendations
        if narrative.recommendations:
            block = [
                Paragraph("Recommendations", styles["narrative_h"]),
                Spacer(1, 1 * mm),
            ]
            for i, item in enumerate(narrative.recommendations, 1):
                block.append(Paragraph(f"{i}.  {item}", styles["body_list"]))
            block.append(Spacer(1, 3 * mm))
            els.extend(block)

        # Next month watchouts
        if narrative.next_month_watchouts:
            block = [
                Paragraph("Next Month Watchouts", styles["narrative_h"]),
                Spacer(1, 1 * mm),
            ]
            for item in narrative.next_month_watchouts:
                block.append(Paragraph(f"- {item}", styles["body_list"]))
            els.extend(block)

        return els

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _fig_to_img(fig: plt.Figure, width: float, height: float) -> Image:
        """Convert a matplotlib figure to a reportlab Image at the given pt dimensions."""
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="white")
        buf.seek(0)
        return Image(buf, width=width, height=height)

    @staticmethod
    def _build_styles() -> dict:
        base = getSampleStyleSheet()

        def s(name: str, **kw) -> ParagraphStyle:
            return ParagraphStyle(name, parent=base["Normal"], **kw)

        return {
            "brand": s(
                "brand", fontSize=14, fontName="DejaVuSans-Bold",
                textColor=colors.white, leading=18,
            ),
            "report_title_right": s(
                "rtr", fontSize=11, fontName="DejaVuSans-Bold",
                textColor=colors.white, alignment=TA_RIGHT, leading=16,
            ),
            "sub_header": s(
                "subh", fontSize=7.5, fontName="DejaVuSans", textColor=GREY_TEXT, leading=11,
            ),
            "sub_header_right": s(
                "subhr", fontSize=7.5, fontName="DejaVuSans", textColor=GREY_TEXT, leading=11, alignment=TA_RIGHT,
            ),
            "section_title": s(
                "sect", fontSize=11.5, fontName="DejaVuSans-Bold",
                textColor=DARK_TEXT, spaceBefore=2, leading=15,
            ),
            "narrative_h": s(
                "narh", fontSize=10.5, fontName="DejaVuSans-Bold",
                textColor=PRIMARY, leading=14,
            ),
            "kpi_title": s(
                "kpit", fontSize=7.2, fontName="DejaVuSans", textColor=GREY_TEXT, alignment=TA_LEFT,
            ),
            "kpi_value": s(
                "kpiv", fontSize=13.5, fontName="DejaVuSans-Bold",
                textColor=DARK_TEXT, leading=16,
            ),
            "kpi_subtitle": s(
                "kpis", fontSize=6.8, fontName="DejaVuSans", textColor=GREY_TEXT, alignment=TA_LEFT,
            ),
            "body": s(
                "bodyp", fontSize=9.2, fontName="DejaVuSans", leading=14, textColor=DARK_TEXT,
            ),
            "body_list": s(
                "bodyl", fontSize=9.2, fontName="DejaVuSans", leading=14, textColor=DARK_TEXT, leftIndent=8,
            ),
            "body_warn": s(
                "bodyw", fontSize=9.2, fontName="DejaVuSans", leading=14,
                textColor=WARN_TEXT, leftIndent=8, backColor=WARN_BG,
            ),
            "footer": s(
                "foot", fontSize=7, fontName="DejaVuSans", textColor=GREY_TEXT, alignment=TA_CENTER,
            ),
        }
