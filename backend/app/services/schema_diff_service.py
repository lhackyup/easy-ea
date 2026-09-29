from typing import Dict, List, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session

from app.models.archimate import (
    ArchiSchema,
    ArchimateElement,
    ArchimateRelationship
)


def _norm(val: Optional[str]) -> str:
    return (val or "").strip().lower()


def compute_schema_diff(
    schema: ArchiSchema,
    parsed_model: Dict[str, Any],
    db: Session
) -> Dict[str, Any]:
    """
    Computes differences between the uploaded Archi diagram/model and EasyEA database.
    Matching of elements and relationships is strictly based on (Name + Type).
    """
    model_id = schema.model_id

    # 1. Fetch all existing elements and relationships in the workspace
    db_elements = db.query(ArchimateElement).filter(ArchimateElement.model_id == model_id).all()
    # Lookup by (norm(name), type) -> ArchimateElement
    db_elem_by_name_type: Dict[Tuple[str, str], ArchimateElement] = {
        (_norm(e.name), e.type): e for e in db_elements
    }
    db_elem_by_id: Dict[str, ArchimateElement] = {e.id: e for e in db_elements}

    db_relationships = db.query(ArchimateRelationship).filter(ArchimateRelationship.model_id == model_id).all()
    # Lookup by (source_id, target_id, type)
    db_rel_by_endpoints: Dict[Tuple[str, str, str], ArchimateRelationship] = {
        (r.source_id, r.target_id, r.type): r for r in db_relationships
    }
    db_rel_by_id: Dict[str, ArchimateRelationship] = {r.id: r for r in db_relationships}

    # 2. Extract uploaded elements, relationships, and diagram view
    uploaded_elements: List[Dict[str, Any]] = parsed_model.get("elements", [])
    uploaded_relationships: List[Dict[str, Any]] = parsed_model.get("relationships", [])
    uploaded_views: List[Dict[str, Any]] = parsed_model.get("views", [])

    # Select target diagram view from uploaded views
    target_view = None
    if uploaded_views:
        # Match by name if possible, otherwise use first view
        for v in uploaded_views:
            if _norm(v.get("name")) == _norm(schema.name):
                target_view = v
                break
        if not target_view:
            target_view = uploaded_views[0]

    uploaded_view_data = target_view.get("view_data", {}) if target_view else {"nodes": [], "connections": []}
    uploaded_nodes = uploaded_view_data.get("nodes", [])
    uploaded_conns = uploaded_view_data.get("connections", [])

    # Uploaded element ID mapping -> (name, type)
    uploaded_elem_by_id = {e.get("id"): e for e in uploaded_elements if e.get("id")}
    uploaded_rel_by_id = {r.get("id"): r for r in uploaded_relationships if r.get("id")}

    # 3. Previous schema element and relationship IDs
    prev_view_data = schema.view_data if isinstance(schema.view_data, dict) else {}
    prev_elem_ids = {
        n.get("element_id") for n in prev_view_data.get("nodes", []) if n.get("element_id")
    }
    prev_rel_ids = {
        c.get("relationship_id") for c in prev_view_data.get("connections", []) if c.get("relationship_id")
    }

    # 4. Map uploaded diagram elements
    # Map uploaded XML ID -> DB Element ID (matched by Name + Type or created)
    xml_elem_to_db_elem_id: Dict[str, str] = {}
    
    modified_elements = []
    new_elements = []
    seen_db_elem_ids_in_upload: Set[str] = set()

    for up_elem in uploaded_elements:
        up_id = up_elem.get("id", "")
        up_name = (up_elem.get("name") or "").strip()
        up_type = up_elem.get("type", "ApplicationComponent")
        up_doc = up_elem.get("documentation", "") or ""
        up_layer = up_elem.get("layer", "Application")
        up_props = up_elem.get("properties", {}) or {}

        match_key = (_norm(up_name), up_type)
        existing_db_elem = db_elem_by_name_type.get(match_key)

        if existing_db_elem:
            db_id = existing_db_elem.id
            xml_elem_to_db_elem_id[up_id] = db_id
            seen_db_elem_ids_in_upload.add(db_id)

            # Check attribute differences
            changes = []
            if (existing_db_elem.documentation or "") != up_doc:
                changes.append({
                    "field": "documentation",
                    "label": "Documentazione",
                    "current_value": existing_db_elem.documentation or "",
                    "new_value": up_doc,
                    "overwrite": True
                })
            if existing_db_elem.layer != up_layer and up_layer:
                changes.append({
                    "field": "layer",
                    "label": "Layer",
                    "current_value": existing_db_elem.layer or "",
                    "new_value": up_layer,
                    "overwrite": True
                })
            
            # Compare properties
            cur_props = existing_db_elem.properties if isinstance(existing_db_elem.properties, dict) else {}
            all_prop_keys = set(cur_props.keys()).union(set(up_props.keys()))
            for pk in all_prop_keys:
                c_val = str(cur_props.get(pk, ""))
                n_val = str(up_props.get(pk, ""))
                if c_val != n_val and n_val != "":
                    changes.append({
                        "field": f"prop_{pk}",
                        "prop_key": pk,
                        "label": f"Proprietà: {pk}",
                        "current_value": c_val,
                        "new_value": n_val,
                        "overwrite": True
                    })

            if changes:
                modified_elements.append({
                    "id": db_id,
                    "xml_id": up_id,
                    "name": up_name,
                    "type": up_type,
                    "changes": changes
                })
        else:
            # New element to be added
            new_elements.append({
                "xml_id": up_id,
                "name": up_name,
                "type": up_type,
                "layer": up_layer,
                "documentation": up_doc,
                "properties": up_props
            })

    # 5. Check for Removed Elements (present in previous schema, but missing in upload)
    removed_elements = []
    for prev_id in prev_elem_ids:
        if prev_id not in seen_db_elem_ids_in_upload:
            el_obj = db_elem_by_id.get(prev_id)
            if el_obj:
                removed_elements.append({
                    "id": el_obj.id,
                    "name": el_obj.name,
                    "type": el_obj.type,
                    "layer": el_obj.layer,
                    "remove_from_catalog": False # Default: remove from view only, ask user if delete from catalog
                })

    # 6. Map uploaded relationships
    modified_relationships = []
    new_relationships = []
    seen_db_rel_ids_in_upload: Set[str] = set()

    for up_rel in uploaded_relationships:
        up_rel_id = up_rel.get("id", "")
        up_rel_name = up_rel.get("name", "") or ""
        up_rel_type = up_rel.get("type", "AssociationRelationship")
        up_rel_doc = up_rel.get("documentation", "") or ""
        up_rel_props = up_rel.get("properties", {}) or {}

        # Resolve source and target
        up_src_id = up_rel.get("source_id", "")
        up_tgt_id = up_rel.get("target_id", "")

        # Lookup element names
        src_up_elem = uploaded_elem_by_id.get(up_src_id)
        tgt_up_elem = uploaded_elem_by_id.get(up_tgt_id)

        src_db_id = xml_elem_to_db_elem_id.get(up_src_id)
        tgt_db_id = xml_elem_to_db_elem_id.get(up_tgt_id)

        # Try to find existing DB relationship
        existing_db_rel = None
        if src_db_id and tgt_db_id:
            existing_db_rel = db_rel_by_endpoints.get((src_db_id, tgt_db_id, up_rel_type))
            if not existing_db_rel:
                # Also check normalized types
                clean_type = up_rel_type.replace("Relationship", "").replace("archimate:", "")
                for (s, t, rt), r_obj in db_rel_by_endpoints.items():
                    if s == src_db_id and t == tgt_db_id and (clean_type in rt or rt in clean_type):
                        existing_db_rel = r_obj
                        break

        if existing_db_rel:
            seen_db_rel_ids_in_upload.add(existing_db_rel.id)
            changes = []
            if (existing_db_rel.documentation or "") != up_rel_doc:
                changes.append({
                    "field": "documentation",
                    "label": "Documentazione",
                    "current_value": existing_db_rel.documentation or "",
                    "new_value": up_rel_doc,
                    "overwrite": True
                })
            if (existing_db_rel.name or "") != up_rel_name and up_rel_name:
                changes.append({
                    "field": "name",
                    "label": "Nome Relazione",
                    "current_value": existing_db_rel.name or "",
                    "new_value": up_rel_name,
                    "overwrite": True
                })
            if changes:
                src_el = db_elem_by_id.get(existing_db_rel.source_id)
                tgt_el = db_elem_by_id.get(existing_db_rel.target_id)
                modified_relationships.append({
                    "id": existing_db_rel.id,
                    "xml_id": up_rel_id,
                    "type": existing_db_rel.type,
                    "source_name": src_el.name if src_el else existing_db_rel.source_id,
                    "target_name": tgt_el.name if tgt_el else existing_db_rel.target_id,
                    "changes": changes
                })
        else:
            # New relationship
            src_name = src_up_elem.get("name") if src_up_elem else up_src_id
            tgt_name = tgt_up_elem.get("name") if tgt_up_elem else up_tgt_id
            new_relationships.append({
                "xml_id": up_rel_id,
                "type": up_rel_type,
                "name": up_rel_name,
                "source_xml_id": up_src_id,
                "target_xml_id": up_tgt_id,
                "source_name": src_name,
                "target_name": tgt_name,
                "documentation": up_rel_doc,
                "properties": up_rel_props
            })

    # 7. Check for Removed Relationships
    removed_relationships = []
    for prev_r_id in prev_rel_ids:
        if prev_r_id not in seen_db_rel_ids_in_upload:
            rel_obj = db_rel_by_id.get(prev_r_id)
            if rel_obj:
                src_el = db_elem_by_id.get(rel_obj.source_id)
                tgt_el = db_elem_by_id.get(rel_obj.target_id)
                removed_relationships.append({
                    "id": rel_obj.id,
                    "type": rel_obj.type,
                    "name": rel_obj.name,
                    "source_name": src_el.name if src_el else rel_obj.source_id,
                    "target_name": tgt_el.name if tgt_el else rel_obj.target_id,
                    "remove_from_catalog": False
                })

    has_differences = bool(
        modified_elements or new_elements or removed_elements or
        modified_relationships or new_relationships or removed_relationships
    )

    return {
        "has_differences": has_differences,
        "summary": {
            "new_elements_count": len(new_elements),
            "modified_elements_count": len(modified_elements),
            "removed_elements_count": len(removed_elements),
            "new_relationships_count": len(new_relationships),
            "modified_relationships_count": len(modified_relationships),
            "removed_relationships_count": len(removed_relationships),
        },
        "modified_elements": modified_elements,
        "new_elements": new_elements,
        "removed_elements": removed_elements,
        "modified_relationships": modified_relationships,
        "new_relationships": new_relationships,
        "removed_relationships": removed_relationships,
        "parsed_view_data": uploaded_view_data,
        "xml_elem_to_db_elem_id": xml_elem_to_db_elem_id
    }
