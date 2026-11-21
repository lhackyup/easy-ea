import os
import sys
import io
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
from docx.enum.section import WD_SECTION_START, WD_ORIENTATION
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls


# Translations for APM Word Report (Italian and English)
REPORT_I18N = {
    "it": {
        "title": "Report Strategico di Portafoglio Applicativo (APM)",
        "subtitle": "Valutazione TIME Matrix, Rischio Tecnologico, TCO, Interfacce e Roadmap di Ciclo di Vita",
        "doc_info": "Generato da EasyEA Enterprise Architecture Platform • {date}",
        "workspace_label": "Workspace / Modello: {model_name}",
        "pre_title_tag": "EASYEA • APPLICATION PORTFOLIO MANAGEMENT (APM)",

        # Section 1: Executive Summary
        "sec1_title": "1. Executive Summary & Dashboard KPI del Portafoglio",
        "sec1_desc": (
            "Il presente report offre una vista esecutiva e consolidata sul portafoglio delle Business Application aziendali. "
            "L'analisi integra i dati dell'architettura applicativa ArchiMate con le metriche strategiche di Application Portfolio Management: "
            "razionalizzazione secondo la matrice Gartner TIME, analisi economica del Total Cost of Ownership (TCO), mappa dei rischi di obsolescenza "
            "tecnologica (conformità DORA / NIS2), inventario delle interfacce/flussi di integrazione e piano di dismissione controllata."
        ),
        "kpi_total_apps": "Business Applications",
        "kpi_total_apps_sub": "{in_scope} in perimetro APM",
        "kpi_total_tco": "TCO Annuo Totale",
        "kpi_total_tco_sub": "Capex {capex_pct}% • Opex {opex_pct}%",
        "kpi_rationalization": "Potenziale di Risparmio",
        "kpi_rationalization_sub": "{waste_cost} da {waste_count} app in Eliminate",
        "kpi_tech_risk": "Rischio Tecnologico",
        "kpi_tech_risk_sub": "{risk_count} app critiche • {dora_count} alert DORA",

        # Section 2: TIME Matrix
        "sec2_title": "2. Strategia di Portafoglio: Matrice Gartner TIME",
        "sec2_desc": (
            "La matrice Gartner TIME posiziona le applicazioni su due assi fondamentali: Idoneità Funzionale (Business Fit) "
            "e Idoneità Tecnica (Technical Fit). La classificazione nei 4 quadranti guida le decisioni di investimento, "
            "modernizzazione o dismissione del software aziendale."
        ),
        "time_image_caption": "Figura 1: Matrice Strategica Gartner TIME — Distribuzione del Valore di Business e Idoneità Tecnica (EasyEA Engine)",
        "time_col_quadrant": "Quadrante TIME",
        "time_col_strategy": "Orientamento Strategico",
        "time_col_count": "Numero App",
        "time_col_cost": "Costo Totale (€/anno)",
        "time_col_pct": "% Spesa TCO",
        "time_col_action": "Azione Raccomandata",
        "time_invest_desc": "Valore di business elevato e tecnologia moderna. Priorità per espansione ed innovazione.",
        "time_tolerate_desc": "Valore elevato ma architettura legacy/complessa. Mantenimento con contenimento dei costi.",
        "time_migrate_desc": "Basso valore o ridondante, ma tecnologia valida. Candidato a convergenza o refactoring.",
        "time_eliminate_desc": "Basso valore di business e debito tecnico elevato. Priorità assoluta di decommissioning.",

        "time_action_table_title": "Applicazioni con Priorità di Razionalizzazione (Quadranti Eliminate & Migrate)",
        "time_action_table_desc": "Sistemi candidati alla dismissione o alla migrazione/consolidamento funzionale:",
        "col_app_name": "Applicazione",
        "col_owner": "Business Owner",
        "col_tech_owner": "Technical Owner",
        "col_b_fit": "Fit Business",
        "col_t_fit": "Fit Tecnico",
        "col_cost": "Costo Annuo",
        "col_priority_action": "Azione di Razionalizzazione",

        # Section 3: Tech Risk
        "sec3_title": "3. Rischio Tecnologico & Obsolescenza (Tech Risk & DORA Radar)",
        "sec3_desc": (
            "Mappatura delle dipendenze tra il livello applicativo e l'infrastruttura tecnologica sottostante (sistemi operativi, DBMS, runtime, middleware). "
            "Il monitoraggio delle date di End-of-Life (EOL) e End-of-Support (EOS) dei vendor è cruciale per la mitigazione dei rischi di sicurezza e per la resilienza operativa richiesta da normative come DORA e NIS2."
        ),
        "dora_table_title": "Registro Allarmi di Conformità Normativa (DORA / NIS2)",
        "dora_table_desc": "Applicazioni a criticità Mission o Business Critical esposte su componenti tecnologici obsoleti:",
        "dora_no_alerts": "Nessun allarme critico rilevato: tutti i sistemi Mission e Business Critical risultano supportati da stack tecnologici validi.",
        "col_dora_app": "Applicazione Critica",
        "col_dora_criticality": "Criticità di Business",
        "col_dora_risk": "Livello Rischio",
        "col_dora_obsolete": "Componenti Tecnologici EOL",
        "col_dora_reason": "Dettaglio / Rischio Regolatorio",

        "tech_risk_table_title": "Top Applicazioni a Rischio Tecnologico Elevato",
        "col_risk_app": "Applicazione",
        "col_risk_level": "Rischio",
        "col_risk_obsolete_count": "Tech Obsolete",
        "col_risk_next_eol": "Prossimo EOL",
        "col_risk_details": "Componenti Tecnologici Impattati",

        # Section 4: TCO Breakdown
        "sec4_title": "4. Analisi Economica & Total Cost of Ownership (TCO)",
        "sec4_desc": (
            "Scomposizione dei costi operativi e di capitale del parco applicativo. L'analisi identifica le principali voci di spesa "
            "(licenze, infrastruttura cloud, manutenzione e risorse interne) e la concentrazione del budget IT sui sistemi core."
        ),
        "tco_cost_category": "Categoria di Spesa",
        "tco_amount": "Importo Annuo",
        "tco_pct": "% sul Totale TCO",
        "cat_licenses": "Licenze Software & Canoni",
        "cat_cloud": "Infrastruttura & Hosting Cloud",
        "cat_maintenance": "Manutenzione & Supporto Vendor",
        "cat_labor": "Risorse Interne & Operations",
        "cat_capex": "Spese in Conto Capitale (Capex)",
        "cat_opex": "Spese Operative Correnti (Opex)",

        "top_cost_table_title": "Top Cost Drivers (Prime 10 Applicazioni per Spesa Annua)",
        "col_rank": "#",
        "col_top_app": "Applicazione",
        "col_top_cost": "TCO Annuo",
        "col_top_pct": "% Budget IT",
        "col_top_quadrant": "Quadrante TIME",
        "col_top_users": "Utenti Attivi",

        # Section 5: Interface Inventory
        "sec5_title": "5. Catalogo Interfacce & Flussi di Integrazione",
        "sec5_desc": (
            "Inventario completo delle connessioni e dei flussi di scambio dati tra applicazioni. Il censimento traccia protocolli (REST, SOAP, Kafka, SFTP, DB Link), "
            "pattern architetturali e la classificazione di riservatezza delle informazioni trasmesse (GDPR / PII)."
        ),
        "col_iface_name": "Interfaccia / Flusso",
        "col_iface_source": "App Sorgente",
        "col_iface_target": "App Destinazione",
        "col_iface_protocol": "Protocollo",
        "col_iface_pattern": "Pattern",
        "col_iface_data": "Classificazione Dati",
        "col_iface_status": "Stato Operativo",
        "iface_no_data": "Nessuna interfaccia o flusso registrato nel modello corrente.",

        # Section 6: Lifecycle Roadmap
        "sec6_title": "6. Roadmap del Ciclo di Vita & Decommissioning",
        "sec6_desc": (
            "Pianificazione temporale dello stato di vita delle applicazioni (Plan, Phase In, Live, Phase Out, Retired). "
            "Il monitoraggio attivo delle applicazioni in fase di dismissione consente di prevedere il recupero di budget e la riduzione del debito tecnico."
        ),
        "decomm_table_title": "Piano di Decommissioning e Dismissione Attiva",
        "col_decomm_app": "Applicazione in Phase Out",
        "col_decomm_target": "Sistema Target di Convergenza",
        "col_decomm_date": "Data Target Switch-Off",
        "col_decomm_savings": "Risparmio Liberabile",
        "col_decomm_status": "Stato Piano",
        "decomm_no_data": "Nessuna applicazione attualmente contrassegnata in fase di decommissioning o phase-out.",

        # Section 7: Appendix Master Catalog
        "sec7_title": "7. Appendice: Catalogo Completo delle Business Application",
        "sec7_desc": "Inventario tabellare orizzontale di tutte le Business Application censite nel workspace con relativi parametri APM, valutazioni TIME e metriche operative.",
        "col_appx_id": "ID",
        "col_appx_name": "Nome Applicazione",
        "col_appx_owner": "Business Owner",
        "col_appx_crit": "Criticità",
        "col_appx_time": "TIME",
        "col_appx_bfit": "B-Fit",
        "col_appx_tfit": "T-Fit",
        "col_appx_tco": "TCO Annuo",
        "col_appx_lifecycle": "Ciclo Vita",
        "col_appx_techrisk": "Rischio Tech",
    },
    "en": {
        "title": "Strategic Application Portfolio Management Report (APM)",
        "subtitle": "Gartner TIME Matrix, Technological Risk, TCO, Interfaces and Lifecycle Decommissioning Roadmap",
        "doc_info": "Generated by EasyEA Enterprise Architecture Platform • {date}",
        "workspace_label": "Workspace / Model: {model_name}",
        "pre_title_tag": "EASYEA • APPLICATION PORTFOLIO MANAGEMENT (APM)",

        # Section 1: Executive Summary
        "sec1_title": "1. Executive Summary & Portfolio KPI Dashboard",
        "sec1_desc": (
            "This report delivers an executive, consolidated perspective on the enterprise Business Application portfolio. "
            "It integrates ArchiMate application architecture with strategic APM metrics: Gartner TIME rationalization, "
            "Total Cost of Ownership (TCO) breakdown, technological obsolescence and regulatory compliance (DORA / NIS2), "
            "integration interface inventory, and active decommissioning roadmap."
        ),
        "kpi_total_apps": "Business Applications",
        "kpi_total_apps_sub": "{in_scope} in APM scope",
        "kpi_total_tco": "Total Annual TCO",
        "kpi_total_tco_sub": "Capex {capex_pct}% • Opex {opex_pct}%",
        "kpi_rationalization": "Rationalization Savings",
        "kpi_rationalization_sub": "{waste_cost} from {waste_count} Eliminate apps",
        "kpi_tech_risk": "Technological Risk",
        "kpi_tech_risk_sub": "{risk_count} critical apps • {dora_count} DORA alerts",

        # Section 2: TIME Matrix
        "sec2_title": "2. Portfolio Strategy: Gartner TIME Matrix",
        "sec2_desc": (
            "The Gartner TIME matrix plots applications across two critical dimensions: Business / Functional Fit "
            "and Technical Condition / Fit. Categorization into the four quadrants directs strategic investment, "
            "modernization, maintenance, or software decommissioning."
        ),
        "time_image_caption": "Figure 1: Gartner TIME Strategy Matrix — Business Value and Technical Condition Distribution (EasyEA Engine)",
        "time_col_quadrant": "TIME Quadrant",
        "time_col_strategy": "Strategic Focus",
        "time_col_count": "App Count",
        "time_col_cost": "Total Spend (€/yr)",
        "time_col_pct": "% TCO Spend",
        "time_col_action": "Recommended Action",
        "time_invest_desc": "High business value and modern technology. Prioritize for growth, cloud innovation, and expansion.",
        "time_tolerate_desc": "High business value but legacy or complex technical condition. Maintain with cost containment.",
        "time_migrate_desc": "Lower business value or redundant, but modern tech. Prime candidate for convergence or refactoring.",
        "time_eliminate_desc": "Low business value and high technical debt. Immediate priority for decommissioning and removal.",

        "time_action_table_title": "Rationalization Priorities (Eliminate & Migrate Quadrants)",
        "time_action_table_desc": "Target systems identified for decommissioning, replacement, or functional convergence:",
        "col_app_name": "Application",
        "col_owner": "Business Owner",
        "col_tech_owner": "Technical Owner",
        "col_b_fit": "Business Fit",
        "col_t_fit": "Tech Fit",
        "col_cost": "Annual Cost",
        "col_priority_action": "Rationalization Initiative",

        # Section 3: Tech Risk
        "sec3_title": "3. Technology Risk & Obsolescence (Tech Risk & DORA Radar)",
        "sec3_desc": (
            "Mapping of dependencies between the Application layer and underlying Technology infrastructure (OS, DBMS, runtimes, middleware). "
            "Tracking vendor End-of-Life (EOL) and End-of-Support (EOS) timelines is vital for cybersecurity vulnerability mitigation and regulatory compliance under DORA and NIS2 frameworks."
        ),
        "dora_table_title": "Regulatory Compliance Alert Register (DORA / NIS2)",
        "dora_table_desc": "Mission Critical or Business Critical applications exposed on obsolete or EOL technological components:",
        "dora_no_alerts": "No critical compliance alerts detected: all Mission and Business Critical applications run on supported vendor stacks.",
        "col_dora_app": "Critical Application",
        "col_dora_criticality": "Business Criticality",
        "col_dora_risk": "Risk Level",
        "col_dora_obsolete": "EOL Technology Stack",
        "col_dora_reason": "Finding / Regulatory Exposure",

        "tech_risk_table_title": "Top Applications with High Technological Debt",
        "col_risk_app": "Application",
        "col_risk_level": "Risk Level",
        "col_risk_obsolete_count": "Obsolete Techs",
        "col_risk_next_eol": "Next EOL Date",
        "col_risk_details": "Impacted Technology Elements",

        # Section 4: TCO Breakdown
        "sec4_title": "4. Financial Analysis & Total Cost of Ownership (TCO)",
        "sec4_desc": (
            "Breakdown of capital and operational expenses across the application portfolio. Identifies major spend drivers "
            "(software licenses, cloud infrastructure, vendor maintenance, and internal labor) and budget concentration."
        ),
        "tco_cost_category": "Cost Category",
        "tco_amount": "Annual Spend",
        "tco_pct": "% of Total TCO",
        "cat_licenses": "Software Licenses & Subscriptions",
        "cat_cloud": "Cloud Infrastructure & Hosting",
        "cat_maintenance": "Vendor Maintenance & Support",
        "cat_labor": "Internal Operations & Engineering",
        "cat_capex": "Capital Expenditures (Capex)",
        "cat_opex": "Operational Expenditures (Opex)",

        "top_cost_table_title": "Top Cost Drivers (Top 10 Applications by Annual Spend)",
        "col_rank": "#",
        "col_top_app": "Application",
        "col_top_cost": "Annual TCO",
        "col_top_pct": "% IT Budget",
        "col_top_quadrant": "TIME Quadrant",
        "col_top_users": "Active Users",

        # Section 5: Interface Inventory
        "sec5_title": "5. Interface Inventory & Integration Flows",
        "sec5_desc": (
            "Comprehensive registry of application interfaces and data flows. Catalogs communication protocols (REST, SOAP, Kafka, SFTP, DB Link), "
            "architectural patterns, and sensitivity classifications for exchanged information (GDPR / PII)."
        ),
        "col_iface_name": "Interface / Flow",
        "col_iface_source": "Source App",
        "col_iface_target": "Target App",
        "col_iface_protocol": "Protocol",
        "col_iface_pattern": "Pattern",
        "col_iface_data": "Data Classification",
        "col_iface_status": "Status",
        "iface_no_data": "No interfaces or integration flows registered in the current model.",

        # Section 6: Lifecycle Roadmap
        "sec6_title": "6. Lifecycle Roadmap & Decommissioning",
        "sec6_desc": (
            "Timeline of application lifecycle stages (Plan, Phase In, Live, Phase Out, Retired). "
            "Active tracking of phase-out initiatives enables predictable budget recovery and technological debt elimination."
        ),
        "decomm_table_title": "Active Decommissioning and Phase-Out Schedule",
        "col_decomm_app": "Application in Phase Out",
        "col_decomm_target": "Target Convergence System",
        "col_decomm_date": "Target Switch-Off Date",
        "col_decomm_savings": "Recoverable Spend",
        "col_decomm_status": "Status",
        "decomm_no_data": "No applications currently marked for phase-out or decommissioning.",

        # Section 7: Appendix Master Catalog
        "sec7_title": "7. Appendix: Full Business Application Master Inventory",
        "sec7_desc": "Comprehensive landscape table of all Business Applications inventoried in the workspace with complete APM attributes, TIME scores, and operational metrics.",
        "col_appx_id": "ID",
        "col_appx_name": "Application Name",
        "col_appx_owner": "Business Owner",
        "col_appx_crit": "Criticality",
        "col_appx_time": "TIME",
        "col_appx_bfit": "B-Fit",
        "col_appx_tfit": "T-Fit",
        "col_appx_tco": "Annual TCO",
        "col_appx_lifecycle": "Lifecycle",
        "col_appx_techrisk": "Tech Risk",
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


class APMReportService:
    @classmethod
    def render_time_matrix_diagram(cls, portfolio_data: Dict[str, Any], lang: str = "it") -> Optional[io.BytesIO]:
        """
        Generates a high-resolution 2x2 Gartner TIME Strategy Matrix diagram (PNG)
        directly at backend using Pillow, optimized for full-page horizontal landscape A4 presentation.
        """
        if not HAS_PIL:
            return None

        apps = portfolio_data.get("applications", [])
        time_counts = portfolio_data.get("time_distribution", {})
        time_costs = portfolio_data.get("time_cost_distribution", {})

        # Group apps by quadrant and sort by cost descending
        def get_sorted_quad_apps(q_name: str) -> List[Dict[str, Any]]:
            items = [a for a in apps if a.get("time_quadrant") == q_name]
            return sorted(items, key=lambda x: (x.get("total_annual_cost") or x.get("annual_cost") or 0.0), reverse=True)

        quad_apps = {
            "Invest": get_sorted_quad_apps("Invest"),
            "Tolerate": get_sorted_quad_apps("Tolerate"),
            "Migrate": get_sorted_quad_apps("Migrate"),
            "Eliminate": get_sorted_quad_apps("Eliminate"),
        }

        total_w = 1540
        total_h = 960
        img = Image.new("RGB", (total_w, total_h), color=(248, 250, 252))
        draw = ImageDraw.Draw(img)

        # Fonts
        font_banner = ImageFont.load_default(size=20)
        font_banner_sub = ImageFont.load_default(size=12)
        font_q_title = ImageFont.load_default(size=16)
        font_q_sub = ImageFont.load_default(size=11)
        font_q_stat = ImageFont.load_default(size=13)
        font_app_name = ImageFont.load_default(size=11)
        font_app_cost = ImageFont.load_default(size=10)
        font_axis = ImageFont.load_default(size=11)

        # 1. Top Banner
        draw.rectangle([0, 0, total_w, 75], fill=(15, 23, 42))
        banner_title = (
            "EASYEA • GARTNER TIME STRATEGY MATRIX (APPLICATION RATIONALIZATION)"
            if lang == "it"
            else "EASYEA • GARTNER TIME STRATEGY MATRIX (PORTFOLIO RATIONALIZATION)"
        )
        banner_sub = (
            "Classificazione 2x2: Valore di Business (Asse Y) vs Idoneità Tecnica (Asse X) • EasyEA Architecture Engine"
            if lang == "it"
            else "2x2 Portfolio Classification: Business Value (Y Axis) vs Technical Fit (X Axis) • EasyEA Architecture Engine"
        )
        draw.text((40, 16), banner_title, fill=(255, 255, 255), font=font_banner)
        draw.text((40, 46), banner_sub, fill=(148, 163, 184), font=font_banner_sub)

        # Geometry Coordinates
        left_x = 75
        col_w = 665
        right_x = 800
        top_y = 105
        row_h = 375
        bot_y = 525

        # Quadrant specs:
        # (name, x1, y1, x2, y2, bg_col, border_col, header_bg, title_col, sub_it, sub_en)
        specs = [
            ("Tolerate", left_x, top_y, left_x + col_w, top_y + row_h,
             (239, 246, 255), (59, 130, 246), (30, 64, 175), (255, 255, 255),
             "Valore Business Elevato (>= 3) • Debito / Legacy Tecnico (< 3)",
             "High Business Value (>= 3) • Legacy / Complex Tech (< 3)"),

            ("Invest", right_x, top_y, right_x + col_w, top_y + row_h,
             (236, 253, 245), (16, 185, 129), (6, 95, 70), (255, 255, 255),
             "Valore Business Elevato (>= 3) • Tecnologia Moderna (>= 3)",
             "High Business Value (>= 3) • Modern Technology (>= 3)"),

            ("Eliminate", left_x, bot_y, left_x + col_w, bot_y + row_h,
             (254, 242, 242), (239, 68, 68), (153, 27, 27), (255, 255, 255),
             "Basso Valore Business (< 3) • Debito Tecnico Elevato (< 3)",
             "Low Business Value (< 3) • High Technical Debt (< 3)"),

            ("Migrate", right_x, bot_y, right_x + col_w, bot_y + row_h,
             (255, 251, 235), (245, 158, 11), (146, 64, 14), (255, 255, 255),
             "Basso Valore Business (< 3) • Tecnologia Moderna (>= 3)",
             "Low Business Value (< 3) • Modern Technology (>= 3)"),
        ]

        for q_name, x1, y1, x2, y2, bg_col, border_col, hdr_bg, hdr_fg, sub_it, sub_en in specs:
            # 1. Card Container
            draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill=bg_col, outline=border_col, width=2)

            # 2. Header Bar
            hdr_h = 44
            draw.rounded_rectangle([x1, y1, x2, y1 + hdr_h], radius=10, fill=hdr_bg)
            draw.rectangle([x1, y1 + hdr_h - 12, x2, y1 + hdr_h], fill=hdr_bg)

            # Quadrant Title
            draw.text((x1 + 16, y1 + 12), q_name.upper(), fill=hdr_fg, font=font_q_title)

            # Stats (Count & Spend)
            q_cnt = time_counts.get(q_name, len(quad_apps[q_name]))
            q_cst = time_costs.get(q_name, sum((a.get("total_annual_cost") or a.get("annual_cost") or 0.0) for a in quad_apps[q_name]))
            stats_str = f"{q_cnt} App  •  {_format_eur(q_cst, lang)}/anno" if lang == "it" else f"{q_cnt} Apps  •  {_format_eur(q_cst, lang)}/yr"
            draw.text((x2 - 16 - len(stats_str) * 8, y1 + 14), stats_str, fill=(241, 245, 249), font=font_q_stat)

            # 3. Subline / Strategy definition
            sub_text = sub_it if lang == "it" else sub_en
            draw.text((x1 + 16, y1 + hdr_h + 8), sub_text, fill=(71, 85, 105), font=font_q_sub)

            # 4. App Chips Grid (2 Columns x 6 Rows = max 12 slots)
            app_list = quad_apps[q_name]
            chip_start_y = y1 + hdr_h + 30
            chip_w = (col_w - 42) // 2
            chip_h = 36
            chip_gap_x = 10
            chip_gap_y = 8

            max_chips = 12
            visible_apps = app_list[:max_chips]

            for a_idx, app in enumerate(visible_apps):
                col_i = a_idx % 2
                row_i = a_idx // 2

                cx1 = x1 + 16 + col_i * (chip_w + chip_gap_x)
                cy1 = chip_start_y + row_i * (chip_h + chip_gap_y)
                cx2 = cx1 + chip_w
                cy2 = cy1 + chip_h

                if a_idx == (max_chips - 1) and len(app_list) > max_chips:
                    # Show "+ N more" pill
                    draw.rounded_rectangle([cx1, cy1, cx2, cy2], radius=6, fill=(241, 245, 249), outline=border_col, width=1)
                    rem_cnt = len(app_list) - (max_chips - 1)
                    rem_lbl = f"+ {rem_cnt} altre app nel catalogo..." if lang == "it" else f"+ {rem_cnt} more apps in catalog..."
                    draw.text((cx1 + 12, cy1 + 10), rem_lbl, fill=(71, 85, 105), font=font_app_name)
                else:
                    # Application Pill
                    draw.rounded_rectangle([cx1, cy1, cx2, cy2], radius=6, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
                    # Color indicator dot
                    draw.ellipse([cx1 + 10, cy1 + 13, cx1 + 18, cy1 + 21], fill=border_col)

                    # Truncate app name if too long
                    raw_name = app.get("name", "N/A")
                    name_clean = raw_name[:18] + ".." if len(raw_name) > 20 else raw_name
                    draw.text((cx1 + 24, cy1 + 10), name_clean, fill=(15, 23, 42), font=font_app_name)

                    # Cost on the right
                    c_val = app.get("total_annual_cost") or app.get("annual_cost") or 0.0
                    if c_val > 0:
                        c_str = f"€{c_val/1000:.0f}k" if c_val >= 1000 else f"€{c_val:.0f}"
                        draw.text((cx2 - 55, cy1 + 11), c_str, fill=(100, 116, 139), font=font_app_cost)

        # 5. Axes & Central Labels
        axis_col = (100, 116, 139)
        # Horizontal Axis Text
        h_axis_lbl = (
            "◄─── BASSA IDONEITÀ TECNICA (< 3.0) ──────── IDONEITÀ TECNICA ──────── ELEVATA IDONEITÀ TECNICA (>= 3.0) ───►"
            if lang == "it"
            else "◄─── LOW TECHNICAL FIT (< 3.0) ──────── TECHNICAL CONDITION ──────── HIGH TECHNICAL FIT (>= 3.0) ───►"
        )
        draw.text((left_x + 360, 492), h_axis_lbl, fill=axis_col, font=font_axis)

        # Bottom Sub-footer Summary
        tot_apps_cnt = portfolio_data.get("total_applications", len(apps))
        tot_tco_val = portfolio_data.get("total_annual_cost", sum(time_costs.values()))
        footer_summary = (
            f"Totale Portafoglio APM: {tot_apps_cnt} Business Applications  •  TCO Complessivo Annuo: {_format_eur(tot_tco_val, lang)}"
            if lang == "it"
            else f"Total APM Portfolio: {tot_apps_cnt} Business Applications  •  Total Annual TCO: {_format_eur(tot_tco_val, lang)}"
        )
        draw.text((left_x + 400, 920), footer_summary, fill=(51, 65, 85), font=font_axis)

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf

    @classmethod
    def generate_docx_report(
        cls,
        portfolio_data: Dict[str, Any],
        tco_data: Dict[str, Any],
        lifecycle_data: Dict[str, Any],
        interfaces_data: Dict[str, Any],
        tech_risk_data: Dict[str, Any],
        model_name: str = "Enterprise Architecture Model",
        lang: str = "it"
    ) -> io.BytesIO:
        """
        Generates a comprehensive Word (.docx) assessment document containing:
        1. Front Cover & Meta
        2. Executive Summary & KPI Cards (Total Apps, TCO, Waste Savings, Tech Risk)
        3. Portfolio Strategy: Gartner TIME Matrix (DEDICATED FULL-PAGE LANDSCAPE with visual diagram)
        4. Rationalization Priorities Table (Eliminate & Migrate Quadrants)
        5. Technological Risk & Obsolescence (Tech Risk & DORA Radar)
        6. Financial Analysis & Total Cost of Ownership (TCO Breakdown)
        7. Interface Inventory & Integration Flows (Governance & PII)
        8. Lifecycle Roadmap & Decommissioning Plan
        9. Appendix: Full Business Application Master Inventory (Landscape)
        """
        t = REPORT_I18N.get(lang, REPORT_I18N["it"])
        doc = Document()

        # Section 1 Setup: Standard A4 Portrait with 0.8-inch margins
        sec_main = doc.sections[0]
        sec_main.orientation = WD_ORIENTATION.PORTRAIT
        sec_main.page_width = Inches(8.27)
        sec_main.page_height = Inches(11.69)
        sec_main.top_margin = Inches(0.8)
        sec_main.bottom_margin = Inches(0.8)
        sec_main.left_margin = Inches(0.8)
        sec_main.right_margin = Inches(0.8)

        # Base Normal Style
        normal_style = doc.styles['Normal']
        normal_style.font.name = 'Calibri'
        normal_style.font.size = Pt(10)
        normal_style.font.color.rgb = RGBColor(0x33, 0x41, 0x55)  # Slate-700

        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

        # =====================================================================
        # HEADER & COVER SECTION
        # =====================================================================
        p_tag = doc.add_paragraph()
        p_tag.paragraph_format.space_before = Pt(0)
        p_tag.paragraph_format.space_after = Pt(4)
        run_tag = p_tag.add_run(t["pre_title_tag"])
        run_tag.bold = True
        run_tag.font.size = Pt(9)
        run_tag.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)  # Indigo-600

        p_title = doc.add_paragraph()
        p_title.paragraph_format.space_before = Pt(0)
        p_title.paragraph_format.space_after = Pt(6)
        run_title = p_title.add_run(t["title"])
        run_title.bold = True
        run_title.font.size = Pt(20)
        run_title.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)  # Slate-900

        p_sub = doc.add_paragraph()
        p_sub.paragraph_format.space_before = Pt(0)
        p_sub.paragraph_format.space_after = Pt(12)
        run_sub = p_sub.add_run(t["subtitle"])
        run_sub.font.size = Pt(11)
        run_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate-500

        # Meta Info Table
        meta_table = doc.add_table(rows=1, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_table.autofit = False
        meta_left = meta_table.cell(0, 0)
        meta_right = meta_table.cell(0, 1)
        meta_left.width = Inches(3.8)
        meta_right.width = Inches(2.8)

        _set_cell_background(meta_left, "F8FAFC")
        _set_cell_background(meta_right, "F8FAFC")
        _set_cell_padding(meta_left, top=80, bottom=80, left=120, right=120)
        _set_cell_padding(meta_right, top=80, bottom=80, left=120, right=120)

        p_m1 = meta_left.paragraphs[0]
        p_m1.paragraph_format.space_after = Pt(0)
        r_m1 = p_m1.add_run(t["workspace_label"].format(model_name=model_name))
        r_m1.bold = True
        r_m1.font.size = Pt(9.5)
        r_m1.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_m2 = meta_right.paragraphs[0]
        p_m2.paragraph_format.space_after = Pt(0)
        p_m2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_m2 = p_m2.add_run(t["doc_info"].format(date=now_str))
        r_m2.font.size = Pt(8.5)
        r_m2.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        _set_table_borders(meta_table, "CBD5E1")

        # =====================================================================
        # 1. EXECUTIVE SUMMARY & KPI CARDS
        # =====================================================================
        p_s1 = doc.add_paragraph()
        p_s1.paragraph_format.space_before = Pt(18)
        p_s1.paragraph_format.space_after = Pt(6)
        r_s1 = p_s1.add_run(t["sec1_title"])
        r_s1.bold = True
        r_s1.font.size = Pt(14)
        r_s1.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s1_desc = doc.add_paragraph()
        p_s1_desc.paragraph_format.space_before = Pt(0)
        p_s1_desc.paragraph_format.space_after = Pt(12)
        r_s1_desc = p_s1_desc.add_run(t["sec1_desc"])
        r_s1_desc.font.size = Pt(9.5)

        # Gather KPI numbers
        total_apps = portfolio_data.get("total_applications", 0)
        in_scope_apps = portfolio_data.get("total_in_scope", total_apps)
        tco_summary = tco_data.get("summary", {})
        total_tco = tco_summary.get("total_annual_tco") or portfolio_data.get("total_annual_cost", 0.0)
        capex_pct = tco_summary.get("capex_percentage", 0.0)
        opex_pct = tco_summary.get("opex_percentage", 0.0)
        waste_cost = _format_eur(tco_summary.get("waste_eliminate_cost", 0.0), lang)
        waste_count = tco_summary.get("waste_eliminate_count", 0)
        risk_summary = tech_risk_data.get("summary", {})
        high_crit_risk = (risk_summary.get("risk_distribution", {}).get("Critical", 0) +
                          risk_summary.get("risk_distribution", {}).get("High", 0))
        dora_alerts = len(tech_risk_data.get("dora_compliance_alerts", []))

        # 4 KPI Cards in a 2x2 Grid Table
        kpi_table = doc.add_table(rows=2, cols=2)
        kpi_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        kpi_table.autofit = False

        cards_config = [
            (0, 0, "4F46E5", "EEF2FF", t["kpi_total_apps"], str(total_apps),
             t["kpi_total_apps_sub"].format(in_scope=in_scope_apps)),
            (0, 1, "059669", "ECFDF5", t["kpi_total_tco"], _format_eur(total_tco, lang),
             t["kpi_total_tco_sub"].format(capex_pct=capex_pct, opex_pct=opex_pct)),
            (1, 0, "D97706", "FFFBEB", t["kpi_rationalization"], waste_cost,
             t["kpi_rationalization_sub"].format(waste_cost=waste_cost, waste_count=waste_count)),
            (1, 1, "DC2626", "FEF2F2", t["kpi_tech_risk"], f"{high_crit_risk} Critical / High",
             t["kpi_tech_risk_sub"].format(risk_count=high_crit_risk, dora_count=dora_alerts)),
        ]

        for r_idx, c_idx, border_col, bg_col, label, val_str, sub_str in cards_config:
            cell = kpi_table.cell(r_idx, c_idx)
            cell.width = Inches(3.3)
            _set_cell_background(cell, bg_col)
            _set_cell_left_border(cell, hex_color=border_col, size="36")
            _set_cell_padding(cell, top=100, bottom=100, left=140, right=140)

            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            r_lbl = p.add_run(label.upper())
            r_lbl.bold = True
            r_lbl.font.size = Pt(8.5)
            r_lbl.font.color.rgb = RGBColor.from_string(border_col)

            p_val = cell.add_paragraph()
            p_val.paragraph_format.space_before = Pt(0)
            p_val.paragraph_format.space_after = Pt(2)
            r_v = p_val.add_run(val_str)
            r_v.bold = True
            r_v.font.size = Pt(15)
            r_v.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

            p_sub_k = cell.add_paragraph()
            p_sub_k.paragraph_format.space_before = Pt(0)
            p_sub_k.paragraph_format.space_after = Pt(0)
            r_s = p_sub_k.add_run(sub_str)
            r_s.font.size = Pt(8.5)
            r_s.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        _set_table_borders(kpi_table, "E2E8F0")

        # =====================================================================
        # 2. DEDICATED FULL-PAGE LANDSCAPE: GARTNER TIME STRATEGY MATRIX
        # =====================================================================
        sec_time_landscape = doc.add_section(WD_SECTION_START.NEW_PAGE)
        sec_time_landscape.orientation = WD_ORIENTATION.LANDSCAPE
        sec_time_landscape.page_width = Inches(11.69)
        sec_time_landscape.page_height = Inches(8.27)
        sec_time_landscape.top_margin = Inches(0.5)
        sec_time_landscape.bottom_margin = Inches(0.5)
        sec_time_landscape.left_margin = Inches(0.6)
        sec_time_landscape.right_margin = Inches(0.6)

        p_s2_l = doc.add_paragraph()
        p_s2_l.paragraph_format.space_before = Pt(4)
        p_s2_l.paragraph_format.space_after = Pt(2)
        r_s2_l = p_s2_l.add_run(t["sec2_title"])
        r_s2_l.bold = True
        r_s2_l.font.size = Pt(14)
        r_s2_l.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s2_ld = doc.add_paragraph()
        p_s2_ld.paragraph_format.space_before = Pt(0)
        p_s2_ld.paragraph_format.space_after = Pt(4)
        r_s2_ld = p_s2_ld.add_run(t["sec2_desc"])
        r_s2_ld.font.size = Pt(9.5)

        # Render High-Resolution Visual TIME Matrix Diagram via Pillow
        try:
            diag_stream = cls.render_time_matrix_diagram(portfolio_data, lang=lang)
            if diag_stream and len(diag_stream.getvalue()) > 500:
                p_img = doc.add_paragraph()
                p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_img.paragraph_format.space_before = Pt(2)
                p_img.paragraph_format.space_after = Pt(2)
                p_img_run = p_img.add_run()
                p_img_run.add_picture(diag_stream, width=Inches(10.2))

                p_cap = doc.add_paragraph(t["time_image_caption"])
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.paragraph_format.space_before = Pt(2)
                p_cap.paragraph_format.space_after = Pt(4)
                p_cap.runs[0].font.size = Pt(8.5)
                p_cap.runs[0].font.italic = True
                p_cap.runs[0].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        except Exception as e:
            print("Error adding TIME matrix picture:", e)

        # =====================================================================
        # RETURN TO PORTRAIT: TIME TABLES & SUBSEQUENT SECTIONS
        # =====================================================================
        sec_portrait_2 = doc.add_section(WD_SECTION_START.NEW_PAGE)
        sec_portrait_2.orientation = WD_ORIENTATION.PORTRAIT
        sec_portrait_2.page_width = Inches(8.27)
        sec_portrait_2.page_height = Inches(11.69)
        sec_portrait_2.top_margin = Inches(0.8)
        sec_portrait_2.bottom_margin = Inches(0.8)
        sec_portrait_2.left_margin = Inches(0.8)
        sec_portrait_2.right_margin = Inches(0.8)

        time_counts = portfolio_data.get("time_distribution", {})
        time_costs = portfolio_data.get("time_cost_distribution", {})

        p_t_tab_title = doc.add_paragraph()
        p_t_tab_title.paragraph_format.space_before = Pt(8)
        p_t_tab_title.paragraph_format.space_after = Pt(4)
        r_ttt = p_t_tab_title.add_run(t["sec2_title"] + (" (Sintesi Metrica)" if lang == "it" else " (Metrics Summary)"))
        r_ttt.bold = True
        r_ttt.font.size = Pt(12)
        r_ttt.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        time_table = doc.add_table(rows=5, cols=6)
        time_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        time_table.autofit = False

        col_widths_s2 = [Inches(1.2), Inches(1.5), Inches(0.8), Inches(1.1), Inches(0.8), Inches(1.2)]
        headers_s2 = [
            t["time_col_quadrant"], t["time_col_strategy"], t["time_col_count"],
            t["time_col_cost"], t["time_col_pct"], t["time_col_action"]
        ]

        # Header Row
        for idx, text in enumerate(headers_s2):
            cell = time_table.cell(0, idx)
            cell.width = col_widths_s2[idx]
            _set_cell_background(cell, "1E293B")
            _set_cell_padding(cell, top=100, bottom=100, left=100, right=100)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx in (2, 3, 4) else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.bold = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        quadrant_specs = [
            ("Invest", "059669", "ECFDF5", "High Business, High Tech", t["time_invest_desc"]),
            ("Tolerate", "2563EB", "EFF6FF", "High Business, Low Tech", t["time_tolerate_desc"]),
            ("Migrate", "D97706", "FFFBEB", "Low Business, High Tech", t["time_migrate_desc"]),
            ("Eliminate", "DC2626", "FEF2F2", "Low Business, Low Tech", t["time_eliminate_desc"]),
        ]

        for row_idx, (q_name, q_color, q_bg, q_strat, q_action) in enumerate(quadrant_specs, start=1):
            q_cnt = time_counts.get(q_name, 0)
            q_cst = time_costs.get(q_name, 0.0)
            q_pct = f"{(q_cst / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"

            row_data = [
                q_name,
                q_strat,
                str(q_cnt),
                _format_eur(q_cst, lang),
                q_pct,
                q_action
            ]

            for c_idx, val in enumerate(row_data):
                cell = time_table.cell(row_idx, c_idx)
                cell.width = col_widths_s2[c_idx]
                if row_idx % 2 == 1:
                    _set_cell_background(cell, "F8FAFC")
                _set_cell_padding(cell, top=80, bottom=80, left=90, right=90)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx in (2, 3, 4) else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(val)
                r.font.size = Pt(8.5)
                if c_idx == 0:
                    r.bold = True
                    r.font.color.rgb = RGBColor.from_string(q_color)
                elif c_idx == 3:
                    r.bold = True

        _set_table_borders(time_table, "CBD5E1")

        # Focus Table: Eliminate & Migrate Apps
        apps = portfolio_data.get("applications", [])
        elim_mig_apps = [a for a in apps if a.get("time_quadrant") in ("Eliminate", "Migrate")]

        if elim_mig_apps:
            p_em_title = doc.add_paragraph()
            p_em_title.paragraph_format.space_before = Pt(14)
            p_em_title.paragraph_format.space_after = Pt(4)
            r_em = p_em_title.add_run(t["time_action_table_title"])
            r_em.bold = True
            r_em.font.size = Pt(11)
            r_em.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)

            p_em_desc = doc.add_paragraph()
            p_em_desc.paragraph_format.space_before = Pt(0)
            p_em_desc.paragraph_format.space_after = Pt(6)
            r_emd = p_em_desc.add_run(t["time_action_table_desc"])
            r_emd.font.size = Pt(9)

            em_table = doc.add_table(rows=len(elim_mig_apps) + 1, cols=7)
            em_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            em_table.autofit = False

            col_widths_em = [Inches(1.5), Inches(0.9), Inches(0.9), Inches(0.5), Inches(0.5), Inches(1.0), Inches(1.3)]
            headers_em = [
                t["col_app_name"], t["col_owner"], t["col_tech_owner"],
                t["col_b_fit"], t["col_t_fit"], t["col_cost"], t["col_priority_action"]
            ]

            for idx, text in enumerate(headers_em):
                cell = em_table.cell(0, idx)
                cell.width = col_widths_em[idx]
                _set_cell_background(cell, "334155")
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx in (3, 4, 5) else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, app in enumerate(elim_mig_apps, start=1):
                q = app.get("time_quadrant", "Eliminate")
                action_text = (
                    "Dismissione / Switch-off definitivo" if q == "Eliminate" and lang == "it" else
                    "Decommission / Final switch-off" if q == "Eliminate" else
                    "Migrazione / Refactoring cloud" if lang == "it" else
                    "Migration / Cloud refactoring"
                )
                cost_val = app.get("total_annual_cost") or app.get("annual_cost") or 0.0

                row_vals = [
                    app.get("name", "N/A"),
                    app.get("business_owner") or "-",
                    app.get("technical_owner") or "-",
                    str(app.get("business_fit", 3)),
                    str(app.get("technical_fit", 3)),
                    _format_eur(cost_val, lang),
                    action_text
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = em_table.cell(r_idx, c_idx)
                    cell.width = col_widths_em[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "F8FAFC")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx in (3, 4, 5) else WD_ALIGN_PARAGRAPH.LEFT
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 0:
                        r.bold = True
                    elif c_idx == 6:
                        r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26) if q == "Eliminate" else RGBColor(0xD9, 0x77, 0x06)

            _set_table_borders(em_table, "CBD5E1")

        # =====================================================================
        # 3. RISCHIO TECNOLOGICO & OBSOLESCENZA (TECH RISK & DORA RADAR)
        # =====================================================================
        p_s3 = doc.add_paragraph()
        p_s3.paragraph_format.space_before = Pt(20)
        p_s3.paragraph_format.space_after = Pt(6)
        r_s3 = p_s3.add_run(t["sec3_title"])
        r_s3.bold = True
        r_s3.font.size = Pt(14)
        r_s3.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s3_desc = doc.add_paragraph()
        p_s3_desc.paragraph_format.space_before = Pt(0)
        p_s3_desc.paragraph_format.space_after = Pt(10)
        r_s3_desc = p_s3_desc.add_run(t["sec3_desc"])
        r_s3_desc.font.size = Pt(9.5)

        # DORA Table
        dora_alerts_list = tech_risk_data.get("dora_compliance_alerts", [])

        p_dora_h = doc.add_paragraph()
        p_dora_h.paragraph_format.space_before = Pt(10)
        p_dora_h.paragraph_format.space_after = Pt(4)
        r_dh = p_dora_h.add_run(t["dora_table_title"])
        r_dh.bold = True
        r_dh.font.size = Pt(11)
        r_dh.font.color.rgb = RGBColor(0xB9, 0x1C, 0x1C)

        if not dora_alerts_list:
            p_no_dora = doc.add_paragraph()
            p_no_dora.paragraph_format.space_before = Pt(0)
            p_no_dora.paragraph_format.space_after = Pt(8)
            r_nd = p_no_dora.add_run(f"✓ {t['dora_no_alerts']}")
            r_nd.font.size = Pt(9)
            r_nd.bold = True
            r_nd.font.color.rgb = RGBColor(0x05, 0x96, 0x69)
        else:
            p_dora_desc = doc.add_paragraph()
            p_dora_desc.paragraph_format.space_before = Pt(0)
            p_dora_desc.paragraph_format.space_after = Pt(6)
            r_dd = p_dora_desc.add_run(t["dora_table_desc"])
            r_dd.font.size = Pt(9)

            dora_table = doc.add_table(rows=len(dora_alerts_list) + 1, cols=5)
            dora_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            dora_table.autofit = False

            col_widths_dora = [Inches(1.5), Inches(1.1), Inches(0.9), Inches(1.3), Inches(1.8)]
            headers_dora = [
                t["col_dora_app"], t["col_dora_criticality"], t["col_dora_risk"],
                t["col_dora_obsolete"], t["col_dora_reason"]
            ]

            for idx, text in enumerate(headers_dora):
                cell = dora_table.cell(0, idx)
                cell.width = col_widths_dora[idx]
                _set_cell_background(cell, "7F1D1D")  # Dark Red
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, alert in enumerate(dora_alerts_list, start=1):
                obs_list = alert.get("obsolete_components", [])
                obs_str = ", ".join(obs_list) if obs_list else "Stack EOL"
                row_vals = [
                    alert.get("application_name", "N/A"),
                    alert.get("business_criticality", "Mission Critical"),
                    alert.get("tech_risk_level", "Critical"),
                    obs_str,
                    alert.get("reason", "")
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = dora_table.cell(r_idx, c_idx)
                    cell.width = col_widths_dora[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "FEF2F2")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 0:
                        r.bold = True
                    elif c_idx == 2:
                        r.bold = True
                        r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)

            _set_table_borders(dora_table, "FCA5A5")

        # Top Tech Risk Applications Table
        risk_apps = [a for a in tech_risk_data.get("applications", []) if a.get("tech_risk_level") in ("Critical", "High")]

        if risk_apps:
            p_tra_h = doc.add_paragraph()
            p_tra_h.paragraph_format.space_before = Pt(14)
            p_tra_h.paragraph_format.space_after = Pt(4)
            r_th = p_tra_h.add_run(t["tech_risk_table_title"])
            r_th.bold = True
            r_th.font.size = Pt(11)
            r_th.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

            tra_table = doc.add_table(rows=len(risk_apps) + 1, cols=5)
            tra_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            tra_table.autofit = False

            col_widths_tra = [Inches(1.8), Inches(1.0), Inches(0.9), Inches(1.0), Inches(1.9)]
            headers_tra = [
                t["col_risk_app"], t["col_risk_level"], t["col_risk_obsolete_count"],
                t["col_risk_next_eol"], t["col_risk_details"]
            ]

            for idx, text in enumerate(headers_tra):
                cell = tra_table.cell(0, idx)
                cell.width = col_widths_tra[idx]
                _set_cell_background(cell, "334155")
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx == 2 else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, app in enumerate(risk_apps, start=1):
                techs = app.get("technologies", [])
                obs_names = [tc.get("name") for tc in techs if "Obsolete" in tc.get("status", "") or "End of Life" in tc.get("status", "")]
                next_eol = app.get("next_eol_date") or "-"

                row_vals = [
                    app.get("name", "N/A"),
                    app.get("tech_risk_level", "High"),
                    str(app.get("counts", {}).get("obsolete", 0)),
                    str(next_eol),
                    ", ".join(obs_names) if obs_names else "-"
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = tra_table.cell(r_idx, c_idx)
                    cell.width = col_widths_tra[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "F8FAFC")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx == 2 else WD_ALIGN_PARAGRAPH.LEFT
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 0:
                        r.bold = True
                    elif c_idx == 1:
                        r.bold = True
                        r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)

            _set_table_borders(tra_table, "CBD5E1")

        # =====================================================================
        # 4. ANALISI ECONOMICA & TOTAL COST OF OWNERSHIP (TCO)
        # =====================================================================
        p_s4 = doc.add_paragraph()
        p_s4.paragraph_format.space_before = Pt(20)
        p_s4.paragraph_format.space_after = Pt(6)
        r_s4 = p_s4.add_run(t["sec4_title"])
        r_s4.bold = True
        r_s4.font.size = Pt(14)
        r_s4.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s4_desc = doc.add_paragraph()
        p_s4_desc.paragraph_format.space_before = Pt(0)
        p_s4_desc.paragraph_format.space_after = Pt(10)
        r_s4_desc = p_s4_desc.add_run(t["sec4_desc"])
        r_s4_desc.font.size = Pt(9.5)

        # TCO Breakdown Categories Table
        c_lic = tco_summary.get("total_software_licenses", 0.0)
        c_cld = tco_summary.get("total_cloud_infrastructure", 0.0)
        c_mnt = tco_summary.get("total_vendor_maintenance", 0.0)
        c_lab = tco_summary.get("total_internal_labor", 0.0)
        c_cap = tco_summary.get("total_capex", 0.0)
        c_opx = tco_summary.get("total_opex", 0.0)

        tco_table = doc.add_table(rows=7, cols=3)
        tco_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        tco_table.autofit = False

        col_widths_tco = [Inches(3.2), Inches(1.8), Inches(1.6)]
        headers_tco = [t["tco_cost_category"], t["tco_amount"], t["tco_pct"]]

        for idx, text in enumerate(headers_tco):
            cell = tco_table.cell(0, idx)
            cell.width = col_widths_tco[idx]
            _set_cell_background(cell, "1E293B")
            _set_cell_padding(cell, top=80, bottom=80, left=90, right=90)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx in (1, 2) else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.bold = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        tco_rows = [
            (t["cat_licenses"], c_lic, f"{(c_lic / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"),
            (t["cat_cloud"], c_cld, f"{(c_cld / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"),
            (t["cat_maintenance"], c_mnt, f"{(c_mnt / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"),
            (t["cat_labor"], c_lab, f"{(c_lab / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"),
            (t["cat_capex"], c_cap, f"{capex_pct:.1f}%"),
            (t["cat_opex"], c_opx, f"{opex_pct:.1f}%"),
        ]

        for r_idx, (cat_label, amount, pct_str) in enumerate(tco_rows, start=1):
            row_vals = [cat_label, _format_eur(amount, lang), pct_str]
            for c_idx, val in enumerate(row_vals):
                cell = tco_table.cell(r_idx, c_idx)
                cell.width = col_widths_tco[c_idx]
                if r_idx % 2 == 1:
                    _set_cell_background(cell, "F8FAFC")
                _set_cell_padding(cell, top=60, bottom=60, left=80, right=80)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx in (1, 2) else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(val)
                r.font.size = Pt(8.5)
                if c_idx == 0:
                    r.bold = True
                elif c_idx == 1:
                    r.bold = True

        _set_table_borders(tco_table, "CBD5E1")

        # Top 10 Cost Drivers Table
        sorted_apps_cost = sorted(
            portfolio_data.get("applications", []),
            key=lambda x: (x.get("total_annual_cost") or x.get("annual_cost") or 0.0),
            reverse=True
        )[:10]

        if sorted_apps_cost:
            p_top_h = doc.add_paragraph()
            p_top_h.paragraph_format.space_before = Pt(14)
            p_top_h.paragraph_format.space_after = Pt(4)
            r_top = p_top_h.add_run(t["top_cost_table_title"])
            r_top.bold = True
            r_top.font.size = Pt(11)
            r_top.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

            top_table = doc.add_table(rows=len(sorted_apps_cost) + 1, cols=6)
            top_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            top_table.autofit = False

            col_widths_top = [Inches(0.4), Inches(2.2), Inches(1.3), Inches(0.9), Inches(1.0), Inches(0.8)]
            headers_top = [
                t["col_rank"], t["col_top_app"], t["col_top_cost"],
                t["col_top_pct"], t["col_top_quadrant"], t["col_top_users"]
            ]

            for idx, text in enumerate(headers_top):
                cell = top_table.cell(0, idx)
                cell.width = col_widths_top[idx]
                _set_cell_background(cell, "334155")
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx in (0, 2, 3, 5) else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, app in enumerate(sorted_apps_cost, start=1):
                app_c = app.get("total_annual_cost") or app.get("annual_cost") or 0.0
                app_pct = f"{(app_c / total_tco * 100):.1f}%" if total_tco > 0 else "0.0%"
                row_vals = [
                    str(r_idx),
                    app.get("name", "N/A"),
                    _format_eur(app_c, lang),
                    app_pct,
                    app.get("time_quadrant", "-"),
                    str(app.get("active_users_count") or app.get("active_users") or "-")
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = top_table.cell(r_idx, c_idx)
                    cell.width = col_widths_top[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "F8FAFC")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx in (0, 2, 3, 5) else WD_ALIGN_PARAGRAPH.LEFT
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 1:
                        r.bold = True
                    elif c_idx == 2:
                        r.bold = True

            _set_table_borders(top_table, "CBD5E1")

        # =====================================================================
        # 5. INVENTARIO INTERFACCE & FLUSSI DI INTEGRAZIONE
        # =====================================================================
        p_s5 = doc.add_paragraph()
        p_s5.paragraph_format.space_before = Pt(20)
        p_s5.paragraph_format.space_after = Pt(6)
        r_s5 = p_s5.add_run(t["sec5_title"])
        r_s5.bold = True
        r_s5.font.size = Pt(14)
        r_s5.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s5_desc = doc.add_paragraph()
        p_s5_desc.paragraph_format.space_before = Pt(0)
        p_s5_desc.paragraph_format.space_after = Pt(10)
        r_s5_desc = p_s5_desc.add_run(t["sec5_desc"])
        r_s5_desc.font.size = Pt(9.5)

        ifaces = interfaces_data.get("interfaces", [])

        if not ifaces:
            p_no_if = doc.add_paragraph()
            p_no_if.paragraph_format.space_before = Pt(0)
            p_no_if.paragraph_format.space_after = Pt(8)
            r_ni = p_no_if.add_run(t["iface_no_data"])
            r_ni.font.size = Pt(9)
            r_ni.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        else:
            if_table = doc.add_table(rows=min(len(ifaces) + 1, 26), cols=7)
            if_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            if_table.autofit = False

            col_widths_if = [Inches(1.5), Inches(1.1), Inches(1.1), Inches(0.8), Inches(0.8), Inches(0.8), Inches(0.5)]
            headers_if = [
                t["col_iface_name"], t["col_iface_source"], t["col_iface_target"],
                t["col_iface_protocol"], t["col_iface_pattern"], t["col_iface_data"], t["col_iface_status"]
            ]

            for idx, text in enumerate(headers_if):
                cell = if_table.cell(0, idx)
                cell.width = col_widths_if[idx]
                _set_cell_background(cell, "1E293B")
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, iface in enumerate(ifaces[:25], start=1):
                row_vals = [
                    iface.get("name", "Interface"),
                    iface.get("source_app_name") or iface.get("source_application_name") or "-",
                    iface.get("target_app_name") or iface.get("target_application_name") or "-",
                    iface.get("protocol") or "-",
                    iface.get("pattern") or "-",
                    iface.get("data_classification") or "-",
                    iface.get("status") or "Live"
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = if_table.cell(r_idx, c_idx)
                    cell.width = col_widths_if[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "F8FAFC")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 0:
                        r.bold = True
                    elif c_idx == 5 and val in ("Confidential", "Restricted", "PII"):
                        r.bold = True
                        r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)

            _set_table_borders(if_table, "CBD5E1")

        # =====================================================================
        # 6. ROADMAP DEL CICLO DI VITA & DECOMMISSIONING
        # =====================================================================
        p_s6 = doc.add_paragraph()
        p_s6.paragraph_format.space_before = Pt(20)
        p_s6.paragraph_format.space_after = Pt(6)
        r_s6 = p_s6.add_run(t["sec6_title"])
        r_s6.bold = True
        r_s6.font.size = Pt(14)
        r_s6.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s6_desc = doc.add_paragraph()
        p_s6_desc.paragraph_format.space_before = Pt(0)
        p_s6_desc.paragraph_format.space_after = Pt(10)
        r_s6_desc = p_s6_desc.add_run(t["sec6_desc"])
        r_s6_desc.font.size = Pt(9.5)

        lifecycle_apps = lifecycle_data.get("applications", [])
        decomm_apps = [a for a in lifecycle_apps if a.get("lifecycle_status") in ("Phase Out", "Retired") or a.get("decommission_status")]

        if not decomm_apps:
            p_no_dec = doc.add_paragraph()
            p_no_dec.paragraph_format.space_before = Pt(0)
            p_no_dec.paragraph_format.space_after = Pt(8)
            r_ndc = p_no_dec.add_run(t["decomm_no_data"])
            r_ndc.font.size = Pt(9)
            r_ndc.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        else:
            p_dec_h = doc.add_paragraph()
            p_dec_h.paragraph_format.space_before = Pt(8)
            p_dec_h.paragraph_format.space_after = Pt(4)
            r_dech = p_dec_h.add_run(t["decomm_table_title"])
            r_dech.bold = True
            r_dech.font.size = Pt(11)
            r_dech.font.color.rgb = RGBColor(0xD9, 0x77, 0x06)

            dec_table = doc.add_table(rows=len(decomm_apps) + 1, cols=5)
            dec_table.alignment = WD_TABLE_ALIGNMENT.CENTER
            dec_table.autofit = False

            col_widths_dec = [Inches(1.8), Inches(1.8), Inches(1.1), Inches(1.1), Inches(0.8)]
            headers_dec = [
                t["col_decomm_app"], t["col_decomm_target"], t["col_decomm_date"],
                t["col_decomm_savings"], t["col_decomm_status"]
            ]

            for idx, text in enumerate(headers_dec):
                cell = dec_table.cell(0, idx)
                cell.width = col_widths_dec[idx]
                _set_cell_background(cell, "334155")
                _set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx == 3 else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

            for r_idx, app in enumerate(decomm_apps, start=1):
                savings_val = app.get("savings_on_retire") or app.get("annual_cost") or 0.0
                row_vals = [
                    app.get("name", "N/A"),
                    app.get("target_replacement_name") or app.get("target_application_name") or "-",
                    str(app.get("decommission_date") or app.get("end_of_life_date") or "-"),
                    _format_eur(savings_val, lang),
                    app.get("decommission_status") or app.get("lifecycle_status") or "Phase Out"
                ]

                for c_idx, val in enumerate(row_vals):
                    cell = dec_table.cell(r_idx, c_idx)
                    cell.width = col_widths_dec[c_idx]
                    if r_idx % 2 == 1:
                        _set_cell_background(cell, "F8FAFC")
                    _set_cell_padding(cell, top=60, bottom=60, left=70, right=70)
                    p = cell.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx == 3 else WD_ALIGN_PARAGRAPH.LEFT
                    r = p.add_run(val)
                    r.font.size = Pt(8)
                    if c_idx == 0:
                        r.bold = True
                    elif c_idx == 3:
                        r.bold = True
                        r.font.color.rgb = RGBColor(0x05, 0x96, 0x69)

            _set_table_borders(dec_table, "CBD5E1")

        # =====================================================================
        # 7. APPENDICE: CATALOGO COMPLETO DELLE BUSINESS APPLICATION (LANDSCAPE)
        # =====================================================================
        sec_land = doc.add_section(WD_SECTION_START.NEW_PAGE)
        sec_land.orientation = WD_ORIENTATION.LANDSCAPE
        sec_land.page_width = Inches(11.69)
        sec_land.page_height = Inches(8.27)
        sec_land.top_margin = Inches(0.8)
        sec_land.bottom_margin = Inches(0.8)
        sec_land.left_margin = Inches(0.8)
        sec_land.right_margin = Inches(0.8)

        p_s7 = doc.add_paragraph()
        p_s7.paragraph_format.space_before = Pt(10)
        p_s7.paragraph_format.space_after = Pt(4)
        r_s7 = p_s7.add_run(t["sec7_title"])
        r_s7.bold = True
        r_s7.font.size = Pt(14)
        r_s7.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

        p_s7_desc = doc.add_paragraph()
        p_s7_desc.paragraph_format.space_before = Pt(0)
        p_s7_desc.paragraph_format.space_after = Pt(8)
        r_s7_desc = p_s7_desc.add_run(t["sec7_desc"])
        r_s7_desc.font.size = Pt(9.5)

        master_apps = portfolio_data.get("applications", [])

        # Master Table
        mast_table = doc.add_table(rows=len(master_apps) + 1, cols=10)
        mast_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        mast_table.autofit = False

        col_widths_m = [
            Inches(0.9), Inches(2.2), Inches(1.3), Inches(1.1),
            Inches(0.8), Inches(0.6), Inches(0.6), Inches(1.1),
            Inches(0.8), Inches(0.8)
        ]
        headers_m = [
            t["col_appx_id"], t["col_appx_name"], t["col_appx_owner"], t["col_appx_crit"],
            t["col_appx_time"], t["col_appx_bfit"], t["col_appx_tfit"], t["col_appx_tco"],
            t["col_appx_lifecycle"], t["col_appx_techrisk"]
        ]

        for idx, text in enumerate(headers_m):
            cell = mast_table.cell(0, idx)
            cell.width = col_widths_m[idx]
            _set_cell_background(cell, "0F172A")
            _set_cell_padding(cell, top=70, bottom=70, left=70, right=70)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if idx in (5, 6, 7) else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.bold = True
            r.font.size = Pt(8)
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        for r_idx, app in enumerate(master_apps, start=1):
            cost_val = app.get("total_annual_cost") or app.get("annual_cost") or 0.0
            row_vals = [
                str(app.get("id", ""))[:10],
                app.get("name", "N/A"),
                app.get("business_owner") or "-",
                app.get("business_criticality") or app.get("criticality") or "Operational",
                app.get("time_quadrant", "-"),
                str(app.get("business_fit", 3)),
                str(app.get("technical_fit", 3)),
                _format_eur(cost_val, lang),
                app.get("lifecycle_status", "Live"),
                app.get("tech_risk_level") or "Low"
            ]

            for c_idx, val in enumerate(row_vals):
                cell = mast_table.cell(r_idx, c_idx)
                cell.width = col_widths_m[c_idx]
                if r_idx % 2 == 1:
                    _set_cell_background(cell, "F8FAFC")
                _set_cell_padding(cell, top=50, bottom=50, left=60, right=60)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_idx in (5, 6, 7) else WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(val)
                r.font.size = Pt(7.5)
                if c_idx == 1:
                    r.bold = True
                elif c_idx == 4:
                    q = val
                    if q == "Invest":
                        r.font.color.rgb = RGBColor(0x05, 0x96, 0x69)
                    elif q == "Tolerate":
                        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
                    elif q == "Migrate":
                        r.font.color.rgb = RGBColor(0xD9, 0x77, 0x06)
                    elif q == "Eliminate":
                        r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)
                elif c_idx == 7:
                    r.bold = True

        _set_table_borders(mast_table, "CBD5E1")

        # Save document to in-memory buffer
        docx_stream = io.BytesIO()
        doc.save(docx_stream)
        docx_stream.seek(0)
        return docx_stream
