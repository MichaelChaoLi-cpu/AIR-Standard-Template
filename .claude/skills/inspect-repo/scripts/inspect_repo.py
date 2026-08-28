#!/usr/bin/env python3
"""Read-only repository health inspector for the general team project standard."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


STANDARD_DIRS = ("docs", "data", "rsc", "etc")
LOCAL_PROBES = {
    ".codex/skills/": ".codex/skills/.air-standard-ignore-probe",
    ".claude/skills/": ".claude/skills/.air-standard-ignore-probe",
    ".venv/": ".venv/.air-standard-ignore-probe",
    ".env": ".env",
    "__pycache__/": "__pycache__/.air-standard-ignore-probe",
    ".pytest_cache/": ".pytest_cache/.air-standard-ignore-probe",
    ".ruff_cache/": ".ruff_cache/.air-standard-ignore-probe",
}
SECRET_NAMES = {
    ".env",
    ".env.local",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
}
SECRET_SUFFIXES = (".pem", ".p12", ".pfx", ".key")
SETTINGS_PATH = "etc/project-settings.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="Project root to inspect")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    return parser.parse_args()


def run(root: Path, command: list[str], timeout: int = 30) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            cwd=root,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "returncode": None, "stdout": "", "error": type(exc).__name__}
    return {
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "error": completed.stderr.strip()[:500] if completed.returncode else "",
    }


def add_finding(
    findings: list[dict[str, str]], severity: str, area: str, message: str, skill: str
) -> None:
    findings.append(
        {"severity": severity, "area": area, "message": message, "recommended_skill": skill}
    )


def inspect_git(root: Path) -> dict[str, Any]:
    is_repo = run(root, ["git", "rev-parse", "--is-inside-work-tree"])["ok"]
    result: dict[str, Any] = {"is_repository": is_repo}
    if not is_repo:
        return result

    status = run(root, ["git", "status", "--short", "--branch"])
    branch = run(root, ["git", "branch", "--show-current"])
    upstream = run(root, ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
    remotes = run(root, ["git", "remote"])
    tracked = run(root, ["git", "ls-files", "-z"])
    tracked_files = [item for item in tracked["stdout"].split("\x00") if item]
    tracked_payload = [
        item for item in tracked_files if item.startswith("data/") or item.startswith("etc/")
    ]
    tracked_local = [
        item
        for item in tracked_files
        if item == ".env"
        or item.startswith(".codex/skills/")
        or item.startswith(".claude/skills/")
        or item.startswith(".venv/")
        or "/__pycache__/" in "/" + item
    ]
    tracked_secrets = [
        item
        for item in tracked_files
        if Path(item).name.lower() in SECRET_NAMES
        or Path(item).suffix.lower() in SECRET_SUFFIXES
    ]

    ignore: dict[str, bool] = {}
    for label, probe in LOCAL_PROBES.items():
        ignored = run(root, ["git", "check-ignore", "-q", "--no-index", "--", probe])
        ignore[label] = ignored["returncode"] == 0

    status_lines = status["stdout"].splitlines()
    result.update(
        {
            "branch": branch["stdout"] or None,
            "upstream": upstream["stdout"] if upstream["ok"] else None,
            "remote_names": remotes["stdout"].splitlines(),
            "status": status_lines,
            "tracked_file_count": len(tracked_files),
            "tracked_payload_violations": tracked_payload,
            "tracked_local_violations": tracked_local,
            "suspected_tracked_secret_paths": tracked_secrets,
            "ignore_coverage": ignore,
        }
    )
    return result


def inspect_dvc(root: Path) -> dict[str, Any]:
    available = shutil.which("dvc") is not None
    initialized = (root / ".dvc").is_dir()
    result: dict[str, Any] = {
        "available": available,
        "initialized": initialized,
        "data_pointer": (root / "data.dvc").is_file(),
        "etc_pointer": (root / "etc.dvc").is_file(),
        "forbidden_docs_pointer": (root / "docs.dvc").exists(),
        "forbidden_rsc_pointer": (root / "rsc.dvc").exists(),
    }
    if not available or not initialized:
        return result

    status = run(root, ["dvc", "status"])
    remote_names = run(root, ["dvc", "remote", "list"])
    default_remote = run(root, ["dvc", "config", "core.remote"])
    # DVC remote output contains URLs; expose names only.
    names = [line.split()[0] for line in remote_names["stdout"].splitlines() if line.split()]
    result.update(
        {
            "status_ok": status["ok"],
            "status": status["stdout"].splitlines(),
            "remote_names": names,
            "default_remote": default_remote["stdout"] if default_remote["ok"] else None,
        }
    )
    return result


def has_python_source(root: Path) -> bool:
    excluded = {".git", ".venv", ".dvc", ".codex", ".claude", "data", "etc"}
    for path in root.rglob("*.py"):
        if not any(part in excluded for part in path.relative_to(root).parts):
            return True
    return False


def inspect_python(root: Path) -> dict[str, Any]:
    indicators = {
        "pyproject.toml": (root / "pyproject.toml").is_file(),
        "uv.lock": (root / "uv.lock").is_file(),
        ".python-version": (root / ".python-version").is_file(),
        ".venv/": (root / ".venv").is_dir(),
        "python_source": has_python_source(root),
    }
    applicable = any(indicators.values())
    result: dict[str, Any] = {"applicable": applicable, "indicators": indicators}
    if not applicable:
        return result

    uv_available = shutil.which("uv") is not None
    result["uv_available"] = uv_available
    if uv_available:
        version = run(root, ["uv", "--version"])
        result["uv_version"] = version["stdout"] if version["ok"] else None
        if indicators["uv.lock"]:
            lock_check = run(root, ["uv", "lock", "--check"], timeout=60)
            result["lock_consistent"] = lock_check["ok"]
    if indicators[".python-version"]:
        version_text = (root / ".python-version").read_text(encoding="utf-8").strip()
        result["recorded_python_version"] = version_text[:100]
    return result


def inspect_project_settings(root: Path) -> dict[str, Any]:
    path = root / SETTINGS_PATH
    result: dict[str, Any] = {
        "path": SETTINGS_PATH,
        "exists": path.is_file(),
        "valid": False,
        "conversation_language": None,
        "documentation_language": None,
    }
    if not path.is_file():
        return result
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        result["error"] = type(exc).__name__
        return result
    if not isinstance(payload, dict):
        result["error"] = "RootMustBeObject"
        return result

    communication = payload.get("communication")
    documentation = payload.get("documentation")
    language = communication.get("language") if isinstance(communication, dict) else None
    doc_language = documentation.get("language") if isinstance(documentation, dict) else None
    result.update(
        {
            "conversation_language": language,
            "documentation_language": doc_language,
            "valid": (
                payload.get("schema_version") == 1
                and isinstance(language, str)
                and bool(language.strip())
                and doc_language == "en"
            ),
        }
    )
    if not result["valid"]:
        result["error"] = "MissingOrConflictingLanguagePolicy"
    return result


def build_findings(
    structure: dict[str, bool],
    git: dict[str, Any],
    dvc: dict[str, Any],
    python: dict[str, Any],
    settings: dict[str, Any],
) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for name, exists in structure.items():
        if not exists:
            add_finding(findings, "warning", "structure", f"Missing standard directory: {name}/", "initialize-project")

    if not git["is_repository"]:
        add_finding(findings, "warning", "git", "Target is not a Git repository.", "manage-git-version")
    else:
        for path in git["tracked_payload_violations"]:
            add_finding(findings, "critical", "ownership", f"DVC payload is tracked directly by Git: {path}", "manage-git-version")
        for path in git["tracked_local_violations"]:
            add_finding(findings, "critical", "ownership", f"Local-only path is tracked by Git: {path}", "manage-git-version")
        for path in git["suspected_tracked_secret_paths"]:
            add_finding(findings, "critical", "secrets", f"Suspected secret-bearing path is tracked by Git: {path}", "manage-git-version")
        for label, covered in git["ignore_coverage"].items():
            if not covered:
                add_finding(findings, "warning", "ignore", f"Missing Git ignore coverage for {label}", "initialize-project")

    if not dvc["available"]:
        add_finding(findings, "warning", "dvc", "DVC is not available on PATH.", "manage-data-version")
    if not dvc["initialized"]:
        add_finding(findings, "warning", "dvc", "DVC is not initialized.", "manage-data-version")
    for key, label in (("data_pointer", "data.dvc"), ("etc_pointer", "etc.dvc")):
        if not dvc[key]:
            add_finding(findings, "warning", "dvc", f"Missing standard DVC pointer: {label}", "manage-data-version")
    if dvc["forbidden_docs_pointer"]:
        add_finding(findings, "critical", "ownership", "docs/ is incorrectly represented as a DVC unit.", "manage-data-version")
    if dvc["forbidden_rsc_pointer"]:
        add_finding(findings, "critical", "ownership", "rsc/ is incorrectly represented as a DVC unit.", "manage-data-version")
    if dvc.get("initialized") and not dvc.get("remote_names"):
        add_finding(findings, "warning", "dvc", "No DVC remote is configured for team reproduction.", "manage-data-version")
    if dvc.get("status_ok") is False:
        add_finding(findings, "warning", "dvc", "DVC status returned an error.", "manage-data-version")

    if python["applicable"]:
        indicators = python["indicators"]
        if not python.get("uv_available"):
            add_finding(findings, "warning", "python", "Python indicators exist but uv is unavailable.", "initialize-project")
        if not indicators[".python-version"]:
            add_finding(findings, "warning", "python", "Python version is not recorded in .python-version.", "initialize-project")
        if indicators["uv.lock"] and python.get("lock_consistent") is False:
            add_finding(findings, "warning", "python", "uv.lock is stale or inconsistent.", "initialize-project")
    if not settings["exists"]:
        add_finding(
            findings,
            "warning",
            "language",
            "Persistent conversation/document language settings are missing.",
            "initialize-project",
        )
    elif not settings["valid"]:
        add_finding(
            findings,
            "warning",
            "language",
            "Project language settings are invalid or documentation.language is not en.",
            "initialize-project",
        )
    return findings


def main() -> None:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"Target root must be an existing directory: {root}")

    structure = {name: (root / name).is_dir() for name in STANDARD_DIRS}
    git = inspect_git(root)
    dvc = inspect_dvc(root)
    python = inspect_python(root)
    settings = inspect_project_settings(root)
    findings = build_findings(structure, git, dvc, python, settings)
    severities = {finding["severity"] for finding in findings}
    overall = "critical" if "critical" in severities else "warning" if "warning" in severities else "pass"
    report = {
        "overall": overall,
        "root": str(root),
        "structure": structure,
        "git": git,
        "dvc": dvc,
        "project_settings": settings,
        "python": python,
        "findings": findings,
    }
    print(json.dumps(report, indent=2 if args.pretty else None, sort_keys=True))


if __name__ == "__main__":
    main()
