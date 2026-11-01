import os
import re
import pytest

def test_requirements_deterministic_pinning():
    """
    Supply Chain Security Verification:
    Ensures backend/requirements.txt has strictly deterministic pinning (==)
    for all active dependency lines, preventing dependency confusion, version tampering,
    and supply chain attacks during container builds.
    """
    req_path = os.path.join(os.path.dirname(__file__), "../requirements.txt")
    assert os.path.exists(req_path), "requirements.txt must exist"

    with open(req_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    package_lines = []
    for line in lines:
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#"):
            continue
        package_lines.append(cleaned)

    assert len(package_lines) > 0, "requirements.txt must contain dependency declarations"

    for pkg in package_lines:
        # Must contain exact '=='
        assert "==" in pkg, f"Package {pkg} must use deterministic pinning (==)"
        # Must not contain loose operators
        assert ">=" not in pkg, f"Package {pkg} contains loose operator >="
        assert "<=" not in pkg, f"Package {pkg} contains loose operator <="
        assert "~=" not in pkg, f"Package {pkg} contains loose operator ~="
        assert "*" not in pkg, f"Package {pkg} contains wildcard *"

        # Validate syntax: name==version
        match = re.match(r"^[A-Za-z0-9_.\-]+==[A-Za-z0-9_.\-+]+$", pkg)
        assert match is not None, f"Package line '{pkg}' does not follow valid Name==Version syntax"


def test_requirements_in_exists_for_maintenance():
    """Verify requirements.in exists as the abstract requirements definition source."""
    in_path = os.path.join(os.path.dirname(__file__), "../requirements.in")
    assert os.path.exists(in_path), "requirements.in must exist as abstract requirement specification"
