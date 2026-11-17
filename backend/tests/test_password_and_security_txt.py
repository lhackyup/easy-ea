import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.auth_service import validate_password_complexity, hash_password
from app.core.database import SessionLocal
from app.models.archimate import User
from app.services.rbac_service import create_user, reset_user_password

client = TestClient(app)


def test_password_complexity_validator():
    # 1. Too short (< 10)
    valid, err = validate_password_complexity("Short1!")
    assert not valid
    assert "at least 10 characters" in err

    # 2. Missing uppercase
    valid, err = validate_password_complexity("nouppercase123!")
    assert not valid
    assert "uppercase" in err

    # 3. Missing lowercase
    valid, err = validate_password_complexity("NOLOWERCASE123!")
    assert not valid
    assert "lowercase" in err

    # 4. Missing digit
    valid, err = validate_password_complexity("NoDigitsHere!!")
    assert not valid
    assert "digit" in err

    # 5. Missing special character
    valid, err = validate_password_complexity("NoSymbolsHere123")
    assert not valid
    assert "special character" in err

    # 6. Low entropy / repetitive
    valid, err = validate_password_complexity("Aa1!Aa1!Aa")
    # Aa1! -> only 4 unique characters ('A', 'a', '1', '!')
    assert not valid
    assert "5 unique characters" in err

    # 7. Known trivial / guessable patterns
    valid, err = validate_password_complexity("MyPassword123!")
    assert not valid
    assert "trivial" in err.lower() or "guessable" in err.lower()

    valid, err = validate_password_complexity("Secure12345678!")
    assert not valid
    assert "trivial" in err.lower() or "guessable" in err.lower()

    valid, err = validate_password_complexity("Admin123!Special")
    assert not valid
    assert "trivial" in err.lower() or "guessable" in err.lower()

    # 8. Contains username
    valid, err = validate_password_complexity("MarioRossi2026!#", username="mariorossi")
    assert not valid
    assert "username" in err.lower()

    # 9. Contains email local-part
    valid, err = validate_password_complexity("JohnDoe2026!#", email="johndoe@enterprise.org")
    assert not valid
    assert "email" in err.lower()

    # 10. Valid complex passwords
    valid, err = validate_password_complexity("SuperS3cur3#P@ss-Code")
    assert valid
    assert err is None

    valid, err = validate_password_complexity("InitialSecret123!")
    assert valid
    assert err is None

    valid, err = validate_password_complexity("NewSecretPass456!")
    assert valid
    assert err is None


def test_rfc9116_security_txt_endpoints():
    # Standard RFC 9116 endpoint: /.well-known/security.txt
    res_well_known = client.get("/.well-known/security.txt")
    assert res_well_known.status_code == 200
    assert "text/plain" in res_well_known.headers.get("content-type", "")
    content = res_well_known.text

    assert "Contact:" in content
    assert "Expires:" in content
    assert "Preferred-Languages:" in content
    assert "Policy:" in content

    # Alias /security.txt
    res_alias = client.get("/security.txt")
    assert res_alias.status_code == 200
    assert "text/plain" in res_alias.headers.get("content-type", "")
    assert res_alias.text == content


def test_user_creation_and_reset_password_complexity():
    db = SessionLocal()
    try:
        # Cleanup if exists
        db.query(User).filter(User.username == "test_pwd_user").delete()
        db.commit()

        # Reject simple password on creation
        with pytest.raises(Exception) as exc_info:
            create_user(
                db=db,
                username="test_pwd_user",
                email="test_pwd_user@example.com",
                full_name="Test Password User",
                password="weak"
            )
        assert "at least 10 characters" in str(exc_info.value)

        # Successful creation with valid complex password
        user_data = create_user(
            db=db,
            username="test_pwd_user",
            email="test_pwd_user@example.com",
            full_name="Test Password User",
            password="Arch1tecture#Secure2026!"
        )
        assert user_data["username"] == "test_pwd_user"
        user_id = user_data["id"]

        # Reject weak password on reset
        with pytest.raises(Exception) as exc_info:
            reset_user_password(db=db, user_id=user_id, new_password="Password123!")
        assert "trivial" in str(exc_info.value).lower() or "guessable" in str(exc_info.value).lower()

        # Accept strong password on reset
        res = reset_user_password(db=db, user_id=user_id, new_password="CloudN@tiveEA999!")
        assert res["status"] == "success"

    finally:
        db.query(User).filter(User.username == "test_pwd_user").delete()
        db.commit()
        db.close()


def test_change_password_endpoint():
    db = SessionLocal()
    try:
        db.query(User).filter(User.username == "cp_user").delete()
        db.commit()

        # Create user
        create_user(
            db=db,
            username="cp_user",
            email="cp_user@example.com",
            full_name="Change Password User",
            password="Arch1tecture#Secure2026!"
        )

        # Login to obtain auth token
        login_res = client.post("/api/auth/login", json={
            "username": "cp_user",
            "password": "Arch1tecture#Secure2026!"
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Attempt change with wrong current password
        wrong_res = client.post("/api/auth/change-password", headers=headers, json={
            "current_password": "WrongSecretCode999!",
            "new_password": "CloudN@tiveEA999!"
        })
        assert wrong_res.status_code == 400
        assert "non è corretta" in wrong_res.text

        # 2. Attempt change with weak new password
        weak_res = client.post("/api/auth/change-password", headers=headers, json={
            "current_password": "Arch1tecture#Secure2026!",
            "new_password": "weak"
        })
        assert weak_res.status_code == 400
        assert "at least 10 characters" in weak_res.text

        # 3. Successful change with valid new password
        success_res = client.post("/api/auth/change-password", headers=headers, json={
            "current_password": "Arch1tecture#Secure2026!",
            "new_password": "CloudN@tiveEA999!"
        })
        assert success_res.status_code == 200
        assert success_res.json()["status"] == "success"

        # 4. Verify login with old password fails
        old_login = client.post("/api/auth/login", json={
            "username": "cp_user",
            "password": "Arch1tecture#Secure2026!"
        })
        assert old_login.status_code == 401

        # 5. Verify login with new password succeeds
        new_login = client.post("/api/auth/login", json={
            "username": "cp_user",
            "password": "CloudN@tiveEA999!"
        })
        assert new_login.status_code == 200

    finally:
        db.query(User).filter(User.username == "cp_user").delete()
        db.commit()
        db.close()
