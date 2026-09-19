from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.models.archimate import ModelWorkspace
from app.services.sample_data import seed_sample_model
from app.services.metamodel_service import seed_default_custom_attributes
from app.services.rbac_service import seed_default_rbac

from app.api.models import router as models_router
from app.api.elements import router as elements_router
from app.api.relationships import router as relationships_router
from app.api.views import router as views_router
from app.api.apm import router as apm_router
from app.api.overlap import router as overlap_router
from app.api.processes import router as processes_router
from app.api.metamodel import router as metamodel_router
from app.api.rbac import router as rbac_router
from app.api.auth import router as auth_router

from sqlalchemy import text

# Create Database tables
Base.metadata.create_all(bind=engine)

# Auto-migrate columns if needed (cross-compatible with SQLite and PostgreSQL)
def _safe_add_column(table_name: str, column_def: str):
    col_name = column_def.split()[0]
    with engine.connect() as conn:
        try:
            # Check if column exists
            if engine.dialect.name == "sqlite":
                res = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
                existing = [r[1] for r in res]
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_def};"))
                    conn.commit()
            else:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_def};"))
                conn.commit()
        except Exception as exc:
            print(f"Migration note ({table_name}.{col_name}): {exc}")

_safe_add_column("application_business_attributes", "in_apm_scope BOOLEAN DEFAULT TRUE")
_safe_add_column("model_workspaces", "code VARCHAR(4)")
_safe_add_column("custom_attribute_definitions", "model_id VARCHAR")
_safe_add_column("custom_attribute_definitions", "library_code VARCHAR(4)")
_safe_add_column("custom_attribute_definitions", "section VARCHAR DEFAULT 'Custom Attributes'")
_safe_add_column("custom_attribute_definitions", "is_system BOOLEAN DEFAULT FALSE")
_safe_add_column("users", "username VARCHAR")
_safe_add_column("users", "password_hash VARCHAR")
_safe_add_column("users", "auth_provider VARCHAR DEFAULT 'local'")
_safe_add_column("users", "external_id VARCHAR")


# Auto-seed sample model, backfill codes and default custom attributes if needed
db = SessionLocal()
try:
    if not db.query(ModelWorkspace).first():
        seed_sample_model(db)
    else:
        # Backfill any missing library codes
        unassigned_models = db.query(ModelWorkspace).filter(ModelWorkspace.code == None).all()
        used_codes = {m.code for m in db.query(ModelWorkspace.code).filter(ModelWorkspace.code != None).all() if m.code}
        for model in unassigned_models:
            if model.id == "sample-easybank-ea":
                candidate = "EASY"
            else:
                letters = "".join([c.upper() for c in (model.name or model.id) if c.isalpha()])
                candidate = (letters[:4] if len(letters) >= 4 else (letters + "XXXX")[:4])
            
            # Ensure candidate is unique
            base = candidate[:3] if len(candidate) >= 3 else "MOD"
            suffix_char = ord('A')
            while candidate in used_codes:
                candidate = f"{base[:3]}{chr(suffix_char)}"
                suffix_char += 1
                if suffix_char > ord('Z'):
                    suffix_char = ord('A')
                    base = f"{base[:2]}X"
            model.code = candidate
            used_codes.add(candidate)
        db.commit()

    seed_default_custom_attributes(db)
    seed_default_rbac(db)
    from app.services.auth_service import get_system_auth_settings
    get_system_auth_settings(db)
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Cloud-native Business-Oriented Enterprise Architecture Platform with ArchiMate & APM"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(models_router, prefix=settings.API_V1_STR)
app.include_router(elements_router, prefix=settings.API_V1_STR)
app.include_router(relationships_router, prefix=settings.API_V1_STR)
app.include_router(views_router, prefix=settings.API_V1_STR)
app.include_router(apm_router, prefix=settings.API_V1_STR)
app.include_router(overlap_router, prefix=settings.API_V1_STR)
app.include_router(processes_router, prefix=settings.API_V1_STR)
app.include_router(metamodel_router, prefix=settings.API_V1_STR)
app.include_router(rbac_router, prefix=settings.API_V1_STR)
app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": settings.VERSION}

# Serve static frontend build if present (for single container deployment)
frontend_dist = "/frontend/dist" if os.path.exists("/frontend/dist") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
