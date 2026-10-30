import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, UploadFile, File, Form, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.archimate import (
    ModelWorkspace,
    SchemaFolder,
    ArchiSchema,
    SchemaVersionHistory,
    ArchimateElement,
    ArchimateRelationship,
    User,
    SystemAuthSettings
)
from app.parsers.archi_parser import ArchiModelParser, detect_layer
from app.api.deps import (
    get_current_user,
    require_library_permission,
    read_upload_bounded,
)
from app.services.auth_service import get_user_from_token, get_system_auth_settings
from app.services.schema_export_service import generate_standalone_archi_xml
from app.services.schema_diff_service import compute_schema_diff
from app.services.drawio_service import (
    export_schema_to_drawio_xml,
    parse_drawio_file_to_canonical_model,
    generate_drawio_archimate_library_xml
)
from app.services.bpmn_service import (
    export_schema_to_bpmn_xml,
    parse_bpmn_file_to_canonical_model
)
from app.services.sac_service import SaCService
from app.parsers.sac_parser import SaCParseError

router = APIRouter(prefix="/schemas", tags=["schemas"])


def _get_auth_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    return get_user_from_token(db, token)


def _require_user(authorization: Optional[str], db: Session) -> User:
    user = _get_auth_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Autenticazione richiesta.")
    return user


def _is_admin_or_lead(user: User, model_id: Optional[str] = None) -> bool:
    for a in user.role_assignments:
        if a.role in ["admin", "lead_architect"]:
            if a.model_id is None or a.model_id == model_id:
                return True
    return False


# ============================================================================
# Schemas & Pydantic DTOs
# ============================================================================

class FolderCreateRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None
    order_index: Optional[int] = 0


class FolderUpdateRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    order_index: Optional[int] = None


class SchemaCreateRequest(BaseModel):
    name: str
    folder_id: Optional[str] = None
    viewpoint: Optional[str] = "Total"
    documentation: Optional[str] = ""
    view_data: Optional[Dict[str, Any]] = None
    raw_xml: Optional[str] = None
    format: Optional[str] = None


class SchemaUpdateRequest(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[str] = None
    viewpoint: Optional[str] = None
    documentation: Optional[str] = None


class SchemaMoveRequest(BaseModel):
    folder_id: Optional[str] = None


class CheckinConfirmRequest(BaseModel):
    file_content: Optional[str] = None
    xml_content: Optional[str] = None
    raw_xml: Optional[str] = None
    commit_message: Optional[str] = "Aggiornamento schema"
    attribute_resolutions: Optional[List[Dict[str, Any]]] = None
    catalog_removals: Optional[List[Dict[str, Any]]] = None
    new_elements: Optional[List[Dict[str, Any]]] = None
    new_relationships: Optional[List[Dict[str, Any]]] = None
    overwrite_attributes: Optional[bool] = True
    remove_deleted_from_catalog: Optional[bool] = False


# ============================================================================
# FOLDERS ENDPOINTS
# ============================================================================

@router.get("/{model_id}/folders")
def get_folders(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all folders for the specified workspace."""
    folders = db.query(SchemaFolder).filter(
        SchemaFolder.model_id == model_id
    ).order_by(SchemaFolder.order_index, SchemaFolder.name).all()

    def serialize_folder(f: SchemaFolder) -> Dict[str, Any]:
        schema_count = db.query(ArchiSchema).filter(ArchiSchema.folder_id == f.id).count()
        return {
            "id": f.id,
            "model_id": f.model_id,
            "parent_id": f.parent_id,
            "name": f.name,
            "order_index": f.order_index,
            "schema_count": schema_count,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None
        }

    return [serialize_folder(f) for f in folders]


@router.post("/{model_id}/folders")
def create_folder(
    model_id: str,
    payload: FolderCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new folder or subfolder."""
    require_library_permission(db, user, "edit_diagram", model_id)
    
    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace non trovato.")

    if payload.parent_id:
        parent = db.query(SchemaFolder).filter(
            SchemaFolder.id == payload.parent_id,
            SchemaFolder.model_id == model_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Cartella genitore non trovata.")

    folder = SchemaFolder(
        id=f"folder-{uuid.uuid4().hex[:8]}",
        model_id=model_id,
        parent_id=payload.parent_id,
        name=payload.name.strip() or "Nuova Cartella",
        order_index=payload.order_index or 0
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "model_id": folder.model_id,
        "parent_id": folder.parent_id,
        "name": folder.name,
        "order_index": folder.order_index,
        "schema_count": 0
    }


@router.put("/folders/{folder_id}")
def update_folder(
    folder_id: str,
    payload: FolderUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update or rename a folder."""
    folder = db.query(SchemaFolder).filter(SchemaFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Cartella non trovata.")
    require_library_permission(db, user, "edit_diagram", folder.model_id)

    if payload.name is not None:
        folder.name = payload.name.strip() or folder.name
    if payload.parent_id is not None:
        if payload.parent_id == folder.id:
            raise HTTPException(status_code=400, detail="Una cartella non può essere genitore di se stessa.")
        folder.parent_id = payload.parent_id if payload.parent_id != "" else None
    if payload.order_index is not None:
        folder.order_index = payload.order_index

    db.commit()
    db.refresh(folder)
    return {"id": folder.id, "name": folder.name, "parent_id": folder.parent_id, "order_index": folder.order_index}


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a folder. Subfolders and schemas are cascaded or moved to parent."""
    folder = db.query(SchemaFolder).filter(SchemaFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Cartella non trovata.")
    require_library_permission(db, user, "edit_diagram", folder.model_id)

    # Reassign schemas inside this folder to root or parent
    db.query(ArchiSchema).filter(ArchiSchema.folder_id == folder.id).update(
        {"folder_id": folder.parent_id}, synchronize_session=False
    )
    # Reassign subfolders
    db.query(SchemaFolder).filter(SchemaFolder.parent_id == folder.id).update(
        {"parent_id": folder.parent_id}, synchronize_session=False
    )

    db.delete(folder)
    db.commit()
    return {"success": True, "message": "Cartella eliminata."}


# ============================================================================
# SCHEMAS CRUD ENDPOINTS
# ============================================================================

def _serialize_schema(s: ArchiSchema) -> Dict[str, Any]:
    nodes_count = len(s.view_data.get("nodes", [])) if isinstance(s.view_data, dict) else 0
    conns_count = len(s.view_data.get("connections", [])) if isinstance(s.view_data, dict) else 0
    return {
        "id": s.id,
        "model_id": s.model_id,
        "folder_id": s.folder_id,
        "name": s.name,
        "viewpoint": s.viewpoint or "Total",
        "documentation": s.documentation or "",
        "format": getattr(s, "format", "archi") or "archi",
        "status": s.status or "available",
        "locked_by_user_id": s.locked_by_user_id,
        "locked_by_username": s.locked_by_username,
        "locked_at": s.locked_at.isoformat() if s.locked_at else None,
        "current_version": s.current_version or "v1.0",
        "nodes_count": nodes_count,
        "connections_count": conns_count,
        "view_data": s.view_data if isinstance(s.view_data, dict) else {"nodes": [], "connections": []},
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/tree")
def get_schemas_tree(
    model_id: Optional[str] = Query(None, description="Filter by workspace model_id"),
    format: Optional[str] = Query(None, description="Filter by format: bpmn, drawio, archi, all"),
    status: Optional[str] = Query(None, description="Filter by status: available, checked_out"),
    search: Optional[str] = Query(None, description="Search query string"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unified endpoint to retrieve schemas tree and lists across folders and workspaces."""
    query = db.query(ArchiSchema)
    if model_id and model_id != "all":
        query = query.filter(ArchiSchema.model_id == model_id)
    if format and format != "all":
        query = query.filter(ArchiSchema.format == format)
    if status and status != "all":
        query = query.filter(ArchiSchema.status == status)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (ArchiSchema.name.ilike(term)) |
            (ArchiSchema.documentation.ilike(term)) |
            (ArchiSchema.viewpoint.ilike(term))
        )

    schemas = query.order_by(ArchiSchema.name.asc()).all()

    f_query = db.query(SchemaFolder)
    if model_id and model_id != "all":
        f_query = f_query.filter(SchemaFolder.model_id == model_id)
    folders = f_query.order_by(SchemaFolder.order_index.asc(), SchemaFolder.name.asc()).all()

    workspaces = {ws.id: ws.name for ws in db.query(ModelWorkspace).all()}

    serialized_schemas = []
    for s in schemas:
        item = _serialize_schema(s)
        item["workspace_name"] = workspaces.get(s.model_id, s.model_id)
        serialized_schemas.append(item)

    folder_map = {}
    for f in folders:
        folder_map[f.id] = {
            "id": f.id,
            "name": f.name,
            "model_id": f.model_id,
            "parent_id": f.parent_id,
            "schemas": [],
            "children": []
        }

    root_schemas = []
    for s in serialized_schemas:
        if s.get("folder_id") and s["folder_id"] in folder_map:
            folder_map[s["folder_id"]]["schemas"].append(s)
        else:
            root_schemas.append(s)

    root_folders = []
    for f_id, f_data in folder_map.items():
        if f_data["parent_id"] and f_data["parent_id"] in folder_map:
            folder_map[f_data["parent_id"]]["children"].append(f_data)
        else:
            root_folders.append(f_data)

    return {
        "schemas": serialized_schemas,
        "root_folders": root_folders,
        "root_schemas": root_schemas,
        "total_count": len(serialized_schemas)
    }


@router.get("/{model_id}/list")
def list_schemas(
    model_id: str,
    folder_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List schemas for a workspace with optional filters."""
    q = db.query(ArchiSchema).filter(ArchiSchema.model_id == model_id)
    if folder_id is not None:
        if folder_id == "__root__":
            q = q.filter(ArchiSchema.folder_id == None)
        else:
            q = q.filter(ArchiSchema.folder_id == folder_id)
    if status:
        q = q.filter(ArchiSchema.status == status)

    schemas = q.order_by(ArchiSchema.name).all()
    return [_serialize_schema(s) for s in schemas]


@router.get("/{schema_id}/detail")
def get_schema_detail(
    schema_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full schema detail including visual view_data."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    res = _serialize_schema(schema)
    res["view_data"] = schema.view_data if isinstance(schema.view_data, dict) else {"nodes": [], "connections": []}
    return res


# ============================================================================
# SCHEMA-AS-CODE (SaC) ENDPOINTS (.eac DSL)
# (Defined before parameterized /{model_id}/create to prevent route shadowing)
# ============================================================================

class SaCCompileRequest(BaseModel):
    code: str
    model_id: Optional[str] = None


class SaCSaveRequest(BaseModel):
    code: str
    commit_message: Optional[str] = "Aggiornamento da Schema-as-Code (.eac)"


class SaCCreateRequest(BaseModel):
    code: str
    model_id: str
    folder_id: Optional[str] = None


@router.post("/sac/compile")
def compile_sac_code(
    payload: SaCCompileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates and compiles Schema-as-Code (.eac) text.
    Returns the AST structure, detected elements, relationships, layout, and any syntax errors.
    """
    if payload.model_id:
        require_library_permission(db, current_user, "read_model", payload.model_id)
    try:
        compiled = SaCService.compile_sac(payload.code, db=db, model_id=payload.model_id)
        return {
            "success": True,
            "data": compiled,
            "summary": {
                "name": compiled["name"],
                "elements_count": len(compiled["elements"]),
                "relationships_count": len(compiled["relationships"]),
                "nodes_count": len(compiled.get("view_data", {}).get("nodes", []))
            }
        }
    except SaCParseError as spe:
        return {
            "success": False,
            "error": spe.message,
            "line": spe.line,
            "column": spe.column
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "line": 1,
            "column": 1
        }


@router.post("/sac/to-archimate")
def convert_sac_to_archimate_download(
    payload: SaCCompileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compiles SaC code and returns a downloadable .archimate file directly.
    """
    if payload.model_id:
        require_library_permission(db, current_user, "read_model", payload.model_id)
    try:
        compiled = SaCService.compile_sac(payload.code, db=db, model_id=payload.model_id)
        xml_content = SaCService.canonical_to_archimate_xml(compiled, db=db)
        safe_name = compiled.get("name", "Schema").replace(" ", "_").replace("/", "_")
        return Response(
            content=xml_content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.archimate"'}
        )
    except SaCParseError as spe:
        raise HTTPException(status_code=400, detail=f"Errore di sintassi SaC riga {spe.line}: {spe.message}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nella generazione ArchiMate: {str(e)}")


@router.post("/sac/create")
def create_schema_from_sac(
    payload: SaCCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a brand new schema in the specified workspace directly from a Schema-as-Code (.eac) document.
    """
    require_library_permission(db, current_user, "edit_diagram", payload.model_id)

    schema_id = f"schema-{uuid.uuid4().hex[:8]}"

    try:
        compiled = SaCService.compile_sac(payload.code, db=db, model_id=payload.model_id, schema_id=schema_id)
        archimate_xml = SaCService.canonical_to_archimate_xml(compiled, db=db)
    except SaCParseError as spe:
        raise HTTPException(status_code=400, detail=f"Errore di sintassi SaC riga {spe.line}: {spe.message}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nella compilazione SaC: {str(e)}")

    new_schema = ArchiSchema(
        id=schema_id,
        model_id=payload.model_id,
        folder_id=payload.folder_id,
        name=compiled.get("name") or "Nuovo Schema SaC",
        viewpoint=compiled.get("viewpoint") or "Total",
        documentation=compiled.get("documentation") or "",
        format="archi",
        current_version="v1.0",
        status="available",
        view_data=compiled.get("view_data", {}),
        raw_xml=archimate_xml
    )
    db.add(new_schema)

    # Initial version 1
    v1_entry = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema_id,
        version_number=1,
        version_label="v1.0",
        commit_message="Creazione iniziale da Schema-as-Code (.eac)",
        author_user_id=current_user.id,
        author_name=current_user.full_name or current_user.username or "Architetto",
        view_data_snapshot=compiled.get("view_data", {}),
        raw_xml_snapshot=archimate_xml
    )
    db.add(v1_entry)

    db.commit()
    db.refresh(new_schema)

    return {
        "success": True,
        "message": f"Schema '{new_schema.name}' creato con successo da codice SaC.",
        "schema": _serialize_schema(new_schema)
    }


@router.get("/{schema_id}/sac")
def get_schema_sac(
    schema_id: str,
    include_layout: bool = True,
    download: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Decompiles an existing schema into Schema-as-Code (.eac) format.
    Supports either JSON response or direct file download.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    require_library_permission(db, current_user, "read_model", schema.model_id)

    sac_code = SaCService.decompile_schema_to_sac(
        schema=schema,
        db=db,
        include_layout=include_layout
    )

    if download:
        safe_name = (schema.name or "schema").replace(" ", "_").replace("/", "_")
        return Response(
            content=sac_code,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.eac"'}
        )

    return {
        "success": True,
        "schema_id": schema.id,
        "schema_name": schema.name,
        "code": sac_code
    }


@router.put("/{schema_id}/sac")
def update_schema_from_sac(
    schema_id: str,
    payload: SaCSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates an existing schema by compiling the provided Schema-as-Code (.eac) source.
    Creates a new version history entry and updates view_data and raw_xml.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    require_library_permission(db, current_user, "edit_diagram", schema.model_id)

    # Check lock permissions
    if schema.status == "checked_out" and schema.locked_by_user_id != current_user.id and not _is_admin_or_lead(current_user, schema.model_id):
        raise HTTPException(
            status_code=403,
            detail=f"Lo schema è attualmente bloccato da {schema.locked_by_username}. Non puoi modificarlo."
        )

    try:
        compiled = SaCService.compile_sac(payload.code, db=db, model_id=schema.model_id, schema_id=schema.id)
        archimate_xml = SaCService.canonical_to_archimate_xml(compiled, db=db)
    except SaCParseError as spe:
        raise HTTPException(status_code=400, detail=f"Errore di sintassi SaC riga {spe.line}: {spe.message}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nella compilazione SaC: {str(e)}")

    # Update versioning
    latest_ver = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.schema_id == schema.id
    ).order_by(SchemaVersionHistory.version_number.desc()).first()

    next_num = (latest_ver.version_number + 1) if latest_ver else 2
    next_label = f"v1.{next_num - 1}"

    # Snapshot
    history_entry = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema.id,
        version_number=next_num,
        version_label=next_label,
        commit_message=payload.commit_message or "Aggiornamento da Schema-as-Code (.eac)",
        author_user_id=current_user.id,
        author_name=current_user.full_name or current_user.username or "Architetto",
        view_data_snapshot=compiled.get("view_data", {}),
        raw_xml_snapshot=archimate_xml
    )
    db.add(history_entry)

    if compiled.get("name"):
        schema.name = compiled["name"]
    if compiled.get("documentation"):
        schema.documentation = compiled["documentation"]
    if compiled.get("viewpoint"):
        schema.viewpoint = compiled["viewpoint"]

    schema.current_version = next_label
    schema.view_data = compiled.get("view_data", {})
    schema.raw_xml = archimate_xml
    schema.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(schema)

    return {
        "success": True,
        "message": f"Schema aggiornato con successo da Schema-as-Code (Versione {next_label}).",
        "schema": _serialize_schema(schema),
        "code": payload.code
    }


@router.post("/{model_id}/create")
def create_schema(
    model_id: str,
    payload: SchemaCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new schema manually or blank."""
    require_library_permission(db, user, "edit_diagram", model_id)
    
    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace non trovato.")

    schema_id = f"schema-{uuid.uuid4().hex[:8]}"
    view_data = payload.view_data or {"nodes": [], "connections": []}
    schema_format = payload.format or getattr(ws, "modeling_tool", "archi") or "archi"

    new_schema = ArchiSchema(
        id=schema_id,
        model_id=model_id,
        folder_id=payload.folder_id,
        name=payload.name.strip() or "Nuovo Schema",
        viewpoint=payload.viewpoint or "Total",
        documentation=payload.documentation or "",
        format=schema_format,
        status="available",
        current_version="v1.0",
        view_data=view_data,
        raw_xml=payload.raw_xml
    )
    db.add(new_schema)

    # Create initial version history
    initial_version = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema_id,
        version_number=1,
        version_label="v1.0",
        commit_message="Versione iniziale creata",
        author_user_id=user.id,
        author_name=user.full_name or user.username or "Architetto",
        view_data_snapshot=view_data,
        raw_xml_snapshot=payload.raw_xml
    )
    db.add(initial_version)

    db.commit()
    db.refresh(new_schema)
    return _serialize_schema(new_schema)


@router.post("/{model_id}/import-file")
async def import_schema_file(
    model_id: str,
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    schema_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Imports an .archimate, .drawio, or Open Exchange XML file into a new schema."""
    require_library_permission(db, user, "import_model_file", model_id)
    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == model_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace non trovato.")

    content = await read_upload_bounded(file)
    xml_str = content.decode("utf-8", errors="ignore")

    is_drawio = (
        file.filename.lower().endswith(".drawio")
        or "<mxfile" in xml_str
        or "<mxGraphModel" in xml_str
    )
    is_bpmn = (
        file.filename.lower().endswith(".bpmn")
        or "<bpmn:" in xml_str
        or "<bpmn2:" in xml_str
        or "<definitions" in xml_str
    )

    try:
        if is_drawio:
            parsed = parse_drawio_file_to_canonical_model(xml_str)
            schema_format = "drawio"
        elif is_bpmn:
            parsed = parse_bpmn_file_to_canonical_model(xml_str)
            schema_format = "bpmn"
        else:
            parser = ArchiModelParser(xml_str)
            parsed = parser.parse()
            schema_format = "archi"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore di parsing del file di schema: {str(e)}")

    name = schema_name or parsed.get("name") or file.filename.replace(".archimate", "").replace(".drawio", "").replace(".bpmn", "").replace(".xml", "")
    views = parsed.get("views", [])
    first_view = views[0] if views else {}
    view_data = first_view.get("view_data", {"nodes": [], "connections": []})
    viewpoint = first_view.get("viewpoint", "Total")

    # Sincronizza anche gli elementi del file nel catalogo se non presenti
    for el in parsed.get("elements", []):
        el_name = (el.get("name") or "").strip()
        el_type = el.get("type") or "ApplicationComponent"
        existing = db.query(ArchimateElement).filter(
            ArchimateElement.model_id == model_id,
            ArchimateElement.name == el_name,
            ArchimateElement.type == el_type
        ).first()
        if not existing:
            new_el = ArchimateElement(
                id=el.get("id") or f"id-{uuid.uuid4().hex[:8]}",
                model_id=model_id,
                name=el_name or f"Unnamed {el_type}",
                type=el_type,
                layer=el.get("layer") or detect_layer(el_type),
                documentation=el.get("documentation", ""),
                properties=el.get("properties", {})
            )
            db.add(new_el)

    for rel in parsed.get("relationships", []):
        rel_type = rel.get("type") or "Association"
        src_id = rel.get("source_id")
        tgt_id = rel.get("target_id")
        if src_id and tgt_id:
            existing_rel = db.query(ArchimateRelationship).filter(
                ArchimateRelationship.model_id == model_id,
                ArchimateRelationship.source_id == src_id,
                ArchimateRelationship.target_id == tgt_id,
                ArchimateRelationship.type == rel_type
            ).first()
            if not existing_rel:
                new_rel = ArchimateRelationship(
                    id=rel.get("id") or f"id-{uuid.uuid4().hex[:8]}",
                    model_id=model_id,
                    source_id=src_id,
                    target_id=tgt_id,
                    type=rel_type,
                    name=rel.get("name", ""),
                    documentation=rel.get("documentation", ""),
                    properties=rel.get("properties", {})
                )
                db.add(new_rel)

    schema_id = f"schema-{uuid.uuid4().hex[:8]}"
    new_schema = ArchiSchema(
        id=schema_id,
        model_id=model_id,
        folder_id=folder_id if folder_id and folder_id != "__root__" else None,
        name=name,
        viewpoint=viewpoint,
        documentation=parsed.get("description", ""),
        format=schema_format,
        status="available",
        current_version="v1.0",
        view_data=view_data,
        raw_xml=xml_str
    )
    db.add(new_schema)

    initial_version = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema_id,
        version_number=1,
        version_label="v1.0",
        commit_message=f"Import iniziale da file {file.filename}",
        author_user_id=user.id,
        author_name=user.full_name or user.username or "Architetto",
        view_data_snapshot=view_data,
        raw_xml_snapshot=xml_str
    )
    db.add(initial_version)

    db.commit()
    db.refresh(new_schema)
    return _serialize_schema(new_schema)


@router.put("/{schema_id}")
def update_schema(
    schema_id: str,
    payload: SchemaUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update schema name, documentation, or viewpoint."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if payload.name is not None:
        schema.name = payload.name.strip() or schema.name
    if payload.viewpoint is not None:
        schema.viewpoint = payload.viewpoint
    if payload.documentation is not None:
        schema.documentation = payload.documentation
    if payload.folder_id is not None:
        schema.folder_id = payload.folder_id if payload.folder_id != "__root__" else None

    db.commit()
    db.refresh(schema)
    return _serialize_schema(schema)


@router.put("/{schema_id}/move")
def move_schema(
    schema_id: str,
    payload: SchemaMoveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Move schema to a different folder (Drag & Drop support)."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    schema.folder_id = payload.folder_id if payload.folder_id and payload.folder_id != "__root__" else None
    db.commit()
    db.refresh(schema)
    return _serialize_schema(schema)


@router.delete("/{schema_id}")
def delete_schema(
    schema_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a schema from the repository."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if schema.status == "checked_out" and schema.locked_by_user_id != user.id and not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(status_code=403, detail="Non puoi eliminare uno schema attualmente in checkout da un altro architetto.")

    db.delete(schema)
    db.commit()
    return {"success": True, "message": "Schema eliminato."}


# ============================================================================
# CHECKOUT & LOCK MANAGEMENT
# ============================================================================

@router.get("/drawio/palette")
def download_drawio_palette(
    current_user: User = Depends(get_current_user)
):
    """Generates and downloads the ArchiMate 3.x Draw.io custom palette (.xml)."""
    palette_xml = generate_drawio_archimate_library_xml()
    return Response(
        content=palette_xml,
        media_type="application/xml",
        headers={"Content-Disposition": 'attachment; filename="EasyEA_ArchiMate3_Palette.xml"'}
    )


@router.post("/{schema_id}/checkout")
def checkout_schema(
    schema_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Locks the schema for the current user and returns the standalone XML (.archimate or .drawio).
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if schema.status == "checked_out" and schema.locked_by_user_id != user.id:
        raise HTTPException(
            status_code=409,
            detail=f"Schema già in check-out da {schema.locked_by_username or 'un altro architetto'} dal {schema.locked_at.strftime('%d/%m/%Y %H:%M') if schema.locked_at else ''}."
        )

    # Set Lock
    schema.status = "checked_out"
    schema.locked_by_user_id = user.id
    schema.locked_by_username = user.full_name or user.username or "Architetto"
    schema.locked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schema)

    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == schema.model_id).first()
    is_bpmn = (getattr(schema, "format", "archi") == "bpmn") or (ws and getattr(ws, "modeling_tool", "archi") in ["bpmn", "camunda"])
    is_drawio = (getattr(schema, "format", "archi") == "drawio") or (ws and getattr(ws, "modeling_tool", "archi") == "drawio")

    safe_name = schema.name.replace(" ", "_").replace("/", "_")
    if is_bpmn:
        xml_content = export_schema_to_bpmn_xml(schema, db)
        filename = f"{safe_name}.bpmn"
        format_type = "bpmn"
    elif is_drawio:
        xml_content = export_schema_to_drawio_xml(schema, db)
        filename = f"{safe_name}.drawio"
        format_type = "drawio"
    else:
        xml_content = generate_standalone_archi_xml(schema, db)
        filename = f"{safe_name}.archimate"
        format_type = "archi"

    return {
        "schema": _serialize_schema(schema),
        "filename": filename,
        "xml_content": xml_content,
        "format": format_type
    }


@router.get("/{schema_id}/download")
def download_schema_xml(
    schema_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download schema XML (.archimate, .drawio, or .bpmn) without locking."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    ws = db.query(ModelWorkspace).filter(ModelWorkspace.id == schema.model_id).first()
    is_bpmn = (getattr(schema, "format", "archi") == "bpmn") or (ws and getattr(ws, "modeling_tool", "archi") in ["bpmn", "camunda"])
    is_drawio = (getattr(schema, "format", "archi") == "drawio") or (ws and getattr(ws, "modeling_tool", "archi") == "drawio")
    safe_name = schema.name.replace(" ", "_").replace("/", "_")

    if is_bpmn:
        xml_content = export_schema_to_bpmn_xml(schema, db)
        filename = f"{safe_name}.bpmn"
        media_type = "application/xml"
    elif is_drawio:
        xml_content = export_schema_to_drawio_xml(schema, db)
        filename = f"{safe_name}.drawio"
        media_type = "application/xml"
    else:
        xml_content = generate_standalone_archi_xml(schema, db)
        filename = f"{safe_name}.archimate"
        media_type = "application/octet-stream"

    return Response(
        content=xml_content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/{schema_id}/discard-checkout")
def discard_checkout(
    schema_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Discards the current checkout and releases the lock without changes.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if schema.status != "checked_out":
        return {"success": True, "message": "Lo schema non era in stato di checkout.", "schema": _serialize_schema(schema)}

    # Check permission
    if schema.locked_by_user_id != user.id and not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(
            status_code=403,
            detail="Solo l'architetto che ha effettuato il check-out o un Admin/Lead Architect può annullare il checkout."
        )

    schema.status = "available"
    schema.locked_by_user_id = None
    schema.locked_by_username = None
    schema.locked_at = None
    db.commit()
    db.refresh(schema)

    return {"success": True, "message": "Check-out annullato con successo.", "schema": _serialize_schema(schema)}


@router.post("/{schema_id}/forced-unlock")
def forced_unlock(
    schema_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Forced unlock reserved for Admin / Lead Architect.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    if not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(
            status_code=403,
            detail="Operazione riservata ad Admin e Lead Architect."
        )

    schema.status = "available"
    schema.locked_by_user_id = None
    schema.locked_by_username = None
    schema.locked_at = None
    db.commit()
    db.refresh(schema)

    return {"success": True, "message": "Schema sbloccato forzatamente.", "schema": _serialize_schema(schema)}


# ============================================================================
# CHECK-IN & DIFF REVIEW
# ============================================================================

@router.post("/{schema_id}/checkin-diff")
async def checkin_diff(
    schema_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Uploads modified .archimate or .drawio file and calculates the Diff against EasyEA DB.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    # Must be locked by current user or user is admin
    if schema.status == "checked_out" and schema.locked_by_user_id != user.id and not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(
            status_code=403,
            detail=f"Lo schema è bloccato da {schema.locked_by_username}. Non puoi eseguire il check-in."
        )

    content = await read_upload_bounded(file)
    xml_str = content.decode("utf-8", errors="ignore")

    is_bpmn = (
        (file.filename and file.filename.lower().endswith(".bpmn"))
        or "<bpmn:definitions" in xml_str
        or "<definitions" in xml_str and "bpmn" in xml_str
    )
    is_drawio = not is_bpmn and (
        (file.filename and file.filename.lower().endswith(".drawio"))
        or "<mxfile" in xml_str
        or "<mxGraphModel" in xml_str
    )

    try:
        if is_bpmn:
            parsed = parse_bpmn_file_to_canonical_model(xml_str)
        elif is_drawio:
            parsed = parse_drawio_file_to_canonical_model(xml_str)
        else:
            parser = ArchiModelParser(xml_str)
            parsed = parser.parse()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nel parsing del file di schema: {str(e)}")

    diff_result = compute_schema_diff(schema, parsed, db)
    diff_result["xml_content"] = xml_str
    if is_bpmn:
        diff_result["format"] = "bpmn"
    elif is_drawio:
        diff_result["format"] = "drawio"
    else:
        diff_result["format"] = "archi"
    return diff_result


@router.post("/{schema_id}/checkin-confirm")
def checkin_confirm(
    schema_id: str,
    payload: CheckinConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Confirms Check-in: applies resolutions, creates new version snapshot,
    enforces retention of max N versions, and releases lock.
    """
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if schema.status == "checked_out" and schema.locked_by_user_id != user.id and not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(
            status_code=403,
            detail="Non hai i permessi per eseguire il check-in di questo schema."
        )

    model_id = schema.model_id
    raw_xml_text = payload.raw_xml or payload.file_content or payload.xml_content

    if len(raw_xml_text or "") > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Uploaded XML content exceeds maximum allowed size (15 MB).",
        )

    # If raw XML is provided, parse it and compute diff to ensure all new elements & relationships are captured
    parsed_model = None
    xml_to_db_id_map = {}
    
    if raw_xml_text:
        try:
            if "<mxfile" in raw_xml_text or "<mxGraphModel" in raw_xml_text:
                parsed_model = parse_drawio_file_to_canonical_model(raw_xml_text)
            elif "<bpmn:" in raw_xml_text or "<bpmn2:" in raw_xml_text or "<definitions" in raw_xml_text or schema.format == "bpmn":
                parsed_model = parse_bpmn_file_to_canonical_model(raw_xml_text)
            else:
                parser = ArchiModelParser(raw_xml_text)
                parsed_model = parser.parse()
            diff = compute_schema_diff(schema, parsed_model, db)
            if not payload.new_elements:
                payload.new_elements = diff.get("new_elements", [])
            if not payload.new_relationships:
                payload.new_relationships = diff.get("new_relationships", [])
            if not payload.attribute_resolutions:
                modified = diff.get("modified_elements", [])
                auto_res = []
                for me in modified:
                    for ch in me.get("changes", []):
                        auto_res.append({
                            "id": me.get("id"),
                            "field": ch.get("field"),
                            "prop_key": ch.get("prop_key"),
                            "new_value": ch.get("new_value"),
                            "overwrite": True
                        })
                for mr in diff.get("modified_relationships", []):
                    for ch in mr.get("changes", []):
                        auto_res.append({
                            "id": mr.get("id"),
                            "field": ch.get("field"),
                            "prop_key": ch.get("prop_key"),
                            "new_value": ch.get("new_value"),
                            "overwrite": True
                        })
                payload.attribute_resolutions = auto_res
            xml_to_db_id_map = diff.get("xml_elem_to_db_elem_id", {})
        except Exception:
            parsed_model = None

    # 1. Apply attribute resolutions (overwriting values if requested)
    if payload.attribute_resolutions:
        for res in payload.attribute_resolutions:
            if res.get("overwrite") is True:
                item_id = res.get("id")
                field = res.get("field")
                new_val = res.get("new_value")
                
                el = db.query(ArchimateElement).filter(
                    ArchimateElement.id == item_id,
                    ArchimateElement.model_id == model_id
                ).first()
                if el:
                    if field == "name" and new_val:
                        el.name = new_val
                    elif field == "type" and new_val:
                        el.type = new_val
                    elif field == "documentation":
                        el.documentation = new_val
                    elif field == "layer":
                        el.layer = new_val
                    elif field and field.startswith("prop_"):
                        prop_k = res.get("prop_key") or field[5:]
                        props = dict(el.properties or {})
                        props[prop_k] = new_val
                        el.properties = props
                else:
                    rel = db.query(ArchimateRelationship).filter(
                        ArchimateRelationship.id == item_id,
                        ArchimateRelationship.model_id == model_id
                    ).first()
                    if rel:
                        if field == "type" and new_val:
                            rel.type = new_val
                        elif field == "documentation":
                            rel.documentation = new_val
                        elif field == "name":
                            rel.name = new_val
                        elif field and field.startswith("prop_"):
                            prop_k = res.get("prop_key") or field[5:]
                            props = dict(rel.properties or {})
                            props[prop_k] = new_val
                            rel.properties = props

    # 2. Insert new elements confirmed
    if payload.new_elements:
        for ne in payload.new_elements:
            xml_id = ne.get("xml_id") or ne.get("id")
            el_name = (ne.get("name") or "").strip()
            el_type = ne.get("type") or "ApplicationComponent"

            # Check if element already exists by (name, type)
            existing_el = db.query(ArchimateElement).filter(
                ArchimateElement.model_id == model_id,
                ArchimateElement.name == el_name,
                ArchimateElement.type == el_type
            ).first()

            if existing_el:
                new_id = existing_el.id
            else:
                new_id = f"id-{uuid.uuid4().hex[:8]}"
                el_obj = ArchimateElement(
                    id=new_id,
                    model_id=model_id,
                    name=el_name or "Nuovo Elemento",
                    type=el_type,
                    layer=ne.get("layer") or detect_layer(el_type),
                    documentation=ne.get("documentation", ""),
                    properties=ne.get("properties", {})
                )
                db.add(el_obj)
            
            if xml_id:
                xml_to_db_id_map[xml_id] = new_id

    # Flush so all new element IDs exist in DB for relationships
    db.flush()

    # 3. Insert new relationships confirmed
    if payload.new_relationships:
        for nr in payload.new_relationships:
            src_xml = nr.get("source_xml_id") or nr.get("source_id")
            tgt_xml = nr.get("target_xml_id") or nr.get("target_id")
            src_id = xml_to_db_id_map.get(src_xml, src_xml)
            tgt_id = xml_to_db_id_map.get(tgt_xml, tgt_xml)
            rel_type = nr.get("type") or "AssociationRelationship"

            # Verify that source and target exist
            src_exists = db.query(ArchimateElement).filter(
                ArchimateElement.id == src_id,
                ArchimateElement.model_id == model_id
            ).first()
            tgt_exists = db.query(ArchimateElement).filter(
                ArchimateElement.id == tgt_id,
                ArchimateElement.model_id == model_id
            ).first()

            if not src_exists and src_xml:
                src_exists = db.query(ArchimateElement).filter(
                    ArchimateElement.name == nr.get("source_name", src_xml),
                    ArchimateElement.model_id == model_id
                ).first()
                if src_exists:
                    src_id = src_exists.id

            if not tgt_exists and tgt_xml:
                tgt_exists = db.query(ArchimateElement).filter(
                    ArchimateElement.name == nr.get("target_name", tgt_xml),
                    ArchimateElement.model_id == model_id
                ).first()
                if tgt_exists:
                    tgt_id = tgt_exists.id

            if src_exists and tgt_exists:
                existing_rel = db.query(ArchimateRelationship).filter(
                    ArchimateRelationship.model_id == model_id,
                    ArchimateRelationship.source_id == src_id,
                    ArchimateRelationship.target_id == tgt_id,
                    ArchimateRelationship.type == rel_type
                ).first()

                if not existing_rel:
                    rel_obj = ArchimateRelationship(
                        id=f"id-{uuid.uuid4().hex[:8]}",
                        model_id=model_id,
                        source_id=src_id,
                        target_id=tgt_id,
                        type=rel_type,
                        name=nr.get("name", ""),
                        documentation=nr.get("documentation", ""),
                        properties=nr.get("properties", {})
                    )
                    db.add(rel_obj)

    # 4. Handle removals from catalog
    if payload.catalog_removals:
        for rem in payload.catalog_removals:
            if rem.get("remove_from_catalog") is True:
                target_id = rem.get("id")
                if target_id:
                    db.query(ArchimateElement).filter(
                        ArchimateElement.id == target_id,
                        ArchimateElement.model_id == model_id
                    ).delete(synchronize_session=False)
                    db.query(ArchimateRelationship).filter(
                        ArchimateRelationship.id == target_id,
                        ArchimateRelationship.model_id == model_id
                    ).delete(synchronize_session=False)

    # 5. Parse updated view_data if XML provided
    updated_view_data = schema.view_data
    if parsed_model and parsed_model.get("views"):
        target_v = None
        for v in parsed_model["views"]:
            if (v.get("name") or "").strip().lower() == (schema.name or "").strip().lower():
                target_v = v
                break
        if not target_v:
            target_v = parsed_model["views"][0]
        
        raw_vd = target_v.get("view_data", {})
        mapped_nodes = []
        for nd in raw_vd.get("nodes", []):
            nd_copy = dict(nd)
            xml_el_id = nd.get("element_id")
            if xml_el_id in xml_to_db_id_map:
                nd_copy["element_id"] = xml_to_db_id_map[xml_el_id]
            mapped_nodes.append(nd_copy)
        
        updated_view_data = {
            "viewpoint": target_v.get("viewpoint", schema.viewpoint or "Total"),
            "nodes": mapped_nodes,
            "connections": raw_vd.get("connections", [])
        }

    # 6. Calculate next version number & label
    latest_ver = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.schema_id == schema.id
    ).order_by(SchemaVersionHistory.version_number.desc()).first()

    next_num = (latest_ver.version_number + 1) if latest_ver else 2
    next_label = f"v1.{next_num - 1}"

    # 7. Create new SchemaVersionHistory record
    new_version_record = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema.id,
        version_number=next_num,
        version_label=next_label,
        commit_message=payload.commit_message or f"Check-in {next_label}",
        author_user_id=user.id,
        author_name=user.full_name or user.username or "Architetto",
        view_data_snapshot=updated_view_data,
        raw_xml_snapshot=raw_xml_text or schema.raw_xml
    )
    db.add(new_version_record)

    # 8. Update ArchiSchema state & release lock
    schema.current_version = next_label
    schema.view_data = updated_view_data
    if raw_xml_text:
        schema.raw_xml = raw_xml_text
    schema.status = "available"
    schema.locked_by_user_id = None
    schema.locked_by_username = None
    schema.locked_at = None
    schema.updated_at = datetime.now(timezone.utc)

    # 9. Enforce max version retention from global settings
    auth_cfg = get_system_auth_settings(db)
    max_versions = auth_cfg.max_schema_versions or 10

    all_versions = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.schema_id == schema.id
    ).order_by(SchemaVersionHistory.version_number.desc()).all()

    if len(all_versions) > max_versions:
        versions_to_delete = all_versions[max_versions:]
        for v in versions_to_delete:
            db.delete(v)

    db.commit()
    db.refresh(schema)

    return {
        "success": True,
        "message": f"Check-in completato con successo ({next_label}).",
        "schema": _serialize_schema(schema)
    }


# ============================================================================
# VERSION HISTORY & ROLLBACK
# ============================================================================

@router.get("/{schema_id}/versions")
def get_version_history(
    schema_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve version history list for a schema."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    versions = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.schema_id == schema_id
    ).order_by(SchemaVersionHistory.version_number.desc()).all()

    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "version_label": v.version_label,
            "commit_message": v.commit_message or "",
            "author_user_id": v.author_user_id,
            "author_name": v.author_name or "Architetto",
            "has_raw_xml": bool(v.raw_xml_snapshot),
            "created_at": v.created_at.isoformat() if v.created_at else None
        }
        for v in versions
    ]


@router.get("/{schema_id}/versions/{version_id}/download")
def download_version_xml(
    schema_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download the Archi XML content of a past version snapshot."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")

    ver = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.id == version_id,
        SchemaVersionHistory.schema_id == schema_id
    ).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Versione storica non trovata.")

    xml_content = ver.raw_xml_snapshot
    if not xml_content:
        # Fallback to generated
        xml_content = generate_standalone_archi_xml(schema, db)

    safe_name = schema.name.replace(" ", "_").replace("/", "_")
    filename = f"{safe_name}_{ver.version_label}.archimate"

    return Response(
        content=xml_content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/{schema_id}/versions/{version_id}/rollback")
def rollback_to_version(
    schema_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Rollbacks schema to a previous version snapshot, creating a new history entry."""
    schema = db.query(ArchiSchema).filter(ArchiSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema non trovato.")
    require_library_permission(db, user, "edit_diagram", schema.model_id)

    if schema.status == "checked_out" and schema.locked_by_user_id != user.id and not _is_admin_or_lead(user, schema.model_id):
        raise HTTPException(status_code=403, detail="Non puoi effettuare il rollback di uno schema attualmente in checkout da un altro utente.")

    ver = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.id == version_id,
        SchemaVersionHistory.schema_id == schema_id
    ).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Versione storica non trovata.")

    latest_ver = db.query(SchemaVersionHistory).filter(
        SchemaVersionHistory.schema_id == schema.id
    ).order_by(SchemaVersionHistory.version_number.desc()).first()

    next_num = (latest_ver.version_number + 1) if latest_ver else 2
    next_label = f"v1.{next_num - 1}"

    # Create rollback version entry
    rollback_entry = SchemaVersionHistory(
        id=f"ver-{uuid.uuid4().hex[:8]}",
        schema_id=schema.id,
        version_number=next_num,
        version_label=next_label,
        commit_message=f"Rollback alla versione {ver.version_label}",
        author_user_id=user.id,
        author_name=user.full_name or user.username or "Architetto",
        view_data_snapshot=ver.view_data_snapshot,
        raw_xml_snapshot=ver.raw_xml_snapshot
    )
    db.add(rollback_entry)

    schema.current_version = next_label
    schema.view_data = ver.view_data_snapshot
    schema.raw_xml = ver.raw_xml_snapshot
    schema.status = "available"
    schema.locked_by_user_id = None
    schema.locked_by_username = None
    schema.locked_at = None
    schema.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(schema)

    return {
        "success": True,
        "message": f"Schema ripristinato alla versione {ver.version_label} (Nuova versione: {next_label}).",
        "schema": _serialize_schema(schema)
    }

