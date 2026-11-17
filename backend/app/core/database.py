import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL
# Render and some external DB providers (Neon, Supabase) use "postgres://" instead of "postgresql://"
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)


def _build_db_connection_params(url: str) -> tuple[str, dict]:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return url, connect_args

    if url.startswith("postgresql"):
        is_prod = settings.ENVIRONMENT == "production"
        configured_sslmode = settings.DATABASE_SSLMODE
        ca_cert = settings.DATABASE_SSL_CERT

        parsed = urllib.parse.urlparse(url)
        query_params = urllib.parse.parse_qs(parsed.query)

        # In production, default target sslmode is 'require' to prevent unencrypted MITM
        target_sslmode = configured_sslmode
        if not target_sslmode and is_prod and not settings.DATABASE_ALLOW_INSECURE:
            target_sslmode = "require"

        if target_sslmode:
            # Check if an insecure sslmode was explicitly passed in the URL in production
            url_sslmode = query_params.get("sslmode", [""])[0].lower()
            if is_prod and url_sslmode in ("disable", "allow") and not settings.DATABASE_ALLOW_INSECURE:
                raise RuntimeError(
                    f"CRITICAL SECURITY ERROR: PostgreSQL connection sslmode='{url_sslmode}' "
                    "is forbidden in production. Enforce TLS via sslmode=require or verify-full."
                )

            if "sslmode" not in query_params:
                connect_args["sslmode"] = target_sslmode

        if ca_cert:
            connect_args["sslrootcert"] = ca_cert

    return url, connect_args


db_url, connect_args = _build_db_connection_params(db_url)

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
