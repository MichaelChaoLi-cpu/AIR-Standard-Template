#!/usr/bin/env python3
"""Safely scaffold the non-Git/non-DVC portion of the team project standard."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


DIRECTORIES = ("docs", "data", "rsc", "etc", ".codex/skills", ".claude/skills")
IGNORE_ENTRIES = (
    ".codex/skills/",
    ".claude/skills/",
    ".venv/",
    ".env",
    "__pycache__/",
    "*.py[cod]",
    ".pytest_cache/",
    ".ruff_cache/",
    ".DS_Store",
)
READMES = {
    "docs/README.md": "# Documentation\n\nWorking documentation is written in English and tracked by Git.\n",
    "data/README.md": "# Data\n\nThis directory is managed as the separate DVC unit `data.dvc`.\n",
    "rsc/README.md": "# Resources\n\nSource code and reusable project resources are tracked by Git.\n",
    "etc/README.md": (
        "# Project Artifacts\n\n"
        "This directory is managed as the separate DVC unit `etc.dvc`. "
        "Do not store credentials or unencrypted secrets here.\n"
    ),
}
SETTINGS_PATH = "etc/project-settings.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="Target project root")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create missing paths. Without this flag, perform a read-only preview.",
    )
    parser.add_argument(
        "--conversation-language",
        help="Persisted BCP 47 conversation language, for example en, zh-CN, or ja",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    return parser.parse_args()


def normalized_existing_lines(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines()}


def read_settings(path: Path) -> dict[str, object]:
    status: dict[str, object] = {
        "path": SETTINGS_PATH,
        "exists": path.is_file(),
        "valid": False,
        "conversation_language": None,
        "documentation_language": None,
    }
    if not path.is_file():
        return status
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        status["error"] = type(exc).__name__
        return status
    if not isinstance(payload, dict):
        status["error"] = "RootMustBeObject"
        return status

    communication = payload.get("communication")
    documentation = payload.get("documentation")
    language = communication.get("language") if isinstance(communication, dict) else None
    doc_language = documentation.get("language") if isinstance(documentation, dict) else None
    valid = (
        payload.get("schema_version") == 1
        and isinstance(language, str)
        and bool(language.strip())
        and doc_language == "en"
    )
    status.update(
        {
            "valid": valid,
            "conversation_language": language,
            "documentation_language": doc_language,
        }
    )
    if not valid:
        status["error"] = "MissingOrConflictingLanguagePolicy"
    return status


def inspect(root: Path) -> dict[str, object]:
    ignore_path = root / ".gitignore"
    existing_ignore = normalized_existing_lines(ignore_path)
    return {
        "root": str(root),
        "root_exists": root.exists(),
        "missing_directories": [name for name in DIRECTORIES if not (root / name).is_dir()],
        "missing_readmes": [name for name in READMES if not (root / name).exists()],
        "missing_ignore_entries": [entry for entry in IGNORE_ENTRIES if entry not in existing_ignore],
        "gitignore_exists": ignore_path.is_file(),
        "project_settings": read_settings(root / SETTINGS_PATH),
    }


def apply_scaffold(root: Path, conversation_language: str | None) -> dict[str, object]:
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Target root must be an existing directory: {root}")

    settings_path = root / SETTINGS_PATH
    settings_status = read_settings(settings_path)
    if settings_status["exists"] and not settings_status["valid"]:
        raise SystemExit(
            "Existing etc/project-settings.json is invalid or conflicts with the English "
            "documentation policy; resolve it with the user before applying the scaffold."
        )
    if not settings_status["exists"] and not conversation_language:
        raise SystemExit(
            "--conversation-language is required when etc/project-settings.json does not exist"
        )
    if conversation_language is not None:
        conversation_language = conversation_language.strip()
        if not conversation_language:
            raise SystemExit("--conversation-language must not be empty")

    created: list[str] = []
    preserved: list[str] = []

    for name in DIRECTORIES:
        path = root / name
        if path.exists():
            if not path.is_dir():
                raise SystemExit(f"Expected a directory but found another file type: {path}")
            preserved.append(name + "/")
        else:
            path.mkdir(parents=True)
            created.append(name + "/")

    for relative, content in READMES.items():
        path = root / relative
        if path.exists():
            preserved.append(relative)
        else:
            path.write_text(content, encoding="utf-8")
            created.append(relative)

    if conversation_language:
        existing_payload: dict[str, object] = {}
        if settings_status["exists"]:
            parsed = json.loads(settings_path.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                existing_payload = parsed
        existing_payload["schema_version"] = 1
        existing_payload["communication"] = {"language": conversation_language}
        existing_payload["documentation"] = {"language": "en"}
        rendered = json.dumps(existing_payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
        previous = settings_path.read_text(encoding="utf-8") if settings_path.exists() else None
        if rendered != previous:
            settings_path.write_text(rendered, encoding="utf-8")
            created.append(
                SETTINGS_PATH if previous is None else SETTINGS_PATH + " (updated)"
            )
        else:
            preserved.append(SETTINGS_PATH)
    else:
        preserved.append(SETTINGS_PATH)

    ignore_path = root / ".gitignore"
    existing_lines = normalized_existing_lines(ignore_path)
    missing = [entry for entry in IGNORE_ENTRIES if entry not in existing_lines]
    if missing:
        original = ignore_path.read_text(encoding="utf-8") if ignore_path.exists() else ""
        separator = "" if not original or original.endswith("\n") else "\n"
        block_prefix = "" if not original.strip() else "\n# Local tools and generated state\n"
        ignore_path.write_text(
            original + separator + block_prefix + "\n".join(missing) + "\n",
            encoding="utf-8",
        )
        created.append(".gitignore" if not original else ".gitignore (merged)")
    else:
        preserved.append(".gitignore")

    return {
        "root": str(root),
        "created": created,
        "preserved": preserved,
        "postcheck": inspect(root),
        "not_performed": [
            "Git initialization or commit",
            "DVC initialization, add, or remote configuration",
            "Python or uv environment setup",
        ],
    }


def main() -> None:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    result = (
        apply_scaffold(root, args.conversation_language) if args.apply else inspect(root)
    )
    print(json.dumps(result, indent=2 if args.pretty else None, sort_keys=True))


if __name__ == "__main__":
    main()
