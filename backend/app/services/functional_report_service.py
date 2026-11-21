import os
import sys

# Ensure vendor directory is in sys.path if vendored
vendor_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vendor")
if vendor_dir not in sys.path and os.path.isdir(vendor_dir):
    sys.path.insert(0, vendor_dir)

import io
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    Image = None
    ImageDraw = None
    ImageFont = None

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls


# Translations for Word Report
REPORT_I18N = {
    "it": {
        "title": "Report di Architettura Funzionale & Capability Assessment",
        "subtitle": "Valutazione della Copertura IT, Buche Funzionali (Gap), Sovrapposizioni (Overlaps) e Piani di Razionalizzazione",
        "doc_info": "Generato da EasyEA Enterprise Architecture Platform • {date}",
        "workspace_label": "Workspace / Modello: {model_name}",
        "executive_summary_title": "1. Executive Summary & Dashboard Metriche",
        "executive_summary_desc": (
            "Il presente report sintetizza lo stato della copertura applicativa a supporto delle Business Function e "
            "Capability aziendali. L'analisi è condotta a livello atomico (L2), con imputazione automatica dei sistemi "
            "assegnati a eventuali sottofunzioni di dettaglio (L3+). I dati sono calcolati sul modello ArchiMate corrente "
            "integrato con i parametri APM (Application Portfolio Management)."
        ),
        "kpi_coverage": "Tasso di Copertura Funzionale",
        "kpi_coverage_sub": "{covered} su {total} funzioni coperte",
        "kpi_gaps": "Buche Funzionali (Gap)",
        "kpi_gaps_sub": "{count} funzioni senza copertura software",
        "kpi_overlaps": "Tasso di Sovrapposizione",
        "kpi_overlaps_sub": "{count} funzioni servite da ≥ 2 sistemi",
        "kpi_savings": "Risparmio da Razionalizzazione",
        "kpi_savings_sub": "Stima annua da dismissione ridondanze",
        "heatmap_title": "2. Mappa Visuale delle Capability (Heatmap)",
        "heatmap_desc": (
            "Rappresentazione a riquadri (Capability Map) organizzata per Macro-Domini L0 e Raggruppamenti L1. "
            "Ciascun tassello rappresenta un'unità di valutazione L2 con il relativo Functional Fit (1-5), Maturità "
            "Digitale (L1-L5) e le applicazioni a supporto."
        ),
        "heatmap_legend": "Legenda Idoneità Funzionale: Verde = Eccellente (≥4.0) | Ciano = Adeguato (3.0-3.9) | Ambra = Tollerabile (2.0-2.9) | Rosa = Carente (<2.0) / GAP (0.0)",
        "heatmap_image_caption": "Figura 1: Mappa Visuale delle Capability (Heatmap Idoneità Funzionale & Maturità Digitale)",
        "macro_domain_header": "Macro-Dominio L0: {name}",
        "domain_rollup_stats": "Media Fit: {fit}/5.0 • Copertura: {covered}/{total} ({rate}%) • Overlaps: {overlaps} • Buche: {gaps}",
        "no_apps": "Nessuna applicazione (GAP)",
        "gaps_title": "3. Registro delle Buche Funzionali (Gap Analysis)",
        "gaps_desc": (
            "Funzioni di business strategiche prive di copertura software diretta. Queste aree comportano rischi "
            "di inefficienza, errori operativi e dipendenza da strumenti non governati (shadow IT). Richiedono priorità "
            "nei piani di investimento (Make, Buy o adozione SaaS)."
        ),
        "col_gap_function": "Funzione / Capability",
        "col_gap_domain": "Macro-Dominio / Percorso",
        "col_gap_impact": "Descrizione & Rilevanza",
        "col_gap_action": "Azione di Remediation Consigliata",
        "remediation_title": "4. Piano di Razionalizzazione Applicativa (Overlaps)",
        "remediation_desc": (
            "Aree in cui molteplici sistemi erogano funzionalità sovrapposte. Si raccomanda di convergere sul Sistema Target "
            "e avviare il decommissioning controllato dei sistemi candidati alla dismissione per liberare budget operativo."
        ),
        "target_system_label": "Sistema Target Consigliato",
        "decomm_systems_label": "Sistemi Candidati a Dismissione",
        "annual_savings_label": "Risparmio Annuo Stimato: {savings}/anno",
        "appendix_title": "5. Catalogo Gerarchico Completo (Matrice Foglie L2)",
        "appendix_desc": "Inventario tabellare di tutte le funzioni di business analizzate con relative metriche di dettaglio e tracciamento L3+.",
        "col_appx_function": "Funzione",
        "col_appx_level": "Livello",
        "col_appx_path": "Percorso Gerarchico",
        "col_appx_status": "Stato Copertura",
        "col_appx_fit": "Fit / Maturità",
        "col_appx_apps": "Applicazioni a Supporto",
        "col_appx_savings": "Risparmio",
        "status_optimal": "Ottimale (1 App)",
        "status_overlap": "Sovrapposizione ({count} App)",
        "status_gap": "Buca Funzionale (GAP)",
        "imputed_note": "imputata da {child}",
    },
    "en": {
        "title": "Functional Architecture & Capability Assessment Report",
        "subtitle": "Assessment of IT Coverage, Functional Gaps, Application Overlaps, and Rationalization Initiatives",
        "doc_info": "Generated by EasyEA Enterprise Architecture Platform • {date}",
        "workspace_label": "Workspace / Model: {model_name}",
        "executive_summary_title": "1. Executive Summary & Metrics Dashboard",
        "executive_summary_desc": (
            "This report provides an assessment of software coverage supporting business functions and corporate capabilities. "
            "Analysis is evaluated at the atomic L2 level with bottom-up rollup from L3+ sub-functions. "
            "Metrics combine ArchiMate behavioral models with APM (Application Portfolio Management) attributes."
        ),
        "kpi_coverage": "Functional Coverage Rate",
        "kpi_coverage_sub": "{covered} of {total} functions covered",
        "kpi_gaps": "Functional Gaps",
        "kpi_gaps_sub": "{count} functions with zero IT coverage",
        "kpi_overlaps": "Application Overlap Rate",
        "kpi_overlaps_sub": "{count} functions served by ≥ 2 systems",
        "kpi_savings": "Rationalization Opportunity",
        "kpi_savings_sub": "Annual budget recoverable from duplicates",
        "heatmap_title": "2. Visual Capability Map (Heatmap)",
        "heatmap_desc": (
            "Capability map organized by L0 Macro Domains and L1 Domain Groups. "
            "Each tile represents an L2 evaluation unit displaying Functional Fit (1-5), Digital Maturity (L1-L5), "
            "and supporting applications."
        ),
        "heatmap_legend": "Functional Fit Legend: Green = Excellent (≥4.0) | Cyan = Adequate (3.0-3.9) | Amber = Tolerable (2.0-2.9) | Rose = Inadequate (<2.0) / GAP (0.0)",
        "heatmap_image_caption": "Figure 1: Visual Capability Map (Functional Fit & Digital Maturity Heatmap)",
        "macro_domain_header": "L0 Macro Domain: {name}",
        "domain_rollup_stats": "Average Fit: {fit}/5.0 • Coverage: {covered}/{total} ({rate}%) • Overlaps: {overlaps} • Gaps: {gaps}",
        "no_apps": "No applications (GAP)",
        "gaps_title": "3. Functional Gaps Register (Coverage Initiatives)",
        "gaps_desc": (
            "Strategic business functions lacking direct IT application coverage. These gaps present operational risks "
            "and shadow IT proliferation, demanding prioritized investment (Make, Buy, or SaaS)."
        ),
        "col_gap_function": "Function / Capability",
        "col_gap_domain": "Macro Domain / Hierarchy",
        "col_gap_impact": "Description & Relevance",
        "col_gap_action": "Recommended Remediation",
        "remediation_title": "4. Application Rationalization Plan (Overlaps)",
        "remediation_desc": (
            "Areas where multiple systems deliver redundant capabilities. Organizations should converge onto the Target System "
            "and decommission redundant systems to recover operating budget."
        ),
        "target_system_label": "Recommended Target System",
        "decomm_systems_label": "Candidate Decommission Systems",
        "annual_savings_label": "Estimated Annual Savings: {savings}/year",
        "appendix_title": "5. Hierarchical Function Inventory (L2 Leaf Matrix)",
        "appendix_desc": "Tabular inventory of all business functions evaluated with health metrics and L3+ rollup traceability.",
        "col_appx_function": "Function",
        "col_appx_level": "Level",
        "col_appx_path": "Hierarchical Path",
        "col_appx_status": "Coverage Status",
        "col_appx_fit": "Fit / Maturity",
        "col_appx_apps": "Supporting Applications",
        "col_appx_savings": "Savings",
        "status_optimal": "Optimal (1 App)",
        "status_overlap": "Overlapping ({count} Apps)",
        "status_gap": "Functional Gap (0 Apps)",
        "imputed_note": "imputed from {child}",
    }
}


def _format_eur(val: float, lang: str = "it") -> str:
    """Formats numeric euro values consistently."""
    if val <= 0:
        return "€ 0" if lang == "it" else "€0"
    if lang == "it":
        formatted = f"{val:,.0f}".replace(",", ".")
        return f"€ {formatted}"
    else:
        formatted = f"{val:,.0f}"
        return f"€{formatted}"


def _set_cell_background(cell, hex_color: str):
    """Sets background shading of a docx table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)


def _set_cell_padding(cell, top=120, bottom=120, left=150, right=150):
    """Sets cell internal padding in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def _set_cell_left_border(cell, hex_color="4F46E5", size="36"):
    """Sets a prominent left border and clears other borders for callout cards."""
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:left w:val="single" w:sz="{size}" w:space="0" w:color="{hex_color}"/>'
        f'<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)


def _set_table_borders(table, border_color="E2E8F0"):
    """Applies clean subtle borders to a standard table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>'
        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)


class FunctionalReportService:
    @classmethod
    def render_heatmap_diagram(cls, data: Dict[str, Any], lang: str = "it") -> io.BytesIO:
        """
        Generates a high-resolution, multi-column visual Heatmap diagram (PNG)
        directly at backend using Pillow, eliminating any fragile browser dependencies.
        """
        if not HAS_PIL:
            return None

        domains = data.get("heatmap_domains", [])
        leaf_map = {lf.get("id"): lf for lf in data.get("leaf_functions", [])}

        col_width = 360
        col_gap = 25
        margin_x = 35
        start_y = 95
        col_x = [margin_x + i * (col_width + col_gap) for i in range(3)]
        col_y = [start_y, start_y, start_y]

        font_title = ImageFont.load_default(size=17)
        font_sub = ImageFont.load_default(size=11)
        font_dom = ImageFont.load_default(size=12)
        font_dom_sub = ImageFont.load_default(size=10)
        font_grp = ImageFont.load_default(size=11)
        font_tile = ImageFont.load_default(size=11)
        font_pill = ImageFont.load_default(size=10)
        font_apps = ImageFont.load_default(size=9)

        # 1. Precalculate card heights
        card_layouts = []
        for dom in domains:
            groups = dom.get("groups", [])
            if not groups:
                matching = leaf_map.get(dom.get("id"))
                if matching:
                    groups = [{
                        "name": dom.get("name"),
                        "tiles": [{
                            "name": matching.get("name"),
                            "functional_fit": matching.get("functional_fit", 0.0),
                            "is_gap": matching.get("is_gap", False),
                            "applications": matching.get("applications", [])
                        }]
                    }]

            card_h = 42
            for grp in groups:
                if len(groups) > 1 or grp.get("name") != dom.get("name"):
                    card_h += 22
                tiles = grp.get("tiles", [])
                card_h += len(tiles) * 50 + 6
            card_layouts.append((dom, groups, card_h))

        for dom, groups, card_h in card_layouts:
            min_c = col_y.index(min(col_y))
            col_y[min_c] += card_h + 20

        total_h = max(col_y) + 30
        total_w = 1200
        img = Image.new("RGB", (total_w, total_h), color=(248, 250, 252))
        draw = ImageDraw.Draw(img)

        # Header banner
        draw.rectangle([0, 0, total_w, 75], fill=(15, 23, 42))
        draw.text((35, 16), "EASYEA • BUSINESS CAPABILITY & FUNCTIONAL FIT HEATMAP", fill=(255, 255, 255), font=font_title)
        legend_text = (
            "Legenda Fit:  [Eccellente ≥ 4.0]  |  [Adeguato 3.0-3.9]  |  [Tollerabile 2.0-2.9]  |  [GAP / Carente < 2.0]"
            if lang == "it"
            else "Fit Legend:  [Excellent ≥ 4.0]  |  [Adequate 3.0-3.9]  |  [Tolerable 2.0-2.9]  |  [GAP / Inadequate < 2.0]"
        )
        draw.text((35, 46), legend_text, fill=(148, 163, 184), font=font_sub)

        # Draw Cards
        col_y = [start_y, start_y, start_y]
        for dom, groups, card_h in card_layouts:
            min_c = col_y.index(min(col_y))
            cx = col_x[min_c]
            cy = col_y[min_c]

            # Card container
            draw.rounded_rectangle([cx, cy, cx + col_width, cy + card_h], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
            # Header
            draw.rounded_rectangle([cx, cy, cx + col_width, cy + 36], radius=8, fill=(30, 41, 59))
            draw.rectangle([cx, cy + 24, cx + col_width, cy + 36], fill=(30, 41, 59))

            dom_name = dom.get("name", "")
            if len(dom_name) > 28:
                dom_name = dom_name[:26] + "..."
            draw.text((cx + 12, cy + 10), dom_name, fill=(255, 255, 255), font=font_dom)

            rollup = dom.get("rollup", {})
            sub_info = f"Fit {rollup.get('avg_functional_fit', 0.0):.1f} ({rollup.get('covered_leaves', 0)}/{rollup.get('total_leaves', 0)})"
            draw.text((cx + col_width - 95, cy + 12), sub_info, fill=(148, 163, 184), font=font_dom_sub)

            # Groups and Tiles
            cur_y = cy + 44
            for grp in groups:
                if len(groups) > 1 or grp.get("name") != dom.get("name"):
                    grp_name = grp.get("name", "")
                    if len(grp_name) > 34:
                        grp_name = grp_name[:32] + "..."
                    draw.text((cx + 12, cur_y), f"• {grp_name}", fill=(71, 85, 105), font=font_grp)
                    cur_y += 20

                for tile in grp.get("tiles", []):
                    fit = tile.get("functional_fit", 0.0)
                    is_gap = tile.get("is_gap", False)

                    if is_gap or fit == 0.0:
                        bg_col = (255, 241, 242)
                        border_col = (244, 63, 94)
                        pill_bg = (225, 29, 72)
                        pill_txt = "GAP"
                    elif fit >= 4.0:
                        bg_col = (236, 253, 245)
                        border_col = (16, 185, 129)
                        pill_bg = (5, 150, 105)
                        pill_txt = f"★ {fit:.1f}"
                    elif fit >= 3.0:
                        bg_col = (240, 253, 250)
                        border_col = (20, 184, 166)
                        pill_bg = (13, 148, 136)
                        pill_txt = f"★ {fit:.1f}"
                    elif fit >= 2.0:
                        bg_col = (255, 251, 235)
                        border_col = (245, 158, 11)
                        pill_bg = (217, 119, 6)
                        pill_txt = f"★ {fit:.1f}"
                    else:
                        bg_col = (255, 241, 242)
                        border_col = (244, 63, 94)
                        pill_bg = (225, 29, 72)
                        pill_txt = f"★ {fit:.1f}"

                    tx = cx + 10
                    tw = col_width - 20
                    draw.rounded_rectangle([tx, cur_y, tx + tw, cur_y + 44], radius=6, fill=bg_col, outline=border_col, width=1)

                    t_name = tile.get("name", "")
                    if len(t_name) > 30:
                        t_name = t_name[:28] + "..."
                    draw.text((tx + 8, cur_y + 6), t_name, fill=(15, 23, 42), font=font_tile)

                    # Pill on right
                    pw = 46
                    draw.rounded_rectangle([tx + tw - pw - 6, cur_y + 6, tx + tw - 6, cur_y + 22], radius=4, fill=pill_bg)
                    draw.text((tx + tw - pw, cur_y + 8), pill_txt, fill=(255, 255, 255), font=font_pill)

                    # Apps text
                    apps = tile.get("effective_applications", tile.get("applications", []))
                    if apps:
                        app_names = [a.get("app_name", "") for a in apps]
                        apps_txt = ", ".join(app_names)
                        if len(apps_txt) > 38:
                            apps_txt = apps_txt[:36] + "..."
                    else:
                        apps_txt = "Nessun applicativo IT (GAP)" if lang == "it" else "No IT applications (GAP)"
                    draw.text((tx + 8, cur_y + 25), apps_txt, fill=(100, 116, 139), font=font_apps)

                    cur_y += 50
                cur_y += 4

            col_y[min_c] += card_h + 20

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf

    @classmethod
    def generate_docx_report(
        cls,
        data: Dict[str, Any],
        model_name: str = "Enterprise Architecture Model",
        lang: str = "it",
        heatmap_image_base64: Optional[str] = None
    ) -> io.BytesIO:
        """
        Generates a comprehensive Word (.docx) assessment document containing:
        1. Front Cover & Doc Info
        2. Executive Summary & Metrics Dashboard (KPIs)
        3. Capability Fit & Maturity Heatmap (Visual Image + native cell-shaded grid)
        4. Functional Gaps Register & Coverage Initiatives
        5. Application Rationalization & Overlap Remediation Plan
        6. Hierarchical Function Inventory (Leaf Matrix)
        """
        t = REPORT_I18N.get(lang, REPORT_I18N["it"])
        doc = Document()

        # Page Setup: Standard A4 with 1-inch margins
        for section in doc.sections:
            section.page_width = Inches(8.27)
            section.page_height = Inches(11.69)
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

        # Base Normal Style
        normal_style = doc.styles['Normal']
        normal_style.font.name = 'Calibri'
        normal_style.font.size = Pt(10)
        normal_style.font.color.rgb = RGBColor(0x33, 0x41, 0x55)  # Slate-700

        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

        # =====================================================================
        # HEADER & COVER SECTION
        # =====================================================================
        # Pre-title Pill / Tag
        p_tag = doc.add_paragraph()
        p_tag.paragraph_format.space_before = Pt(0)
        p_tag.paragraph_format.space_after = Pt(4)
        run_tag = p_tag.add_run("EASYEA • ENTERPRISE ARCHITECTURE REPORT")
        run_tag.bold = True
        run_tag.font.size = Pt(9)
        run_tag.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)  # Indigo-600

        # Title
        p_title = doc.add_paragraph()
        p_title.paragraph_format.space_before = Pt(0)
        p_title.paragraph_format.space_after = Pt(6)
        run_title = p_title.add_run(t["title"])
        run_title.bold = True
        run_title.font.size = Pt(20)
        run_title.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)  # Slate-900

        # Subtitle
        p_sub = doc.add_paragraph()
        p_sub.paragraph_format.space_before = Pt(0)
        p_sub.paragraph_format.space_after = Pt(12)
        run_sub = p_sub.add_run(t["subtitle"])
        run_sub.font.size = Pt(11)
        run_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate-500

        # Document Meta info box
        meta_table = doc.add_table(rows=1, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_table.autofit = False
        meta_cell_left = meta_table.cell(0, 0)
        meta_cell_right = meta_table.cell(0, 1)
        meta_cell_left.width = Inches(3.8)
        meta_cell_right.width = Inches(2.8)

        _set_cell_background(meta_cell_left, "F8FAFC")
        _set_cell_background(meta_cell_right, "F8FAFC")
        _set_cell_padding(meta_cell_left, top=80, bottom=80, left=120, right=120)
        _set_cell_padding(meta_cell_right, top=80, bottom=80, left=120, right=120)

        p_m1 = meta_cell_left.paragraphs[0]
        p_m1.paragraph_format.space_after = Pt(0)
        r_m1 = p_m1.add_run(t["workspace_label"].format(model_name=model_name))
        r_m1.bold = True
        r_m1.font.size = Pt(9.5)

        p_m2 = meta_cell_right.paragraphs[0]
        p_m2.paragraph_format.space_after = Pt(0)
        p_m2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_m2 = p_m2.add_run(t["doc_info"].format(date=now_str))
        r_m2.font.size = Pt(9)
        r_m2.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        doc.add_paragraph().paragraph_format.space_after = Pt(12)

        # =====================================================================
        # 1. EXECUTIVE SUMMARY & KPI SCORECARDS
        # =====================================================================
        h1 = doc.add_heading(level=1)
        h1.paragraph_format.space_before = Pt(14)
        h1.paragraph_format.space_after = Pt(6)
        r_h1 = h1.add_run(t["executive_summary_title"])
        r_h1.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        r_h1.font.size = Pt(14)

        p_desc1 = doc.add_paragraph(t["executive_summary_desc"])
        p_desc1.paragraph_format.space_after = Pt(12)

        # 4-Column Scorecard Table
        kpi_table = doc.add_table(rows=1, cols=4)
        kpi_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        kpi_table.autofit = False

        kpi_widths = [Inches(1.66), Inches(1.66), Inches(1.66), Inches(1.66)]
        for i, w in enumerate(kpi_widths):
            kpi_table.cell(0, i).width = w

        cov_rate = data.get("coverage_rate_percentage", data.get("overall_coverage_rate", 0.0))
        covered_leaves = data.get("covered_leaf_functions", data.get("covered_leaf_functions_count", 0))
        total_leaves = data.get("total_leaf_functions", 0)
        gap_count = data.get("gap_leaf_functions_count", 0)
        red_rate = data.get("redundancy_rate_percentage", data.get("overall_redundancy_rate", 0.0))
        overlap_count = data.get("overlapping_leaf_functions_count", 0)
        savings = data.get("total_potential_savings", 0.0)

        # KPI 1: Coverage
        c0 = kpi_table.cell(0, 0)
        _set_cell_background(c0, "F0FDF4")  # Light emerald
        _set_cell_padding(c0, top=140, bottom=140, left=120, right=120)
        p_k0 = c0.paragraphs[0]
        p_k0.paragraph_format.space_after = Pt(2)
        r_k0_val = p_k0.add_run(f"{cov_rate:.1f}%")
        r_k0_val.bold = True
        r_k0_val.font.size = Pt(16)
        r_k0_val.font.color.rgb = RGBColor(0x04, 0x78, 0x57)  # Emerald-700
        p_k0_lbl = c0.add_paragraph()
        p_k0_lbl.paragraph_format.space_after = Pt(2)
        r_k0_lbl = p_k0_lbl.add_run(t["kpi_coverage"])
        r_k0_lbl.bold = True
        r_k0_lbl.font.size = Pt(8.5)
        p_k0_sub = c0.add_paragraph()
        p_k0_sub.paragraph_format.space_after = Pt(0)
        r_k0_sub = p_k0_sub.add_run(t["kpi_coverage_sub"].format(
            covered=covered_leaves,
            total=total_leaves
        ))
        r_k0_sub.font.size = Pt(7.5)
        r_k0_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        # KPI 2: Gaps
        c1 = kpi_table.cell(0, 1)
        _set_cell_background(c1, "FFF1F2")  # Light rose
        _set_cell_padding(c1, top=140, bottom=140, left=120, right=120)
        p_k1 = c1.paragraphs[0]
        p_k1.paragraph_format.space_after = Pt(2)
        r_k1_val = p_k1.add_run(str(gap_count))
        r_k1_val.bold = True
        r_k1_val.font.size = Pt(16)
        r_k1_val.font.color.rgb = RGBColor(0xBE, 0x12, 0x3C)  # Rose-700
        p_k1_lbl = c1.add_paragraph()
        p_k1_lbl.paragraph_format.space_after = Pt(2)
        r_k1_lbl = p_k1_lbl.add_run(t["kpi_gaps"])
        r_k1_lbl.bold = True
        r_k1_lbl.font.size = Pt(8.5)
        p_k1_sub = c1.add_paragraph()
        p_k1_sub.paragraph_format.space_after = Pt(0)
        r_k1_sub = p_k1_sub.add_run(t["kpi_gaps_sub"].format(count=gap_count))
        r_k1_sub.font.size = Pt(7.5)
        r_k1_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        # KPI 3: Overlaps
        c2 = kpi_table.cell(0, 2)
        _set_cell_background(c2, "FFFBEB")  # Light amber
        _set_cell_padding(c2, top=140, bottom=140, left=120, right=120)
        p_k2 = c2.paragraphs[0]
        p_k2.paragraph_format.space_after = Pt(2)
        r_k2_val = p_k2.add_run(f"{red_rate:.1f}%")
        r_k2_val.bold = True
        r_k2_val.font.size = Pt(16)
        r_k2_val.font.color.rgb = RGBColor(0xB4, 0x53, 0x09)  # Amber-700
        p_k2_lbl = c2.add_paragraph()
        p_k2_lbl.paragraph_format.space_after = Pt(2)
        r_k2_lbl = p_k2_lbl.add_run(t["kpi_overlaps"])
        r_k2_lbl.bold = True
        r_k2_lbl.font.size = Pt(8.5)
        p_k2_sub = c2.add_paragraph()
        p_k2_sub.paragraph_format.space_after = Pt(0)
        r_k2_sub = p_k2_sub.add_run(t["kpi_overlaps_sub"].format(count=overlap_count))
        r_k2_sub.font.size = Pt(7.5)
        r_k2_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        # KPI 4: Savings
        c3 = kpi_table.cell(0, 3)
        _set_cell_background(c3, "ECFDF5")  # Emerald-50
        _set_cell_padding(c3, top=140, bottom=140, left=120, right=120)
        p_k3 = c3.paragraphs[0]
        p_k3.paragraph_format.space_after = Pt(2)
        r_k3_val = p_k3.add_run(_format_eur(savings, lang=lang))
        r_k3_val.bold = True
        r_k3_val.font.size = Pt(14)
        r_k3_val.font.color.rgb = RGBColor(0x05, 0x96, 0x69)  # Emerald-600
        p_k3_lbl = c3.add_paragraph()
        p_k3_lbl.paragraph_format.space_after = Pt(2)
        r_k3_lbl = p_k3_lbl.add_run(t["kpi_savings"])
        r_k3_lbl.bold = True
        r_k3_lbl.font.size = Pt(8.5)
        p_k3_sub = c3.add_paragraph()
        p_k3_sub.paragraph_format.space_after = Pt(0)
        r_k3_sub = p_k3_sub.add_run(t["kpi_savings_sub"])
        r_k3_sub.font.size = Pt(7.5)
        r_k3_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        doc.add_paragraph().paragraph_format.space_after = Pt(12)

        # =====================================================================
        # 2. CAPABILITY FIT & MATURITY HEATMAP (NATIVE DOCX GRID)
        # =====================================================================
        h2 = doc.add_heading(level=1)
        h2.paragraph_format.space_before = Pt(16)
        h2.paragraph_format.space_after = Pt(6)
        r_h2 = h2.add_run(t["heatmap_title"])
        r_h2.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        r_h2.font.size = Pt(14)

        p_desc2 = doc.add_paragraph(t["heatmap_desc"])
        p_desc2.paragraph_format.space_after = Pt(4)

        p_legend = doc.add_paragraph(t["heatmap_legend"])
        p_legend.paragraph_format.space_after = Pt(12)
        p_legend.runs[0].font.size = Pt(8.5)
        p_legend.runs[0].font.italic = True
        p_legend.runs[0].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        # 2.A Visual Heatmap Diagram Image (Autonomously generated at backend via Pillow)
        try:
            diag_stream = cls.render_heatmap_diagram(data, lang=lang)
            if diag_stream and len(diag_stream.getvalue()) > 500:
                p_img = doc.add_paragraph()
                p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_img.paragraph_format.space_before = Pt(8)
                p_img.paragraph_format.space_after = Pt(4)
                doc.add_picture(diag_stream, width=Inches(6.67))
                p_cap = doc.add_paragraph(t["heatmap_image_caption"])
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.paragraph_format.space_after = Pt(14)
                p_cap.runs[0].font.size = Pt(8.5)
                p_cap.runs[0].font.italic = True
                p_cap.runs[0].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        except Exception:
            pass

        # 2.B Structured Native Grid of Domains, Groups and Tiles
        heatmap_domains = data.get("heatmap_domains", [])
        for domain in heatmap_domains:
            # Macro Domain Header Bar
            dom_table = doc.add_table(rows=1, cols=1)
            dom_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            dom_table.autofit = False
            dom_cell = dom_table.cell(0, 0)
            dom_cell.width = Inches(6.67)
            _set_cell_background(dom_cell, "1E293B")  # Slate-800 dark bar
            _set_cell_padding(dom_cell, top=100, bottom=100, left=140, right=140)

            p_dom = dom_cell.paragraphs[0]
            p_dom.paragraph_format.space_after = Pt(2)
            r_dom_title = p_dom.add_run(t["macro_domain_header"].format(name=domain.get("name")))
            r_dom_title.bold = True
            r_dom_title.font.size = Pt(11)
            r_dom_title.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            # Rollup stats on domain
            rollup = domain.get("rollup", {})
            p_dom_sub = dom_cell.add_paragraph()
            p_dom_sub.paragraph_format.space_after = Pt(0)
            r_dom_sub = p_dom_sub.add_run(t["domain_rollup_stats"].format(
                fit=rollup.get("avg_functional_fit", 0.0),
                covered=rollup.get("covered_leaves", 0),
                total=rollup.get("total_leaves", 0),
                rate=rollup.get("coverage_rate", 0),
                overlaps=rollup.get("overlapping_leaves", 0),
                gaps=rollup.get("gap_leaves", 0),
            ))
            r_dom_sub.font.size = Pt(8.5)
            r_dom_sub.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)  # Slate-400

            # L1 Groups and L2 Tiles inside domain
            groups = domain.get("groups", [])
            if not groups:
                # Isolated root capability: find matching leaf and treat as tile
                matching_leaf = next((lf for lf in data.get("leaf_functions", []) if lf.get("id") == domain.get("id")), None)
                if matching_leaf:
                    groups = [{
                        "id": f"{domain.get('id')}-single",
                        "name": domain.get("name"),
                        "tiles": [{
                            "name": matching_leaf.get("name"),
                            "functional_fit": matching_leaf.get("functional_fit", 0.0),
                            "maturity_level": matching_leaf.get("maturity_level", 1),
                            "is_gap": matching_leaf.get("is_gap", False),
                            "is_overlapping": matching_leaf.get("is_overlapping", False),
                            "effective_applications": [
                                {"app_name": a.get("app_name")} for a in matching_leaf.get("applications", [])
                            ]
                        }]
                    }]

            for grp in groups:
                p_grp = doc.add_paragraph()
                p_grp.paragraph_format.space_before = Pt(8)
                p_grp.paragraph_format.space_after = Pt(4)
                r_grp = p_grp.add_run(f"• {grp.get('name')}")
                r_grp.bold = True
                r_grp.font.size = Pt(10)
                r_grp.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

                tiles = grp.get("tiles", [])
                if not tiles:
                    continue

                # Grid of tiles: 2 tiles per row
                row_count = (len(tiles) + 1) // 2
                tile_table = doc.add_table(rows=row_count, cols=2)
                tile_table.alignment = WD_TABLE_ALIGNMENT.CENTER
                tile_table.autofit = False

                for r_idx in range(row_count):
                    for c_idx in range(2):
                        t_idx = r_idx * 2 + c_idx
                        cell = tile_table.cell(r_idx, c_idx)
                        cell.width = Inches(3.33)
                        _set_cell_padding(cell, top=100, bottom=100, left=120, right=120)

                        if t_idx < len(tiles):
                            tile = tiles[t_idx]
                            fit = tile.get("functional_fit", 0.0)
                            is_gap = tile.get("is_gap", False)
                            is_overlap = tile.get("is_overlapping", False)

                            # Determine tile color
                            if is_gap or fit == 0.0:
                                bg_hex = "FFE4E6"  # Rose-100
                                border_hex = "F43F5E"
                                status_text = "GAP"
                            elif fit >= 4.0:
                                bg_hex = "D1FAE5"  # Emerald-100
                                border_hex = "10B981"
                                status_text = f"Fit {fit:.1f}"
                            elif fit >= 3.0:
                                bg_hex = "CCFBF1"  # Teal-100
                                border_hex = "14B8A6"
                                status_text = f"Fit {fit:.1f}"
                            elif fit >= 2.0:
                                bg_hex = "FEF3C7"  # Amber-100
                                border_hex = "F59E0B"
                                status_text = f"Fit {fit:.1f}"
                            else:
                                bg_hex = "FFE4E6"  # Rose-100
                                border_hex = "F43F5E"
                                status_text = f"Fit {fit:.1f}"

                            _set_cell_background(cell, bg_hex)
                            _set_cell_left_border(cell, hex_color=border_hex, size="24")

                            p_t1 = cell.paragraphs[0]
                            p_t1.paragraph_format.space_after = Pt(2)
                            r_t_name = p_t1.add_run(tile.get("name", ""))
                            r_t_name.bold = True
                            r_t_name.font.size = Pt(9.5)

                            # Subline: Fit & Maturity
                            p_t2 = cell.add_paragraph()
                            p_t2.paragraph_format.space_after = Pt(2)
                            r_t_pill = p_t2.add_run(f"[{status_text}] • Mat. L{tile.get('maturity_level', 1)}")
                            r_t_pill.bold = True
                            r_t_pill.font.size = Pt(8)
                            r_t_pill.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

                            # Applications summary
                            eff_apps = tile.get("effective_applications", [])
                            p_t3 = cell.add_paragraph()
                            p_t3.paragraph_format.space_after = Pt(0)
                            if not eff_apps:
                                r_t_apps = p_t3.add_run(t["no_apps"])
                                r_t_apps.font.italic = True
                                r_t_apps.font.size = Pt(8)
                                r_t_apps.font.color.rgb = RGBColor(0xBE, 0x12, 0x3C)
                            else:
                                app_names = [a.get("app_name") for a in eff_apps]
                                r_t_apps = p_t3.add_run(", ".join(app_names))
                                r_t_apps.font.size = Pt(8)
                                r_t_apps.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
                        else:
                            # Empty balancing cell
                            _set_cell_background(cell, "FFFFFF")

                doc.add_paragraph().paragraph_format.space_after = Pt(6)

        # =====================================================================
        # 3. FUNCTIONAL GAPS REGISTER (BUCHE FUNZIONALI)
        # =====================================================================
        h3 = doc.add_heading(level=1)
        h3.paragraph_format.space_before = Pt(16)
        h3.paragraph_format.space_after = Pt(6)
        r_h3 = h3.add_run(t["gaps_title"])
        r_h3.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        r_h3.font.size = Pt(14)

        p_desc3 = doc.add_paragraph(t["gaps_desc"])
        p_desc3.paragraph_format.space_after = Pt(10)

        gap_clusters = data.get("gap_clusters", [])
        if not gap_clusters:
            p_none = doc.add_paragraph("Nessuna buca funzionale rilevata. Tutte le capability hanno copertura software." if lang == "it" else "No functional gaps detected. All capabilities are supported by IT.")
            p_none.runs[0].font.italic = True
        else:
            for gap in gap_clusters:
                # Callout card for each gap
                g_table = doc.add_table(rows=1, cols=1)
                g_table.alignment = WD_TABLE_ALIGNMENT.CENTER
                g_table.autofit = False
                g_cell = g_table.cell(0, 0)
                g_cell.width = Inches(6.67)

                _set_cell_background(g_cell, "FFF5F5")  # Ultra light red
                _set_cell_left_border(g_cell, hex_color="E11D48", size="36")
                _set_cell_padding(g_cell, top=100, bottom=100, left=140, right=140)

                p_g1 = g_cell.paragraphs[0]
                p_g1.paragraph_format.space_after = Pt(2)
                r_g1_badge = p_g1.add_run(f"[{gap.get('level_label', 'L2')}] GAP: ")
                r_g1_badge.bold = True
                r_g1_badge.font.size = Pt(10)
                r_g1_badge.font.color.rgb = RGBColor(0xBE, 0x12, 0x3C)
                r_g1_name = p_g1.add_run(gap.get("leaf_name", ""))
                r_g1_name.bold = True
                r_g1_name.font.size = Pt(10.5)

                p_g2 = g_cell.add_paragraph()
                p_g2.paragraph_format.space_after = Pt(3)
                r_g2_path = p_g2.add_run(gap.get("path", ""))
                r_g2_path.font.size = Pt(8.5)
                r_g2_path.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

                if gap.get("documentation"):
                    p_g3 = g_cell.add_paragraph()
                    p_g3.paragraph_format.space_after = Pt(3)
                    r_g3_doc = p_g3.add_run(gap.get("documentation", ""))
                    r_g3_doc.font.size = Pt(9)
                    r_g3_doc.font.italic = True

                p_g4 = g_cell.add_paragraph()
                p_g4.paragraph_format.space_after = Pt(0)
                r_g4_rec = p_g4.add_run(f"➔ {gap.get('recommendation', '')}")
                r_g4_rec.bold = True
                r_g4_rec.font.size = Pt(9)
                r_g4_rec.font.color.rgb = RGBColor(0x9F, 0x12, 0x39)  # Rose-800

                doc.add_paragraph().paragraph_format.space_after = Pt(6)

        # =====================================================================
        # 4. APPLICATION RATIONALIZATION & OVERLAPPING REMEDIATION
        # =====================================================================
        h4 = doc.add_heading(level=1)
        h4.paragraph_format.space_before = Pt(16)
        h4.paragraph_format.space_after = Pt(6)
        r_h4 = h4.add_run(t["remediation_title"])
        r_h4.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        r_h4.font.size = Pt(14)

        p_desc4 = doc.add_paragraph(t["remediation_desc"])
        p_desc4.paragraph_format.space_after = Pt(10)

        redundancy_clusters = data.get("redundancy_clusters", [])
        if not redundancy_clusters:
            p_none_ov = doc.add_paragraph("Nessuna sovrapposizione applicativa rilevata. Portfolio snello e privo di ridondanze." if lang == "it" else "No application overlaps detected. Lean application portfolio.")
            p_none_ov.runs[0].font.italic = True
        else:
            for cluster in redundancy_clusters:
                # 2-column rationalization box
                r_table = doc.add_table(rows=2, cols=2)
                r_table.alignment = WD_TABLE_ALIGNMENT.CENTER
                r_table.autofit = False

                # Row 0: Full width banner for function
                cell_top = r_table.cell(0, 0)
                cell_top_right = r_table.cell(0, 1)
                cell_top.merge(cell_top_right)
                cell_top.width = Inches(6.67)

                _set_cell_background(cell_top, "FFFBEB")  # Light amber
                _set_cell_left_border(cell_top, hex_color="D97706", size="36")
                _set_cell_padding(cell_top, top=100, bottom=100, left=140, right=140)

                p_rt = cell_top.paragraphs[0]
                p_rt.paragraph_format.space_after = Pt(2)
                r_rt_title = p_rt.add_run(f"Cluster Ridondanza: {cluster.get('leaf_name')} ({cluster.get('app_count')} Sistemi)")
                r_rt_title.bold = True
                r_rt_title.font.size = Pt(10.5)

                p_rt_path = cell_top.add_paragraph()
                p_rt_path.paragraph_format.space_after = Pt(0)
                r_rt_path = p_rt_path.add_run(f"{cluster.get('path')} • ")
                r_rt_path.font.size = Pt(8.5)
                r_rt_path.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
                r_rt_sav = p_rt_path.add_run(t["annual_savings_label"].format(
                    savings=_format_eur(cluster.get("potential_savings", 0.0), lang=lang)
                ))
                r_rt_sav.bold = True
                r_rt_sav.font.size = Pt(8.5)
                r_rt_sav.font.color.rgb = RGBColor(0x05, 0x96, 0x69)

                # Row 1 Left: Target System
                cell_target = r_table.cell(1, 0)
                cell_target.width = Inches(3.33)
                _set_cell_background(cell_target, "F0FDF4")  # Light green
                _set_cell_padding(cell_target, top=100, bottom=100, left=120, right=120)

                p_tg_lbl = cell_target.paragraphs[0]
                p_tg_lbl.paragraph_format.space_after = Pt(2)
                r_tg_lbl = p_tg_lbl.add_run(f"✓ {t['target_system_label']}:")
                r_tg_lbl.bold = True
                r_tg_lbl.font.size = Pt(9)
                r_tg_lbl.font.color.rgb = RGBColor(0x04, 0x78, 0x57)

                target_app = cluster.get("target_app") or {}
                p_tg_val = cell_target.add_paragraph()
                p_tg_val.paragraph_format.space_after = Pt(0)
                r_tg_val = p_tg_val.add_run(f"{target_app.get('app_name', 'N/A')} ({target_app.get('time_quadrant', 'Invest')})\nCosto: {_format_eur(target_app.get('annual_cost', 0.0), lang=lang)}")
                r_tg_val.font.size = Pt(8.5)

                # Row 1 Right: Decommission Candidates
                cell_decomm = r_table.cell(1, 1)
                cell_decomm.width = Inches(3.33)
                _set_cell_background(cell_decomm, "FFF1F2")  # Light red
                _set_cell_padding(cell_decomm, top=100, bottom=100, left=120, right=120)

                p_dc_lbl = cell_decomm.paragraphs[0]
                p_dc_lbl.paragraph_format.space_after = Pt(2)
                r_dc_lbl = p_dc_lbl.add_run(f"✗ {t['decomm_systems_label']}:")
                r_dc_lbl.bold = True
                r_dc_lbl.font.size = Pt(9)
                r_dc_lbl.font.color.rgb = RGBColor(0xBE, 0x12, 0x3C)

                decomm_apps = cluster.get("candidate_decommissions", [])
                p_dc_val = cell_decomm.add_paragraph()
                p_dc_val.paragraph_format.space_after = Pt(0)
                decomm_lines = [
                    f"• {a.get('app_name')} ({_format_eur(a.get('annual_cost', 0.0), lang=lang)})"
                    for a in decomm_apps
                ]
                r_dc_val = p_dc_val.add_run("\n".join(decomm_lines) if decomm_lines else "N/A")
                r_dc_val.font.size = Pt(8.5)

                doc.add_paragraph().paragraph_format.space_after = Pt(6)

        # =====================================================================
        # 5. HIERARCHICAL FUNCTION INVENTORY (LEAF MATRIX TABLE)
        # =====================================================================
        h5 = doc.add_heading(level=1)
        h5.paragraph_format.space_before = Pt(16)
        h5.paragraph_format.space_after = Pt(6)
        r_h5 = h5.add_run(t["appendix_title"])
        r_h5.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        r_h5.font.size = Pt(14)

        p_desc5 = doc.add_paragraph(t["appendix_desc"])
        p_desc5.paragraph_format.space_after = Pt(10)

        leaves = data.get("leaf_functions", data.get("leaf_rows", []))
        if leaves:
            col_widths = [Inches(1.6), Inches(0.6), Inches(1.8), Inches(1.1), Inches(0.8), Inches(0.8)]
            appx_table = doc.add_table(rows=1, cols=6)
            appx_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            appx_table.autofit = False
            _set_table_borders(appx_table)

            # Table Header
            headers = [
                t["col_appx_function"],
                t["col_appx_level"],
                t["col_appx_path"],
                t["col_appx_status"],
                t["col_appx_fit"],
                t["col_appx_savings"]
            ]
            hdr_cells = appx_table.rows[0].cells
            for idx, text in enumerate(headers):
                hdr_cells[idx].width = col_widths[idx]
                _set_cell_background(hdr_cells[idx], "0F172A")  # Slate-900
                _set_cell_padding(hdr_cells[idx], top=80, bottom=80, left=100, right=100)
                p = hdr_cells[idx].paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8.5)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            # Data Rows
            for l_idx, leaf in enumerate(leaves):
                row_cells = appx_table.add_row().cells
                is_zebra = (l_idx % 2 == 1)
                bg_row = "F8FAFC" if is_zebra else "FFFFFF"

                for c_idx in range(6):
                    row_cells[c_idx].width = col_widths[c_idx]
                    _set_cell_background(row_cells[c_idx], bg_row)
                    _set_cell_padding(row_cells[c_idx], top=60, bottom=60, left=100, right=100)

                # Col 0: Function Name + apps list
                p0 = row_cells[0].paragraphs[0]
                p0.paragraph_format.space_after = Pt(1)
                r0 = p0.add_run(leaf.get("name", ""))
                r0.bold = True
                r0.font.size = Pt(8.5)

                apps = leaf.get("applications", [])
                if apps:
                    p0_apps = row_cells[0].add_paragraph()
                    p0_apps.paragraph_format.space_after = Pt(0)
                    app_sub_text = ", ".join([
                        f"{a.get('app_name')}{' (L3+)' if a.get('is_imputed_from_child') else ''}"
                        for a in apps
                    ])
                    r0_apps = p0_apps.add_run(app_sub_text)
                    r0_apps.font.size = Pt(7.5)
                    r0_apps.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

                # Col 1: Level
                p1 = row_cells[1].paragraphs[0]
                p1.paragraph_format.space_after = Pt(0)
                r1 = p1.add_run(leaf.get("level_label", "L2"))
                r1.font.size = Pt(8)

                # Col 2: Path
                p2 = row_cells[2].paragraphs[0]
                p2.paragraph_format.space_after = Pt(0)
                r2 = p2.add_run(leaf.get("path", ""))
                r2.font.size = Pt(8)
                r2.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

                # Col 3: Status
                p3 = row_cells[3].paragraphs[0]
                p3.paragraph_format.space_after = Pt(0)
                if leaf.get("is_gap"):
                    r3 = p3.add_run(t["status_gap"])
                    r3.bold = True
                    r3.font.size = Pt(8)
                    r3.font.color.rgb = RGBColor(0xBE, 0x12, 0x3C)
                elif leaf.get("is_overlapping"):
                    r3 = p3.add_run(t["status_overlap"].format(count=leaf.get("app_count", 2)))
                    r3.bold = True
                    r3.font.size = Pt(8)
                    r3.font.color.rgb = RGBColor(0xB4, 0x53, 0x09)
                else:
                    r3 = p3.add_run(t["status_optimal"])
                    r3.font.size = Pt(8)
                    r3.font.color.rgb = RGBColor(0x04, 0x78, 0x57)

                # Col 4: Fit & Maturity
                p4 = row_cells[4].paragraphs[0]
                p4.paragraph_format.space_after = Pt(0)
                if leaf.get("is_gap"):
                    r4 = p4.add_run("-")
                    r4.font.size = Pt(8)
                else:
                    fit_val = leaf.get("functional_fit", 0.0)
                    mat_val = leaf.get("maturity_level", 1)
                    r4 = p4.add_run(f"★ {fit_val:.1f} • L{mat_val}")
                    r4.bold = True
                    r4.font.size = Pt(8)

                # Col 5: Savings
                p5 = row_cells[5].paragraphs[0]
                p5.paragraph_format.space_after = Pt(0)
                sav = leaf.get("potential_savings", 0.0)
                if sav > 0:
                    r5 = p5.add_run(_format_eur(sav, lang=lang))
                    r5.bold = True
                    r5.font.size = Pt(8)
                    r5.font.color.rgb = RGBColor(0x05, 0x96, 0x69)
                else:
                    r5 = p5.add_run("-")
                    r5.font.size = Pt(8)
                    r5.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

        # Save to BytesIO
        output_stream = io.BytesIO()
        doc.save(output_stream)
        output_stream.seek(0)
        return output_stream
