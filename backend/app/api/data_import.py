import io
import csv
import zipfile
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.archimate import (
    ModelWorkspace,
    ArchimateElement,
    ArchimateRelationship,
    ApplicationBusinessAttributes,
    CustomAttributeDefinition,
    ImportHistory
)
from app.services.metamodel_service import (
    ARCHIMATE_METAMODEL,
    ARCHIMATE_RELATIONSHIP_TYPES,
    ARCHIMATE_RELATIONSHIP_RULES
)
from app.api.relationships import is_rel_type_allowed, get_allowed_rel_names_for_types
from app.services.drawio_service import export_model_to_drawio, parse_and_import_drawio

router = APIRouter(prefix="/import", tags=["Data Import"])

# Build fast lookup for element types -> layer
TYPE_TO_LAYER: Dict[str, str] = {}
ALL_ELEMENT_TYPES: List[str] = []
for layer_meta in ARCHIMATE_METAMODEL:
    for elem_meta in layer_meta["element_types"]:
        TYPE_TO_LAYER[elem_meta["type"]] = layer_meta["layer"]
        ALL_ELEMENT_TYPES.append(elem_meta["type"])

APM_FIELD_TYPES = {
    "business_fit": "int",
    "technical_fit": "int",
    "annual_cost": "float",
    "time_quadrant": "str",
    "business_criticality": "str",
    "lifecycle_status": "str",
    "business_owner": "str",
    "technical_owner": "str",
    "vendor": "str",
    "hosting_type": "str",
    "data_classification": "str",
    "sla_level": "str",
    "in_apm_scope": "bool",
    "notes": "str"
}


def normalize_rel_type(rel_type_str: str) -> str:
    """Normalize e.g. 'Serving' or 'ServingRelationship' to full 'ServingRelationship'."""
    clean = rel_type_str.strip()
    if clean.endswith("Relationship"):
        return clean
    return f"{clean}Relationship"


def cast_value(raw_val: Any, data_type: str) -> Any:
    if raw_val is None or raw_val == "":
        return None
    if isinstance(raw_val, str):
        val_str = raw_val.strip()
        if not val_str:
            return None
    else:
        val_str = str(raw_val)

    if data_type in ("int", "number", "integer"):
        try:
            return int(float(val_str))
        except (ValueError, TypeError):
            try:
                return float(val_str)
            except Exception:
                return 0
    elif data_type in ("float", "double", "currency"):
        try:
            return float(val_str.replace("€", "").replace("$", "").replace(",", ".").strip())
        except Exception:
            return 0.0
    elif data_type in ("bool", "boolean"):
        lower = val_str.lower()
        return lower in ("true", "1", "yes", "si", "sì", "t", "y")
    return str(raw_val).strip()


@router.get("/template")
def download_import_template(
    model_id: Optional[str] = None,
    format: str = "xlsx",
    db: Session = Depends(get_db)
):
    """
    Generates a dynamic Excel or CSV template populated with all ArchiMate types, 
    active APM attributes, and configured custom attributes for the given library/metamodel.
    """
    # Fetch active custom attributes
    attr_query = db.query(CustomAttributeDefinition)
    if model_id:
        attr_query = attr_query.filter(
            or_(CustomAttributeDefinition.model_id == model_id, CustomAttributeDefinition.model_id.is_(None))
        )
    else:
        attr_query = attr_query.filter(CustomAttributeDefinition.model_id.is_(None))
    
    custom_attrs = attr_query.all()

    if format == "csv_elements":
        output = io.StringIO()
        writer = csv.writer(output)
        headers = ["id", "name", "type", "layer", "documentation"]
        # Add APM columns
        for k in APM_FIELD_TYPES.keys():
            headers.append(k)
        # Add Custom attributes
        for ca in custom_attrs:
            if ca.name not in headers:
                headers.append(ca.name)
        writer.writerow(headers)
        # Sample row
        writer.writerow([
            "app-001", "Core Banking Settlement Engine", "ApplicationComponent", "Application",
            "Core transaction processing and clearing engine.",
            4, 4, 120000.0, "Invest", "Mission Critical", "Live",
            "Mario Rossi", "Marco Bianchi", "FinTech Global", "Cloud", "Restricted/GDPR", "Platinum (99.9%)", True, ""
        ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="EasyEA_Elements_Template.csv"'}
        )

    if format == "csv_relationships":
        output = io.StringIO()
        writer = csv.writer(output)
        headers = ["source", "target", "type", "name", "documentation"]
        writer.writerow(headers)
        writer.writerow([
            "Core Banking Settlement Engine", "Credit Card Authorization", "ServingRelationship",
            "Serves clearing flow", "Asynchronous real-time settlement link."
        ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="EasyEA_Relationships_Template.csv"'}
        )

    # Generate XLSX template with openpyxl
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # remove default empty sheet

    # Colors and Styles
    header_fill_core = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid") # Dark Blue
    header_fill_custom = PatternFill(start_color="047857", end_color="047857", fill_type="solid") # Emerald Green
    header_fill_rel = PatternFill(start_color="6D28D9", end_color="6D28D9", fill_type="solid") # Purple
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    guide_header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # -------------------------------------------------------------
    # 1. SHEET: Elements
    # -------------------------------------------------------------
    ws_elem = wb.create_sheet(title="Elements")
    ws_elem.views.sheetView[0].showGridLines = True

    elem_headers = ["id", "name", "type", "layer", "documentation"]
    core_header_count = len(elem_headers)

    # Standard APM attributes
    apm_headers = [
        "annual_cost", "business_fit", "technical_fit", "time_quadrant",
        "business_criticality", "lifecycle_status", "hosting_type",
        "business_owner", "technical_owner", "vendor", "data_classification", "sla_level"
    ]
    elem_headers.extend(apm_headers)

    # Custom attributes from DB
    custom_col_names = []
    for ca in custom_attrs:
        if ca.name not in elem_headers:
            elem_headers.append(ca.name)
            custom_col_names.append(ca.name)

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

    # Sample rows for Elements
    sample_elements = [
        [
            "app-001", "Core Banking Settlement Engine", "ApplicationComponent", "Application",
            "High-throughput transactional engine managing core ledger postings.",
            150000.0, 5, 4, "Invest", "Mission Critical", "Live", "Private Cloud",
            "Mario Rossi", "Luca Ferrari", "FinTech Global", "Restricted/GDPR", "Platinum (99.99%)"
        ],
        [
            "proc-101", "Customer Credit Onboarding", "BusinessProcess", "Business",
            "End-to-end customer loan request and verification workflow.",
            0.0, 4, 4, "Invest", "Business Critical", "Live", "On-Premise",
            "Giulia Bianchi", "", "", "Confidential", "Gold (99.5%)"
        ],
        [
            "cap-01", "Payment & Clearing Management", "Capability", "Strategy",
            "Enterprise capacity to clear SEPA and instant wire transfers.",
            0.0, 5, 5, "Invest", "Mission Critical", "Live", "",
            "Direzione Pagamenti", "", "", "Internal", ""
        ]
    ]

    for row_idx, row_data in enumerate(sample_elements, 2):
        # Pad with empty cells for extra custom columns
        full_row = row_data + [""] * (len(elem_headers) - len(row_data))
        for col_idx, val in enumerate(full_row, 1):
            cell = ws_elem.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    # Auto-adjust column widths
    for col in ws_elem.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_elem.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # -------------------------------------------------------------
    # 2. SHEET: Relationships
    # -------------------------------------------------------------
    ws_rel = wb.create_sheet(title="Relationships")
    ws_rel.views.sheetView[0].showGridLines = True

    rel_headers = ["source", "target", "type", "name", "documentation"]
    for col_idx, header_text in enumerate(rel_headers, 1):
        cell = ws_rel.cell(row=1, column=col_idx, value=header_text)
        cell.font = header_font
        cell.fill = header_fill_rel
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    sample_relationships = [
        [
            "Core Banking Settlement Engine", "Customer Credit Onboarding", "ServingRelationship",
            "Serves credit disbursements", "Provides real-time balance posting upon approval."
        ],
        [
            "Core Banking Settlement Engine", "Payment & Clearing Management", "RealizationRelationship",
            "Realizes clearing capability", "Implements ISO20022 clearing interfaces."
        ]
    ]

    for row_idx, row_data in enumerate(sample_relationships, 2):
        for col_idx, val in enumerate(row_data, 1):
            cell = ws_rel.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    for col in ws_rel.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_rel.column_dimensions[col_letter].width = max(max_len + 4, 20)

    # -------------------------------------------------------------
    # 3. SHEET: Metamodel_Guide
    # -------------------------------------------------------------
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
    rel_guide_headers = ["Relationship Type", "Short Name", "Category", "Description"]
    for col_idx, h in enumerate(rel_guide_headers, 1):
        cell = ws_guide.cell(row=cur_row, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = guide_header_fill
        cell.border = thin_border
    
    cur_row += 1
    for rel_meta in ARCHIMATE_RELATIONSHIP_TYPES:
        ws_guide.cell(row=cur_row, column=1, value=rel_meta["type"]).border = thin_border
        ws_guide.cell(row=cur_row, column=2, value=rel_meta["name"]).border = thin_border
        ws_guide.cell(row=cur_row, column=3, value=rel_meta.get("category", "Structural")).border = thin_border
        ws_guide.cell(row=cur_row, column=4, value=rel_meta.get("description", "")).border = thin_border
        cur_row += 1

    for col in ws_guide.columns:
        col_letter = get_column_letter(col[0].column)
        ws_guide.column_dimensions[col_letter].width = 30

    # Output to buffer
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"EasyEA_Architecture_Import_Template.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/upload")
async def upload_import_file(
    model_id: str = Form(...),
    file: UploadFile = File(...),
    dry_run: bool = Form(False),
    update_existing: bool = Form(True),
    user_name: Optional[str] = Form("Architect"),
    db: Session = Depends(get_db)
):
    """
    Parses and imports ArchiMate elements and relationships from Excel (.xlsx) or CSV files.
    Supports dry_run preview, strict ArchiMate 3.x metamodel validation, dynamic attribute assignment, 
    and persistent history logging.
    """
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail=f"Model workspace '{model_id}' not found.")

    contents = await file.read()
    filename = file.filename or "unknown_import"
    lower_filename = filename.lower()
    file_size = len(contents)

    # Fetch custom attribute definitions for mapping
    attr_defs = db.query(CustomAttributeDefinition).filter(
        or_(CustomAttributeDefinition.model_id == model_id, CustomAttributeDefinition.model_id.is_(None))
    ).all()
    
    attr_map_by_name = {a.name.lower(): a for a in attr_defs}
    attr_map_by_label = {a.label.lower(): a for a in attr_defs}

    # Fetch existing elements in workspace for ID/Name resolution and updates
    existing_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
    db_elem_by_id = {e.id: e for e in existing_elements}
    db_elem_by_name = {e.name.lower().strip(): e for e in existing_elements}

    parsed_elements: List[Dict[str, Any]] = []
    parsed_relationships: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    file_format = "xlsx"
    if lower_filename.endswith(".csv"):
        file_format = "csv"
    elif lower_filename.endswith(".zip"):
        file_format = "zip"

    # =========================================================================
    # 1. PARSING
    # =========================================================================
    if file_format == "xlsx":
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid or corrupted Excel file: {str(e)}")

        sheet_names_lower = {s.lower().strip(): s for s in wb.sheetnames}
        
        # Parse Elements Sheet
        elem_sheet_name = None
        for candidate in ["elements", "oggetti", "elementi", "components", "sheet1"]:
            if candidate in sheet_names_lower:
                elem_sheet_name = sheet_names_lower[candidate]
                break
        if not elem_sheet_name and len(wb.sheetnames) > 0:
            elem_sheet_name = wb.sheetnames[0]

        if elem_sheet_name:
            ws_elem = wb[elem_sheet_name]
            rows = list(ws_elem.iter_rows(values_only=True))
            if rows and len(rows) > 1:
                header_row = [str(c).strip() if c is not None else "" for c in rows[0]]
                for r_idx, r_values in enumerate(rows[1:], start=2):
                    if not any(r_values):
                        continue
                    row_dict = {}
                    for col_idx, h_name in enumerate(header_row):
                        if h_name and col_idx < len(r_values):
                            row_dict[h_name] = r_values[col_idx]
                    parsed_elements.append({"row_num": r_idx, "data": row_dict})

        # Parse Relationships Sheet
        rel_sheet_name = None
        for candidate in ["relationships", "relazioni", "links", "edges", "sheet2"]:
            if candidate in sheet_names_lower:
                rel_sheet_name = sheet_names_lower[candidate]
                break

        if rel_sheet_name:
            ws_rel = wb[rel_sheet_name]
            rows_rel = list(ws_rel.iter_rows(values_only=True))
            if rows_rel and len(rows_rel) > 1:
                header_rel = [str(c).strip() if c is not None else "" for c in rows_rel[0]]
                for r_idx, r_values in enumerate(rows_rel[1:], start=2):
                    if not any(r_values):
                        continue
                    row_dict = {}
                    for col_idx, h_name in enumerate(header_rel):
                        if h_name and col_idx < len(r_values):
                            row_dict[h_name] = r_values[col_idx]
                    parsed_relationships.append({"row_num": r_idx, "data": row_dict})

    elif file_format == "csv":
        try:
            text = contents.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = contents.decode("latin-1")
        
        reader = list(csv.DictReader(io.StringIO(text)))
        if reader:
            first_row_keys = [k.lower().strip() for k in reader[0].keys() if k]
            if "source" in first_row_keys and "target" in first_row_keys:
                for r_idx, r in enumerate(reader, start=2):
                    parsed_relationships.append({"row_num": r_idx, "data": r})
            else:
                for r_idx, r in enumerate(reader, start=2):
                    parsed_elements.append({"row_num": r_idx, "data": r})

    elif file_format == "zip":
        try:
            with zipfile.ZipFile(io.BytesIO(contents)) as z:
                for name in z.namelist():
                    lower_name = name.lower()
                    if lower_name.endswith(".csv"):
                        csv_text = z.read(name).decode("utf-8-sig")
                        reader = list(csv.DictReader(io.StringIO(csv_text)))
                        if not reader:
                            continue
                        first_keys = [k.lower().strip() for k in reader[0].keys() if k]
                        if "source" in first_keys and "target" in first_keys:
                            for r_idx, r in enumerate(reader, start=2):
                                parsed_relationships.append({"row_num": r_idx, "data": r, "file": name})
                        else:
                            for r_idx, r in enumerate(reader, start=2):
                                parsed_elements.append({"row_num": r_idx, "data": r, "file": name})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {str(e)}")

    # =========================================================================
    # 2. VALIDATION & TRANSFORMATION: ELEMENTS
    # =========================================================================
    processed_elements: List[Dict[str, Any]] = []
    elements_lookup_by_id: Dict[str, Dict[str, Any]] = {}
    elements_lookup_by_name: Dict[str, Dict[str, Any]] = {}

    # Seed lookup with existing DB elements
    for e in existing_elements:
        item = {"id": e.id, "name": e.name, "type": e.type, "layer": e.layer, "is_new": False}
        elements_lookup_by_id[e.id] = item
        elements_lookup_by_name[e.name.lower().strip()] = item

    for item in parsed_elements:
        row_num = item["row_num"]
        raw = item["data"]
        
        # Standard fields resolution
        elem_name = str(raw.get("name") or raw.get("Name") or raw.get("Nome") or "").strip()
        if not elem_name:
            errors.append({
                "type": "element",
                "row": row_num,
                "message": "Missing required field 'name'."
            })
            continue

        raw_type = str(raw.get("type") or raw.get("Type") or raw.get("Tipo") or "ApplicationComponent").strip()
        # Clean type name
        matched_type = None
        for valid_type in ALL_ELEMENT_TYPES:
            if valid_type.lower() == raw_type.lower() or valid_type.lower() == raw_type.lower().replace(" ", ""):
                matched_type = valid_type
                break
        
        if not matched_type:
            matched_type = "ApplicationComponent"
            warnings.append({
                "type": "element",
                "row": row_num,
                "element_name": elem_name,
                "message": f"Unknown ArchiMate concept type '{raw_type}'. Defaulted to 'ApplicationComponent'."
            })

        # Layer resolution
        raw_layer = str(raw.get("layer") or raw.get("Layer") or "").strip()
        matched_layer = TYPE_TO_LAYER.get(matched_type, "Application")
        if raw_layer and raw_layer.capitalize() in ["Business", "Application", "Technology", "Strategy", "Motivation", "Implementation"]:
            matched_layer = raw_layer.capitalize()

        doc = str(raw.get("documentation") or raw.get("Documentation") or raw.get("description") or "").strip()

        # Identifier resolution (match existing or generate)
        raw_id = str(raw.get("id") or raw.get("Id") or raw.get("ID") or "").strip()
        existing_match = None
        if raw_id and raw_id in db_elem_by_id:
            existing_match = db_elem_by_id[raw_id]
        elif elem_name.lower() in db_elem_by_name:
            existing_match = db_elem_by_name[elem_name.lower()]

        is_update = existing_match is not None and update_existing
        elem_id = existing_match.id if existing_match else (raw_id if raw_id else f"elem-{uuid.uuid4().hex[:8]}")

        # Attribute extraction (APM + Custom Attributes)
        properties: Dict[str, Any] = dict(existing_match.properties) if existing_match and existing_match.properties else {}
        apm_data: Dict[str, Any] = {}

        for k, v in raw.items():
            if v is None or v == "":
                continue
            k_clean = k.strip()
            k_lower = k_clean.lower()
            if k_lower in ("id", "name", "type", "layer", "documentation", "description", "nome", "tipo"):
                continue
            
            # Check APM field
            if k_lower in APM_FIELD_TYPES:
                cast_val = cast_value(v, APM_FIELD_TYPES[k_lower])
                apm_data[k_lower] = cast_val
                properties[k_lower] = cast_val
                continue

            # Check Custom Attributes
            target_def = attr_map_by_name.get(k_lower) or attr_map_by_label.get(k_lower)
            if target_def:
                cast_val = cast_value(v, target_def.data_type)
                properties[target_def.name] = cast_val
            else:
                # Save as generic property
                properties[k_clean] = v

        elem_record = {
            "id": elem_id,
            "name": elem_name,
            "type": matched_type,
            "layer": matched_layer,
            "documentation": doc,
            "properties": properties,
            "apm_data": apm_data,
            "is_update": is_update,
            "row_num": row_num
        }
        processed_elements.append(elem_record)

        lookup_entry = {"id": elem_id, "name": elem_name, "type": matched_type, "layer": matched_layer, "is_new": not is_update}
        elements_lookup_by_id[elem_id] = lookup_entry
        elements_lookup_by_name[elem_name.lower()] = lookup_entry

    # =========================================================================
    # 3. VALIDATION & TRANSFORMATION: RELATIONSHIPS
    # =========================================================================
    processed_relationships: List[Dict[str, Any]] = []

    for item in parsed_relationships:
        row_num = item["row_num"]
        raw = item["data"]

        src_val = str(raw.get("source") or raw.get("Source") or raw.get("source_id") or raw.get("Sorgente") or "").strip()
        tgt_val = str(raw.get("target") or raw.get("Target") or raw.get("target_id") or raw.get("Destinazione") or "").strip()
        rel_type_raw = str(raw.get("type") or raw.get("Type") or raw.get("relationship_type") or raw.get("Tipo") or "ServingRelationship").strip()
        rel_name = str(raw.get("name") or raw.get("Name") or raw.get("label") or "").strip()
        rel_doc = str(raw.get("documentation") or raw.get("Documentation") or raw.get("description") or "").strip()

        if not src_val or not tgt_val:
            errors.append({
                "type": "relationship",
                "row": row_num,
                "message": "Both 'source' and 'target' are required for relationships."
            })
            continue

        # Resolve Source
        src_elem = elements_lookup_by_id.get(src_val) or elements_lookup_by_name.get(src_val.lower())
        if not src_elem:
            errors.append({
                "type": "relationship",
                "row": row_num,
                "message": f"Source element '{src_val}' not found in library or import elements."
            })
            continue

        # Resolve Target
        tgt_elem = elements_lookup_by_id.get(tgt_val) or elements_lookup_by_name.get(tgt_val.lower())
        if not tgt_elem:
            errors.append({
                "type": "relationship",
                "row": row_num,
                "message": f"Target element '{tgt_val}' not found in library or import elements."
            })
            continue

        norm_type = normalize_rel_type(rel_type_raw)

        # Validate ArchiMate 3.x Rules
        if not is_rel_type_allowed(src_elem["type"], tgt_elem["type"], norm_type):
            allowed_list = get_allowed_rel_names_for_types(src_elem["type"], tgt_elem["type"])
            errors.append({
                "type": "relationship",
                "row": row_num,
                "source": src_elem["name"],
                "target": tgt_elem["name"],
                "attempted_type": norm_type,
                "message": f"Invalid ArchiMate 3.x relationship '{norm_type}' between '{src_elem['type']}' and '{tgt_elem['type']}'. Allowed types: {', '.join(allowed_list)}"
            })
            continue

        rel_record = {
            "id": f"rel-{uuid.uuid4().hex[:8]}",
            "source_id": src_elem["id"],
            "source_name": src_elem["name"],
            "source_type": src_elem["type"],
            "target_id": tgt_elem["id"],
            "target_name": tgt_elem["name"],
            "target_type": tgt_elem["type"],
            "type": norm_type,
            "name": rel_name,
            "documentation": rel_doc,
            "row_num": row_num
        }
        processed_relationships.append(rel_record)

    # Summary Statistics
    created_count = sum(1 for e in processed_elements if not e["is_update"])
    updated_count = sum(1 for e in processed_elements if e["is_update"])
    rel_created_count = len(processed_relationships)
    errors_count = len(errors)
    warnings_count = len(warnings)

    overall_status = "success"
    if errors_count > 0 and (created_count > 0 or updated_count > 0 or rel_created_count > 0):
        overall_status = "partial_success"
    elif errors_count > 0 and created_count == 0 and updated_count == 0 and rel_created_count == 0:
        overall_status = "failed"

    # =========================================================================
    # 4. DRY RUN PREVIEW RESPONSE
    # =========================================================================
    if dry_run:
        return {
            "dry_run": True,
            "status": overall_status,
            "filename": filename,
            "file_format": file_format,
            "elements_created": created_count,
            "elements_updated": updated_count,
            "relationships_created": rel_created_count,
            "errors_count": errors_count,
            "warnings_count": warnings_count,
            "elements": processed_elements,
            "relationships": processed_relationships,
            "errors": errors,
            "warnings": warnings
        }

    # =========================================================================
    # 5. EXECUTE IMPORT (COMMIT TO DATABASE)
    # =========================================================================
    try:
        # Save / Update Elements
        for elem_data in processed_elements:
            elem = db.query(ArchimateElement).filter(ArchimateElement.id == elem_data["id"]).first()
            if not elem:
                elem = ArchimateElement(
                    id=elem_data["id"],
                    model_id=model_id,
                    name=elem_data["name"],
                    type=elem_data["type"],
                    layer=elem_data["layer"],
                    documentation=elem_data["documentation"],
                    properties=elem_data["properties"]
                )
                db.add(elem)
            else:
                elem.name = elem_data["name"]
                elem.type = elem_data["type"]
                elem.layer = elem_data["layer"]
                elem.documentation = elem_data["documentation"]
                elem.properties = elem_data["properties"]

            db.flush()

            # APM Attributes Synchronization for ApplicationComponent
            if elem_data["type"] == "ApplicationComponent":
                apm = db.query(ApplicationBusinessAttributes).filter(
                    ApplicationBusinessAttributes.element_id == elem.id
                ).first()
                if not apm:
                    apm = ApplicationBusinessAttributes(element_id=elem.id)
                    db.add(apm)

                # Sync APM fields from apm_data or properties
                for field in [
                    "business_fit", "technical_fit", "time_quadrant", "annual_cost",
                    "business_criticality", "lifecycle_status", "business_owner",
                    "technical_owner", "vendor", "hosting_type", "data_classification",
                    "sla_level", "in_apm_scope", "notes"
                ]:
                    if field in elem_data["apm_data"]:
                        setattr(apm, field, elem_data["apm_data"][field])
                    elif field in elem_data["properties"]:
                        setattr(apm, field, elem_data["properties"][field])

        # Save Relationships
        for rel_data in processed_relationships:
            # Check if identical relationship already exists
            existing_rel = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.model_id == model_id,
                ArchimateRelationship.source_id == rel_data["source_id"],
                ArchimateRelationship.target_id == rel_data["target_id"],
                ArchimateRelationship.type == rel_data["type"]
            ).first()

            if not existing_rel:
                rel = ArchimateRelationship(
                    id=rel_data["id"],
                    model_id=model_id,
                    source_id=rel_data["source_id"],
                    target_id=rel_data["target_id"],
                    type=rel_data["type"],
                    name=rel_data["name"],
                    documentation=rel_data["documentation"]
                )
                db.add(rel)
            else:
                if rel_data["name"]:
                    existing_rel.name = rel_data["name"]
                if rel_data["documentation"]:
                    existing_rel.documentation = rel_data["documentation"]

        # Record in Import History
        history_id = f"imp-{uuid.uuid4().hex[:8]}"
        history_record = ImportHistory(
            id=history_id,
            model_id=model_id,
            filename=filename,
            file_format=file_format,
            file_size_bytes=file_size,
            user_name=user_name or "Architect",
            status=overall_status,
            elements_created=created_count,
            elements_updated=updated_count,
            relationships_created=rel_created_count,
            errors_count=errors_count,
            warnings_count=warnings_count,
            details={
                "errors": errors,
                "warnings": warnings,
                "created_elements": [{"id": e["id"], "name": e["name"], "type": e["type"]} for e in processed_elements if not e["is_update"]],
                "updated_elements": [{"id": e["id"], "name": e["name"], "type": e["type"]} for e in processed_elements if e["is_update"]],
                "created_relationships": [{"source": r["source_name"], "target": r["target_name"], "type": r["type"]} for r in processed_relationships]
            }
        )
        db.add(history_record)
        db.commit()

        return {
            "success": True,
            "import_id": history_id,
            "status": overall_status,
            "filename": filename,
            "elements_created": created_count,
            "elements_updated": updated_count,
            "relationships_created": rel_created_count,
            "errors_count": errors_count,
            "warnings_count": warnings_count,
            "errors": errors,
            "warnings": warnings
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database import failure: {str(e)}")


@router.get("/history", response_model=List[Dict[str, Any]])
def list_import_history(model_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieves all past import logs, ordered chronologically descending."""
    query = db.query(ImportHistory)
    if model_id:
        query = query.filter(ImportHistory.model_id == model_id)
    
    records = query.order_by(ImportHistory.imported_at.desc()).all()
    results = []
    for r in records:
        results.append({
            "id": r.id,
            "model_id": r.model_id,
            "filename": r.filename,
            "file_format": r.file_format,
            "file_size_bytes": r.file_size_bytes,
            "user_name": r.user_name,
            "status": r.status,
            "elements_created": r.elements_created,
            "elements_updated": r.elements_updated,
            "relationships_created": r.relationships_created,
            "errors_count": r.errors_count,
            "warnings_count": r.warnings_count,
            "imported_at": r.imported_at.isoformat() if r.imported_at else None
        })
    return results


@router.get("/history/{history_id}")
def get_import_history_detail(history_id: str, db: Session = Depends(get_db)):
    """Retrieves full detailed log for a specific past import execution."""
    record = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Import history record '{history_id}' not found.")
    
    return {
        "id": record.id,
        "model_id": record.model_id,
        "filename": record.filename,
        "file_format": record.file_format,
        "file_size_bytes": record.file_size_bytes,
        "user_name": record.user_name,
        "status": record.status,
        "elements_created": record.elements_created,
        "elements_updated": record.elements_updated,
        "relationships_created": record.relationships_created,
        "errors_count": record.errors_count,
        "warnings_count": record.warnings_count,
        "imported_at": record.imported_at.isoformat() if record.imported_at else None,
        "details": record.details
    }


@router.delete("/history/{history_id}")
def delete_import_history(history_id: str, db: Session = Depends(get_db)):
    """Deletes an import history entry."""
    record = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Import history record '{history_id}' not found.")
    
    db.delete(record)
    db.commit()
    return {"message": "History entry deleted successfully."}


@router.get("/drawio/export")
def export_model_drawio(model_id: str, db: Session = Depends(get_db)):
    """Exports all views of a model into a multi-diagram .drawio XML package."""
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Model Workspace not found")
    
    xml_content = export_model_to_drawio(model_id, db)
    filename = f"{workspace.name.replace(' ', '_')}_Architecture_Views.drawio"
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/drawio")
async def import_drawio_file_endpoint(
    model_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads and imports a .drawio diagram file, extracting elements,
    relationships, and diagram views into the model.
    """
    workspace = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Model Workspace not found")

    content_bytes = await file.read()
    try:
        xml_str = content_bytes.decode("utf-8")
    except Exception:
        raise HTTPException(status_code=400, detail="Il file fornito non è un file XML/Draw.io UTF-8 valido.")

    try:
        res = parse_and_import_drawio(model_id, xml_str, db)
        
        # Log to ImportHistory
        hist = ImportHistory(
            id=f"hist-{uuid.uuid4().hex[:12]}",
            model_id=model_id,
            filename=file.filename or "diagram.drawio",
            file_format="drawio",
            file_size_bytes=len(content_bytes),
            user_name="Architect",
            status="SUCCESS",
            elements_created=res.get("created_elements", 0),
            elements_updated=0,
            relationships_created=res.get("created_relations", 0),
            errors_count=0,
            warnings_count=0,
            details=[f"Importate {res.get('imported_views', 0)} viste da file Draw.io."]
        )
        db.add(hist)
        db.commit()

        return res
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Errore durante l'importazione Draw.io: {str(e)}")

