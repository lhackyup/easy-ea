import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.archimate import User
from app.services.sample_data import seed_sample_model
from app.services.rbac_service import seed_default_rbac
from app.services.auth_service import create_access_token
from app.services.apm_service import APMService
from app.services.tech_risk_service import TechRiskService
from app.services.apm_report_service import APMReportService

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()
    seed_sample_model(db)
    seed_default_rbac(db)
    admin = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
    if admin:
        token = create_access_token(admin)
        client.headers.update({"Authorization": f"Bearer {token}"})
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

def test_apm_report_service_direct():
    db = TestingSession()
    model_id = "sample-easybank-ea"
    portfolio = APMService.get_portfolio_summary(db, model_id)
    tco = APMService.get_tco_breakdown(db, model_id)
    lifecycle = APMService.get_lifecycle_analysis(db, model_id)
    interfaces = APMService.get_interface_inventory(db, model_id)
    tech_risk = TechRiskService.analyze_tech_risk(db, model_id)
    db.close()

    # Generate Italian report
    stream_it = APMReportService.generate_docx_report(
        portfolio, tco, lifecycle, interfaces, tech_risk,
        model_name="EasyBank Global Enterprise Model",
        lang="it"
    )
    assert stream_it is not None
    data_it = stream_it.getvalue()
    assert len(data_it) > 1000
    # Check docx zip magic bytes
    assert data_it[:2] == b"PK"

    # Generate English report
    stream_en = APMReportService.generate_docx_report(
        portfolio, tco, lifecycle, interfaces, tech_risk,
        model_name="EasyBank Global Enterprise Model",
        lang="en"
    )
    assert stream_en is not None
    data_en = stream_en.getvalue()
    assert len(data_en) > 1000
    assert data_en[:2] == b"PK"

def test_apm_export_docx_endpoint():
    res = client.get("/api/apm/export/docx/sample-easybank-ea?lang=it")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers["content-type"]
    assert "Content-Disposition" in res.headers
    assert res.headers["Content-Disposition"].endswith('.docx"')
    assert len(res.content) > 1000
    assert res.content[:2] == b"PK"

def test_apm_export_docx_endpoint_en():
    res = client.get("/api/apm/export/docx/sample-easybank-ea?lang=en")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers["content-type"]
    assert len(res.content) > 1000
    assert res.content[:2] == b"PK"
