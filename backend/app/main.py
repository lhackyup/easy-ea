from fastapi import FastAPI, Request
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
from app.api.data_import import router as data_import_router
from app.api.saved_views import router as saved_views_router
from app.api.schemas import router as schemas_router
from app.api.plugin_api import router as plugin_router
from app.api.business_views import router as business_views_router
from app.api.adrs import router as adrs_router
from app.api.resilience import router as resilience_router

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
_safe_add_column("model_workspaces", "modeling_tool VARCHAR DEFAULT 'archi'")
_safe_add_column("archi_schemas", "format VARCHAR DEFAULT 'archi'")
_safe_add_column("custom_attribute_definitions", "model_id VARCHAR")
_safe_add_column("custom_attribute_definitions", "library_code VARCHAR(4)")
_safe_add_column("custom_attribute_definitions", "section VARCHAR DEFAULT 'Custom Attributes'")
_safe_add_column("custom_attribute_definitions", "is_system BOOLEAN DEFAULT FALSE")
_safe_add_column("users", "username VARCHAR")
_safe_add_column("users", "password_hash VARCHAR")
_safe_add_column("users", "auth_provider VARCHAR DEFAULT 'local'")
_safe_add_column("users", "external_id VARCHAR")
_safe_add_column("system_auth_settings", "max_schema_versions INTEGER DEFAULT 10")
_safe_add_column("archimate_elements", "stereotype_id VARCHAR")
_safe_add_column("archimate_elements", "is_reference BOOLEAN DEFAULT FALSE")
_safe_add_column("archimate_elements", "package_id VARCHAR")
_safe_add_column("archimate_relationships", "is_reference BOOLEAN DEFAULT FALSE")
_safe_add_column("archimate_relationships", "package_id VARCHAR")
_safe_add_column("attribute_packages", "package_type VARCHAR(32) DEFAULT 'attribute_only'")
_safe_add_column("attribute_packages", "standard_version VARCHAR(32)")
_safe_add_column("attribute_packages", "website_url VARCHAR(255)")
_safe_add_column("attribute_packages", "version VARCHAR(32) DEFAULT '1.0.0'")
_safe_add_column("attribute_packages", "author VARCHAR(255)")
_safe_add_column("attribute_packages", "license VARCHAR(64)")
_safe_add_column("element_stereotypes", "package_id VARCHAR")
_safe_add_column("package_views", "sort_order INTEGER DEFAULT 0")
_safe_add_column("package_views", "model_id VARCHAR")
_safe_add_column("package_views", "is_global BOOLEAN DEFAULT FALSE")
_safe_add_column("package_views", "target_types JSON DEFAULT '[]'")
_safe_add_column("package_views", "author VARCHAR")
_safe_add_column("package_views", "is_active BOOLEAN DEFAULT TRUE")
_safe_add_column("package_views", "target_hub VARCHAR(32) DEFAULT 'business'")
_safe_add_column("architecture_decision_records", "archimate_element_id VARCHAR")

def _safe_alter_column(table_name: str, sql_action: str):
    with engine.connect() as conn:
        try:
            if engine.dialect.name == "postgresql":
                conn.execute(text(f"ALTER TABLE {table_name} {sql_action};"))
                conn.commit()
        except Exception as exc:
            print(f"Migration note ({table_name} {sql_action}): {exc}")

_safe_alter_column("attribute_packages", "ALTER COLUMN code TYPE VARCHAR(32)")
_safe_alter_column("archimate_elements", "ALTER COLUMN model_id DROP NOT NULL")
_safe_alter_column("archimate_relationships", "ALTER COLUMN model_id DROP NOT NULL")
_safe_alter_column("package_views", "ALTER COLUMN package_id DROP NOT NULL")

# Ensure model_id is nullable on SQLite for reference elements/relationships
if engine.dialect.name == "sqlite":
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(archimate_elements);")).fetchall()
            for col in res:
                if col[1] == "model_id" and col[3] == 1:
                    conn.execute(text("PRAGMA foreign_keys=OFF;"))
                    conn.execute(text("""
                        CREATE TABLE archimate_elements_dg_tmp (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            model_id VARCHAR,
                            name VARCHAR NOT NULL,
                            type VARCHAR NOT NULL,
                            layer VARCHAR NOT NULL,
                            documentation TEXT,
                            properties JSON,
                            stereotype_id VARCHAR,
                            is_reference BOOLEAN DEFAULT FALSE,
                            package_id VARCHAR,
                            FOREIGN KEY(model_id) REFERENCES model_workspaces (id) ON DELETE CASCADE
                        );
                    """))
                    conn.execute(text("INSERT INTO archimate_elements_dg_tmp SELECT id, model_id, name, type, layer, documentation, properties, stereotype_id, is_reference, package_id FROM archimate_elements;"))
                    conn.execute(text("DROP TABLE archimate_elements;"))
                    conn.execute(text("ALTER TABLE archimate_elements_dg_tmp RENAME TO archimate_elements;"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_elements_model_id ON archimate_elements (model_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_elements_layer ON archimate_elements (layer);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_elements_id ON archimate_elements (id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_elements_name ON archimate_elements (name);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_elements_type ON archimate_elements (type);"))
                    conn.commit()
                    break

            res_rel = conn.execute(text("PRAGMA table_info(archimate_relationships);")).fetchall()
            for col in res_rel:
                if col[1] == "model_id" and col[3] == 1:
                    conn.execute(text("PRAGMA foreign_keys=OFF;"))
                    conn.execute(text("""
                        CREATE TABLE archimate_relationships_dg_tmp (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            model_id VARCHAR,
                            source_id VARCHAR NOT NULL,
                            target_id VARCHAR NOT NULL,
                            type VARCHAR NOT NULL,
                            name VARCHAR,
                            documentation TEXT,
                            properties JSON,
                            is_reference BOOLEAN DEFAULT FALSE,
                            package_id VARCHAR,
                            FOREIGN KEY(model_id) REFERENCES model_workspaces (id) ON DELETE CASCADE,
                            FOREIGN KEY(source_id) REFERENCES archimate_elements (id) ON DELETE CASCADE,
                            FOREIGN KEY(target_id) REFERENCES archimate_elements (id) ON DELETE CASCADE
                        );
                    """))
                    conn.execute(text("INSERT INTO archimate_relationships_dg_tmp SELECT id, model_id, source_id, target_id, type, name, documentation, properties, is_reference, package_id FROM archimate_relationships;"))
                    conn.execute(text("DROP TABLE archimate_relationships;"))
                    conn.execute(text("ALTER TABLE archimate_relationships_dg_tmp RENAME TO archimate_relationships;"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_relationships_target_id ON archimate_relationships (target_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_relationships_id ON archimate_relationships (id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_relationships_source_id ON archimate_relationships (source_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_relationships_model_id ON archimate_relationships (model_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_archimate_relationships_type ON archimate_relationships (type);"))
                    conn.commit()
                    break

            res_pv = conn.execute(text("PRAGMA table_info(package_views);")).fetchall()
            for col in res_pv:
                if col[1] == "package_id" and col[3] == 1:
                    conn.execute(text("PRAGMA foreign_keys=OFF;"))
                    conn.execute(text("""
                        CREATE TABLE package_views_dg_tmp (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            package_id VARCHAR,
                            model_id VARCHAR,
                            view_key VARCHAR(64) NOT NULL,
                            name VARCHAR NOT NULL,
                            description TEXT,
                            category VARCHAR(64),
                            view_type VARCHAR(32) NOT NULL,
                            icon VARCHAR(32),
                            target_stereotypes JSON,
                            target_types JSON DEFAULT '[]',
                            target_hub VARCHAR(32) DEFAULT 'business',
                            config JSON NOT NULL,
                            sort_order INTEGER DEFAULT 0,
                            is_global BOOLEAN DEFAULT FALSE,
                            is_active BOOLEAN DEFAULT TRUE,
                            author VARCHAR,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(package_id) REFERENCES attribute_packages (id) ON DELETE CASCADE,
                            FOREIGN KEY(model_id) REFERENCES model_workspaces (id) ON DELETE CASCADE
                        );
                    """))
                    conn.execute(text("""
                        INSERT INTO package_views_dg_tmp
                        SELECT id, package_id, model_id, view_key, name, description, category, view_type, icon, target_stereotypes, target_types, COALESCE(target_hub, 'business'), config, sort_order, is_global, is_active, author, created_at, updated_at
                        FROM package_views;
                    """))
                    conn.execute(text("DROP TABLE package_views;"))
                    conn.execute(text("ALTER TABLE package_views_dg_tmp RENAME TO package_views;"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_package_views_id ON package_views (id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_package_views_package_id ON package_views (package_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_package_views_model_id ON package_views (model_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_package_views_view_key ON package_views (view_key);"))
                    conn.commit()
                    break
        except Exception as exc:
            print(f"Migration note (nullable model_id/package_id): {exc}")


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
    from app.services.adr_service import seed_sample_adrs
    if db.query(ModelWorkspace).filter(ModelWorkspace.id == "sample-easybank-ea").first():
        seed_sample_adrs(db, "sample-easybank-ea")
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Cloud-native Business-Oriented Enterprise Architecture Platform with ArchiMate & APM"
)

# CORS Middleware (SAST-HIGH-05: explicit origins, methods, and headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# HTTP Security Headers Middleware (SAST-LOW-01: OWASP Secure Headers)
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if "Content-Security-Policy" not in response.headers:
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self';"
    return response

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
app.include_router(data_import_router, prefix=settings.API_V1_STR)
app.include_router(saved_views_router, prefix=settings.API_V1_STR)
app.include_router(schemas_router, prefix=settings.API_V1_STR)
app.include_router(plugin_router, prefix=settings.API_V1_STR)
app.include_router(business_views_router, prefix=settings.API_V1_STR)
app.include_router(adrs_router, prefix=settings.API_V1_STR)
app.include_router(resilience_router, prefix=settings.API_V1_STR)
app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": settings.VERSION}

# Serve static frontend build if present (for single container deployment)
frontend_dist = "/frontend/dist" if os.path.exists("/frontend/dist") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
