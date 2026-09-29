import io
import csv
import zipfile
from typing import List, Dict, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ApplicationBusinessAttributes,
    CustomAttributeDefinition
)
from app.services.metamodel_service import (
    ARCHIMATE_METAMODEL,
    ARCHIMATE_RELATIONSHIP_TYPES
)

APM_HEADERS = [
    "annual_cost", "business_fit", "technical_fit", "time_quadrant",
    "business_criticality", "lifecycle_status", "hosting_type",
    "business_owner", "technical_owner", "vendor", "data_classification", "sla_level"
]


def extract_element_property(el: ArchimateElement, attr_name: str) -> Any:
    """Safely extracts any standard, APM, or custom property from an ArchimateElement."""
    # 1. Direct core model fields
    if attr_name in ("id", "name", "type", "layer", "documentation"):
        return getattr(el, attr_name, "") or ""

    # 2. APM fields from application_business_attributes relation
    apm = el.apm_attributes
    clean_attr = attr_name.lower().replace("eea_", "")
    if apm and hasattr(apm, clean_attr):
        val = getattr(apm, clean_attr)
        if val is not None and val != "":
            return val

    # 3. Check el.properties JSON dict (both raw and eea_ prefixed)
    props = el.properties if isinstance(el.properties, dict) else {}
    if attr_name in props and props[attr_name] is not None and props[attr_name] != "":
        return props[attr_name]
    if f"eea_{attr_name}" in props and props[f"eea_{attr_name}"] is not None and props[f"eea_{attr_name}"] != "":
        return props[f"eea_{attr_name}"]
    if clean_attr in props and props[clean_attr] is not None and props[clean_attr] != "":
        return props[clean_attr]

    # 4. Standard default values for APM fields if unassigned
    if clean_attr == "annual_cost":
        return 0.0
    if clean_attr in ("business_fit", "technical_fit"):
        return 3
    if clean_attr == "time_quadrant":
        return "Tolerate"
    if clean_attr == "business_criticality":
        return "Business Operational"
    if clean_attr == "lifecycle_status":
        return "Live"
    if clean_attr == "hosting_type":
        return "Cloud"
    if clean_attr == "data_classification":
        return "Internal"

    return ""


def get_all_export_headers(
    elements: List[ArchimateElement],
    custom_attrs: List[CustomAttributeDefinition]
) -> List[str]:
    """Builds the comprehensive list of headers: Core + APM + Custom Meta + Dynamic element properties."""
    headers = ["id", "name", "type", "layer", "documentation"]
    headers.extend(APM_HEADERS)
    seen = set(headers)

    # Add custom attributes defined in database
    for ca in custom_attrs:
        if ca.name not in seen:
            headers.append(ca.name)
            seen.add(ca.name)

    # Also discover any dynamic keys inside elements' properties
    for el in elements:
        if el.properties and isinstance(el.properties, dict):
            for k in el.properties.keys():
                clean_k = k[4:] if k.startswith("eea_") else k
                if clean_k not in seen and k not in seen:
                    headers.append(clean_k)
                    seen.add(clean_k)
                    seen.add(k)

    return headers


def generate_view_excel(
    workspace: ModelWorkspace,
    elements: List[ArchimateElement],
    relationships: List[ArchimateRelationship],
    custom_attrs: List[CustomAttributeDefinition],
    view_name: Optional[str] = None,
    all_elements_map: Optional[Dict[str, str]] = None
) -> io.BytesIO:
    """
    Generates an Excel workbook (.xlsx) with 'Elements', 'Relationships', and 'Metamodel_Guide' sheets
    matching the exact structure expected by the EasyEA Data Import engine.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    # Colors and Styles
    header_fill_core = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")  # Dark Blue
    header_fill_custom = PatternFill(start_color="047857", end_color="047857", fill_type="solid")  # Emerald Green
    header_fill_rel = PatternFill(start_color="6D28D9", end_color="6D28D9", fill_type="solid")  # Purple
    guide_header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # -------------------------------------------------------------------------
    # 1. SHEET: Elements
    # -------------------------------------------------------------------------
    ws_elem = wb.create_sheet(title="Elements")
    ws_elem.views.sheetView[0].showGridLines = True

    elem_headers = get_all_export_headers(elements, custom_attrs)
    core_header_count = 5  # id, name, type, layer, documentation

    # Write Header row
    for col_idx, header_text in enumerate(elem_headers, 1):
        cell = ws_elem.cell(row=1, column=col_idx, value=header_text)
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        if col_idx <= core_header_count:
            cell.fill = header_fill_core
        else:
            cell.fill = header_fill_custom
        cell.border = thin_border

    # Write Elements Data
    for row_idx, el in enumerate(elements, start=2):
        row_data = []
        for header in elem_headers:
            val = extract_element_property(el, header)
            row_data.append(val)

        for col_idx, val in enumerate(row_data, 1):
            cell = ws_elem.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    # Auto-adjust column widths
    for col in ws_elem.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_elem.column_dimensions[col_letter].width = max(min(max_len + 4, 45), 14)

    # -------------------------------------------------------------------------
    # 2. SHEET: Relationships
    # -------------------------------------------------------------------------
    ws_rel = wb.create_sheet(title="Relationships")
    ws_rel.views.sheetView[0].showGridLines = True

    rel_headers = ["source", "target", "type", "name", "documentation"]
    for col_idx, header_text in enumerate(rel_headers, 1):
        cell = ws_rel.cell(row=1, column=col_idx, value=header_text)
        cell.font = header_font
        cell.fill = header_fill_rel
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # Build id -> name lookup map
    id_to_name = dict(all_elements_map or {})
    for e in elements:
        id_to_name[e.id] = e.name

    for row_idx, rel in enumerate(relationships, start=2):
        src_name = id_to_name.get(rel.source_id, rel.source_element.name if rel.source_element else rel.source_id)
        tgt_name = id_to_name.get(rel.target_id, rel.target_element.name if rel.target_element else rel.target_id)
        rel_row = [
            src_name,
            tgt_name,
            rel.type,
            rel.name or "",
            rel.documentation or ""
        ]
        for col_idx, val in enumerate(rel_row, 1):
            cell = ws_rel.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    for col in ws_rel.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_rel.column_dimensions[col_letter].width = max(min(max_len + 4, 45), 18)

    # -------------------------------------------------------------------------
    # 3. SHEET: Metamodel_Guide
    # -------------------------------------------------------------------------
    ws_guide = wb.create_sheet(title="Metamodel_Guide")
    ws_guide.views.sheetView[0].showGridLines = True

    guide_title_font = Font(name="Calibri", size=13, bold=True, color="1E293B")

    # Section 1: Concept Types
    ws_guide.cell(row=1, column=1, value="ArchiMate Concept Types & Layers").font = guide_title_font
    guide_headers = ["Concept Type", "Layer", "Description"]
    for col_idx, h in enumerate(guide_headers, 1):
        cell = ws_guide.cell(row=2, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = guide_header_fill
        cell.border = thin_border

    cur_row = 3
    for layer_meta in ARCHIMATE_METAMODEL:
        for elem_meta in layer_meta["element_types"]:
            ws_guide.cell(row=cur_row, column=1, value=elem_meta["type"]).border = thin_border
            ws_guide.cell(row=cur_row, column=2, value=layer_meta["layer"]).border = thin_border
            ws_guide.cell(row=cur_row, column=3, value=elem_meta["description"]).border = thin_border
            cur_row += 1

    # Section 2: Relationship Types
    cur_row += 2
    ws_guide.cell(row=cur_row, column=1, value="Permitted ArchiMate Relationship Types").font = guide_title_font
    cur_row += 1
    rel_guide_headers = ["Relationship Type", "Category", "Description"]
    for col_idx, h in enumerate(rel_guide_headers, 1):
        cell = ws_guide.cell(row=cur_row, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = guide_header_fill
        cell.border = thin_border

    cur_row += 1
    for rel_meta in ARCHIMATE_RELATIONSHIP_TYPES:
        ws_guide.cell(row=cur_row, column=1, value=rel_meta["type"]).border = thin_border
        ws_guide.cell(row=cur_row, column=2, value=rel_meta["category"]).border = thin_border
        ws_guide.cell(row=cur_row, column=3, value=rel_meta["description"]).border = thin_border
        cur_row += 1

    for col in ws_guide.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_guide.column_dimensions[col_letter].width = max(min(max_len + 4, 60), 18)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_view_csv_zip(
    workspace: ModelWorkspace,
    elements: List[ArchimateElement],
    relationships: List[ArchimateRelationship],
    custom_attrs: List[CustomAttributeDefinition],
    view_name: Optional[str] = None,
    all_elements_map: Optional[Dict[str, str]] = None
) -> io.BytesIO:
    """
    Generates a ZIP archive containing 'elements.csv' and 'relationships.csv'
    compatible with the CSV import feature.
    """
    elem_headers = get_all_export_headers(elements, custom_attrs)

    # 1. Elements CSV String
    elem_out = io.StringIO()
    elem_writer = csv.writer(elem_out)
    elem_writer.writerow(elem_headers)

    for el in elements:
        row_data = [extract_element_property(el, h) for h in elem_headers]
        elem_writer.writerow(row_data)

    # 2. Relationships CSV String
    id_to_name = dict(all_elements_map or {})
    for e in elements:
        id_to_name[e.id] = e.name

    rel_out = io.StringIO()
    rel_writer = csv.writer(rel_out)
    rel_writer.writerow(["source", "target", "type", "name", "documentation"])

    for rel in relationships:
        src_name = id_to_name.get(rel.source_id, rel.source_element.name if rel.source_element else rel.source_id)
        tgt_name = id_to_name.get(rel.target_id, rel.target_element.name if rel.target_element else rel.target_id)
        rel_writer.writerow([
            src_name,
            tgt_name,
            rel.type,
            rel.name or "",
            rel.documentation or ""
        ])

    # 3. Create ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("elements.csv", elem_out.getvalue().encode("utf-8-sig"))
        zip_file.writestr("relationships.csv", rel_out.getvalue().encode("utf-8-sig"))

    zip_buffer.seek(0)
    return zip_buffer
