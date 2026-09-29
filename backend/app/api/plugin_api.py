import io
import os
import zipfile
from fastapi import APIRouter, HTTPException, Response
from app.core.config import settings

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


@router.get("/download")
def download_archi_plugin_zip():
    """
    Dynamically generates and returns a ZIP package containing the complete
    EasyEA Archi Plugin / jArchi scripts suite and documentation.
    """
    plugin_dir = get_plugin_src_dir()
    if not plugin_dir:
        raise HTTPException(
            status_code=404,
            detail="Cartella plugin non trovata sul server."
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
