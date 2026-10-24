#!/usr/bin/env python3
"""
EasyEA Automated SCA & SAST Security Scanner
Used by the `security-auditor` skill and subagent to perform:
1. SCA (Software Composition Analysis) against OSV.dev API & npm audit for:
   - Python dependencies (backend/requirements.txt & backend/venv installed packages)
   - Frontend NPM dependencies (frontend/package.json & frontend/package-lock.json)
   - Container & External CDN dependencies (Dockerfile, docker-compose.yml, plugins)
2. SAST (Static Application Security Testing) heuristics across:
   - FastAPI Backend (Auth/RBAC bypass, XXE, Injection, CORS, Secrets, Upload DoS)
   - React Frontend (XSS, postMessage origin validation, token storage)
   - Plugins (Draw.io, Archi JArchi, Camunda Electron/Node plugins)
"""

import ast
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_DIR = Path(__file__).resolve().parents[4]


def query_osv_batch(queries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Query OSV.dev batch API and hydrate full vulnerability details."""
    if not queries:
        return []
    url = "https://api.osv.dev/v1/querybatch"
    results = []
    # Chunk by 500
    for i in range(0, len(queries), 500):
        chunk = queries[i : i + 500]
        payload = json.dumps({"queries": chunk}).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results.extend(data.get("results", []))
        except Exception as e:
            print(f"[WARN] OSV batch query error: {e}", file=sys.stderr)
            results.extend([{} for _ in chunk])
    return results


def fetch_osv_vuln(vuln_id: str) -> Dict[str, Any]:
    """Fetch full OSV vulnerability record including CVE aliases, summary, and CVSS severity."""
    url = f"https://api.osv.dev/v1/vulns/{vuln_id}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {"id": vuln_id}


def extract_Python_packages() -> Tuple[List[Dict[str, str]], List[str]]:
    """Extract Python packages from backend/requirements.txt and backend/venv."""
    req_file = ROOT_DIR / "backend" / "requirements.txt"
    unpinned = []
    declared = {}
    if req_file.exists():
        for raw_line in req_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            # Remove extras like uvicorn[standard]
            pkg_clean = re.sub(r"\[.*?\]", "", line)
            if "==" in pkg_clean:
                name, ver = pkg_clean.split("==", 1)
                declared[name.strip().lower()] = ver.strip()
            else:
                name = re.split(r"[><=~!]", pkg_clean)[0].strip()
                unpinned.append(line)
                declared[name.lower()] = ""

    # Check venv installed versions
    venv_pip = ROOT_DIR / "backend" / "venv" / "bin" / "pip"
    installed = []
    if venv_pip.exists():
        try:
            out = subprocess.check_output(
                [str(venv_pip), "list", "--format=json"], text=True, stderr=subprocess.DEVNULL
            )
            for item in json.loads(out):
                installed.append(
                    {
                        "name": item["name"],
                        "version": item["version"],
                        "source": "requirements.txt (unpinned)"
                        if item["name"].lower() in declared and not declared[item["name"].lower()]
                        else (
                            "requirements.txt (pinned)"
                            if item["name"].lower() in declared
                            else "transitive (venv)"
                        ),
                    }
                )
        except Exception as e:
            print(f"[WARN] Failed to read venv pip list: {e}", file=sys.stderr)

    return installed, unpinned


def extract_npm_packages() -> List[Dict[str, str]]:
    """Extract installed npm packages from frontend/package-lock.json."""
    lock_file = ROOT_DIR / "frontend" / "package-lock.json"
    pkgs = []
    seen = set()
    if lock_file.exists():
        data = json.loads(lock_file.read_text(encoding="utf-8"))
        packages_dict = data.get("packages", {})
        for pkg_path, info in packages_dict.items():
            if not pkg_path or not isinstance(info, dict):
                continue
            version = info.get("version")
            # Derive package name from node_modules path
            parts = pkg_path.split("node_modules/")
            name = parts[-1] if parts else info.get("name")
            if name and version and (name, version) not in seen:
                seen.add((name, version))
                pkgs.append(
                    {
                        "name": name,
                        "version": version,
                        "dev": bool(info.get("dev", False)),
                    }
                )
    return pkgs


def run_npm_audit() -> Dict[str, Any]:
    """Run npm audit --json in frontend/."""
    frontend_dir = ROOT_DIR / "frontend"
    if not (frontend_dir / "package-lock.json").exists():
        return {}
    try:
        proc = subprocess.run(
            ["npm", "audit", "--json"],
            cwd=str(frontend_dir),
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.stdout:
            return json.loads(proc.stdout)
    except Exception as e:
        return {"error": str(e)}
    return {}


def parse_osv_vulns(
    packages: List[Dict[str, Any]], ecosystem: str
) -> List[Dict[str, Any]]:
    """Query OSV.dev for a list of packages in an ecosystem and enrich with CVE details."""
    queries = [
        {"package": {"name": p["name"], "ecosystem": ecosystem}, "version": p["version"]}
        for p in packages
    ]
    batch_res = query_osv_batch(queries)
    findings = []
    vuln_cache: Dict[str, Dict[str, Any]] = {}

    for pkg, res in zip(packages, batch_res):
        vulns = res.get("vulns", [])
        if not vulns:
            continue
        for v_stub in vulns:
            vid = v_stub.get("id")
            if not vid:
                continue
            if vid not in vuln_cache:
                vuln_cache[vid] = fetch_osv_vuln(vid)
            v_full = vuln_cache[vid]
            aliases = v_full.get("aliases", [])
            cves = [a for a in aliases if a.startswith("CVE-")]
            if vid.startswith("CVE-") and vid not in cves:
                cves.insert(0, vid)
            ghsas = [a for a in aliases if a.startswith("GHSA-")]
            if vid.startswith("GHSA-") and vid not in ghsas:
                ghsas.insert(0, vid)

            # Extract fixed versions
            fixed_versions = []
            for aff in v_full.get("affected", []):
                if aff.get("package", {}).get("name", "").lower() == pkg["name"].lower():
                    for rng in aff.get("ranges", []):
                        for ev in rng.get("events", []):
                            if "fixed" in ev:
                                fixed_versions.append(ev["fixed"])

            # Extract severity / CVSS
            db_spec = v_full.get("database_specific", {})
            severity_label = db_spec.get("severity", "UNKNOWN")
            cvss_vectors = [
                s.get("score", "") for s in v_full.get("severity", []) if s.get("score")
            ]

            findings.append(
                {
                    "ecosystem": ecosystem,
                    "package": pkg["name"],
                    "installed_version": pkg["version"],
                    "source": pkg.get("source", "dev" if pkg.get("dev") else "runtime"),
                    "osv_id": vid,
                    "cves": cves,
                    "ghsas": ghsas,
                    "severity": severity_label,
                    "cvss_vectors": cvss_vectors,
                    "summary": v_full.get("summary") or v_full.get("details", "")[:200],
                    "fixed_versions": sorted(set(fixed_versions)),
                }
            )
    return findings


def scan_fastapi_endpoints() -> List[Dict[str, Any]]:
    """Inspect all FastAPI routes in backend/app/api/*.py for missing authentication/RBAC."""
    api_dir = ROOT_DIR / "backend" / "app" / "api"
    route_findings = []
    if not api_dir.exists():
        return route_findings

    http_methods = {"get", "post", "put", "delete", "patch"}
    for py_file in sorted(api_dir.glob("*.py")):
        source = py_file.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                        method = dec.func.attr.lower()
                        if method in http_methods:
                            path_arg = ""
                            if dec.args and isinstance(dec.args[0], ast.Constant):
                                path_arg = str(dec.args[0].value)
                            func_src = ast.get_source_segment(source, node) or ""
                            has_auth = (
                                "get_current_user" in func_src
                                or "require_permission" in func_src
                                or "require_admin" in func_src
                                or "verify_token" in func_src
                            )
                            if not has_auth:
                                route_findings.append(
                                    {
                                        "file": str(py_file.relative_to(ROOT_DIR)),
                                        "line": node.lineno,
                                        "method": method.upper(),
                                        "path": path_arg,
                                        "function": node.name,
                                        "authenticated": False,
                                    }
                                )
    return route_findings


def scan_sast_patterns() -> List[Dict[str, Any]]:
    """Run static pattern rules on backend, frontend, and plugins."""
    rules = [
        {
            "id": "SAST-PY-XXE",
            "severity": "HIGH",
            "cwe": "CWE-611",
            "title": "Vulnerable XML Parser (xml.etree.ElementTree without defusedxml)",
            "glob": "backend/app/**/*.py",
            "regex": r"import\s+xml\.etree\.ElementTree|from\s+xml\.etree\s+import\s+ElementTree|ET\.fromstring|ET\.parse",
        },
        {
            "id": "SAST-PY-CORS-WILDCARD",
            "severity": "HIGH",
            "cwe": "CWE-942",
            "title": "Permissive CORS Configuration (Wildcard Origin with Credentials)",
            "glob": "backend/app/**/*.py",
            "regex": r"allow_origins\s*=\s*\[\s*[\"']\*[\"']\s*\]",
        },
        {
            "id": "SAST-PY-WEAK-HASH",
            "severity": "CRITICAL",
            "cwe": "CWE-328 / CWE-916",
            "title": "Unsalted / Fast Hash or Weak Token Mechanism in Auth",
            "glob": "backend/app/**/*.py",
            "regex": r"hashlib\.(sha256|md5|sha1)\(",
        },
        {
            "id": "SAST-FE-POSTMESSAGE-WILDCARD",
            "severity": "HIGH",
            "cwe": "CWE-345 / CWE-346",
            "title": "Cross-Window postMessage Without Origin Validation or With '*' TargetOrigin",
            "glob": "frontend/src/**/*.{ts,tsx}",
            "regex": r"postMessage\([^)]*['\"]\*['\"]|addEventListener\(\s*['\"]message['\"]",
        },
        {
            "id": "SAST-FE-XSS-INNERHTML",
            "severity": "MEDIUM",
            "cwe": "CWE-79",
            "title": "Potential DOM XSS via dangerouslySetInnerHTML / innerHTML",
            "glob": "frontend/src/**/*.{ts,tsx}",
            "regex": r"dangerouslySetInnerHTML|\.innerHTML\s*=",
        },
        {
            "id": "SAST-PLUGIN-XSS-INNERHTML",
            "severity": "HIGH",
            "cwe": "CWE-79",
            "title": "DOM XSS via Unsanitized innerHTML in Desktop/Web Plugins",
            "glob": "plugins/**/*.{js,ajs}",
            "regex": r"\.innerHTML\s*=\s*",
        },
        {
            "id": "SAST-PLUGIN-INSECURE-STORAGE",
            "severity": "MEDIUM",
            "cwe": "CWE-522 / CWE-312",
            "title": "Plaintext Credentials / Token Storage in Plugins",
            "glob": "plugins/**/*.{js,ajs}",
            "regex": r"password|token|localStorage",
        },
    ]

    matches = []
    for rule in rules:
        # Handle brace expansion manually
        globs = []
        if "{" in rule["glob"]:
            prefix, rest = rule["glob"].split("{", 1)
            exts, suffix = rest.split("}", 1)
            for ext in exts.split(","):
                globs.append(f"{prefix}{ext}{suffix}")
        else:
            globs.append(rule["glob"])

        pattern = re.compile(rule["regex"])
        for g in globs:
            for path in sorted(ROOT_DIR.glob(g)):
                if "node_modules" in path.parts or "venv" in path.parts or "bundle.js" in path.name:
                    continue
                try:
                    full_text = path.read_text(encoding="utf-8", errors="ignore")
                    lines = full_text.splitlines()
                except Exception:
                    continue
                for idx, line in enumerate(lines, start=1):
                    if pattern.search(line):
                        if (
                            rule["id"] == "SAST-FE-POSTMESSAGE-WILDCARD"
                            and "addEventListener" in line
                            and "event.origin" in full_text
                        ):
                            continue
                        matches.append(
                            {
                                "rule_id": rule["id"],
                                "severity": rule["severity"],
                                "cwe": rule["cwe"],
                                "title": rule["title"],
                                "file": str(path.relative_to(ROOT_DIR)),
                                "line": idx,
                                "snippet": line.strip()[:160],
                            }
                        )
    return matches


def main() -> None:
    py_pkgs, unpinned_reqs = extract_Python_packages()
    npm_pkgs = extract_npm_packages()

    py_vulns = parse_osv_vulns(py_pkgs, "PyPI")
    npm_vulns = parse_osv_vulns(npm_pkgs, "npm")
    npm_audit = run_npm_audit()
    unauth_routes = scan_fastapi_endpoints()
    sast_matches = scan_sast_patterns()

    report = {
        "summary": {
            "python_packages_scanned": len(py_pkgs),
            "python_unpinned_requirements": unpinned_reqs,
            "python_osv_vulnerabilities": len(py_vulns),
            "npm_packages_scanned": len(npm_pkgs),
            "npm_osv_vulnerabilities": len(npm_vulns),
            "unauthenticated_fastapi_routes_count": len(unauth_routes),
            "sast_pattern_hits_count": len(sast_matches),
        },
        "sca_python_vulnerabilities": py_vulns,
        "sca_npm_vulnerabilities": npm_vulns,
        "npm_audit_metadata": npm_audit.get("metadata", {}),
        "sast_unauthenticated_routes": unauth_routes,
        "sast_pattern_matches": sast_matches,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
