import io
import os
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Response
from app.core.config import settings
from app.models.archimate import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/plugin", tags=["Archi Plugin"])

def get_plugin_src_dir() -> str | None:
    candidates = [
        # Inside container (/app/plugins/archi-easyea)
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "plugins", "archi-easyea")),
        # Inside local dev repo (/home/.../EasyEA/plugins/archi-easyea)
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plugins", "archi-easyea")),
        "/app/plugins/archi-easyea",
        os.path.abspath("plugins/archi-easyea"),
        os.path.abspath("../plugins/archi-easyea")
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.isdir(p):
            return p
    return None


def get_camunda_plugin_src_dir() -> str | None:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "plugins", "camunda-easyea")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plugins", "camunda-easyea")),
        "/app/plugins/camunda-easyea",
        os.path.abspath("plugins/camunda-easyea"),
        os.path.abspath("../plugins/camunda-easyea")
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.isdir(p):
            return p
    return None


def get_drawio_plugin_src_dir() -> str | None:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "plugins", "drawio-easyea")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plugins", "drawio-easyea")),
        "/app/plugins/drawio-easyea",
        os.path.abspath("plugins/drawio-easyea"),
        os.path.abspath("../plugins/drawio-easyea")
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.isdir(p):
            return p
    return None


@router.get("/download")
def download_archi_plugin_zip(current_user: User = Depends(get_current_user)):
    """
    Dynamically generates and returns a ZIP package containing the complete
    EasyEA Archi Plugin / jArchi scripts suite and documentation.
    """
    plugin_dir = get_plugin_src_dir()
    if not plugin_dir:
        raise HTTPException(
            status_code=404,
            detail="Cartella plugin Archi non trovata sul server."
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(plugin_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_path = os.path.relpath(abs_file, plugin_dir)
                arcname = os.path.join("archi-easyea", rel_path)
                zip_file.write(abs_file, arcname)

    zip_buffer.seek(0)
    filename = "EasyEA-Archi-Plugin.zip"

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/camunda/download")
def download_camunda_plugin_zip(current_user: User = Depends(get_current_user)):
    """
    Dynamically generates and returns a ZIP package containing the complete
    EasyEA Camunda Modeler Plugin and documentation.
    """
    plugin_dir = get_camunda_plugin_src_dir()
    if not plugin_dir:
        raise HTTPException(
            status_code=404,
            detail="Cartella plugin Camunda non trovata sul server."
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(plugin_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_path = os.path.relpath(abs_file, plugin_dir)
                arcname = os.path.join("camunda-easyea", rel_path)
                zip_file.write(abs_file, arcname)

    zip_buffer.seek(0)
    filename = "EasyEA-Camunda-Plugin.zip"

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/drawio/download")
def download_drawio_plugin_zip(current_user: User = Depends(get_current_user)):
    """
    Dynamically generates and returns a ZIP package containing the complete
    EasyEA Draw.io Desktop Plugin and documentation.
    """
    plugin_dir = get_drawio_plugin_src_dir()
    if not plugin_dir:
        raise HTTPException(
            status_code=404,
            detail="Cartella plugin Draw.io non trovata sul server."
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(plugin_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_path = os.path.relpath(abs_file, plugin_dir)
                arcname = os.path.join("drawio-easyea", rel_path)
                zip_file.write(abs_file, arcname)

    zip_buffer.seek(0)
    filename = "EasyEA-Drawio-Plugin.zip"

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
