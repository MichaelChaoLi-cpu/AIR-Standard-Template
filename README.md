# Nayoshi

A compact, general-purpose project standard delivered as AI agent skills for Codex and Claude.
Nayoshi keeps project structure, source history, data versions, and repository health checks
separate and explicit.

**v0.0.1 · Nayoshi**

> 生在744番地。

[中文](README-ZH.md) · [日本語](README-JP.md)

---

## Skills

| Skill | Purpose |
|---|---|
| `initialize-project` | Initialize or align the standard project structure, language settings, optional Python environment, Git, and DVC |
| `manage-data-version` | Initialize and operate DVC for the separate `data/` and `etc/` units |
| `manage-git-version` | Manage commits, branches, releases, tags, and synchronization without absorbing DVC payloads |
| `inspect-repo` | Perform a strictly read-only audit of structure, ownership, ignores, Git, DVC, and optional Python state |

The skills are installed for both agents:

```text
.codex/skills/
.claude/skills/
```

## Quick Start

Requirements: Node.js 18 or newer. Git, DVC, and `uv` are used only when the corresponding
project workflow needs them.

From an existing target project directory, install the latest Nayoshi release:

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/latest --target .
```

Install version `0.0.1` exactly:

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 --target .
```

A successful installation ends with:

```text
Installed version: 0.0.1
生在744番地。
```

The installer:

- installs the four bundled skills into both agent directories;
- preserves all skills whose names are not owned by Nayoshi;
- writes `.codex/nayoshi-install.json` with the exact installed version and inventory;
- merges `.codex/skills/` and `.claude/skills/` into the target `.gitignore`;
- never stages, commits, pushes, initializes Git/DVC, or creates the project structure.

If Nayoshi skills already exist, review local changes and then explicitly replace only those four
skills:

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 \
  --target . --force
```

Then invoke the first skill in Codex or Claude:

```text
initialize-project
```

## Project Standard

`initialize-project` establishes this layout:

```text
project/
├── docs/                  # English working documents; tracked by Git
├── data/                  # DVC payload; represented in Git by data.dvc
├── rsc/                   # Source and reusable resources; tracked by Git
├── etc/                   # DVC payload; represented in Git by etc.dvc
│   └── project-settings.json
├── .codex/
│   ├── nayoshi-install.json
│   └── skills/            # Ignored by Git
└── .claude/
    └── skills/            # Ignored by Git
```

Ownership is intentionally simple:

| Owner | Paths |
|---|---|
| Git | `docs/`, `rsc/`, root metadata, `data.dvc`, `etc.dvc`, and DVC configuration |
| DVC | Contents of `data/` and `etc/`, tracked as two separate units |
| Local only | `.codex/skills/`, `.claude/skills/`, `.venv/`, `.env`, and caches |

DVC is not a secrets manager. Credentials, tokens, and private keys must not be stored in
`data/`, `etc/`, Git, or DVC metadata.

## Persistent Language Policy

On the first project initialization, the agent asks this question in English:

```text
Before we initialize the project, which language would you like to use for our conversation?
You may communicate with me in any language. All project working documents will be written in
English so the repository remains consistent for the team.
```

The answer is normalized when practical and stored in the DVC-managed
`etc/project-settings.json`:

```json
{
  "schema_version": 1,
  "communication": {
    "language": "zh-CN"
  },
  "documentation": {
    "language": "en"
  }
}
```

Later sessions reuse the persisted conversation language without asking again. Users may talk to
the agent in that language, while target-project working documents and commit messages remain in
English. These localized Nayoshi READMEs are package documentation and do not change that target
project rule.

## Optional Python Environment

Nayoshi does not turn every project into a Python project. When Python is actually required:

- use `uv` by default;
- recommend Python `3.12` for new projects;
- record the version in `.python-version`;
- create and synchronize `.venv/` with `uv`;
- manage dependencies with `uv add`, `uv remove`, and `uv sync`.

An established project's recorded Python version and package manager take precedence.

## Installer CLI

```text
nayoshi --target <directory> [--force]
nayoshi --source <checkout> --target <directory> [--force]
nayoshi --help
nayoshi --version
```

| Option | Meaning |
|---|---|
| `--target <directory>` | Existing project root; defaults to the current directory |
| `--source <checkout>` | Existing local Nayoshi checkout for development or testing |
| `--force` | Replace only the four Nayoshi skill directories |
| `--help` | Show command help |
| `--version` | Print the installer version |

The installer rejects symlinked roots, symlinked skill content, unsafe manifests, unsafe
`.gitignore` targets, and nested source/target paths. Installation is transactional: a failed
replacement restores the previous Nayoshi skills and manifest.

## Development

Run the installer from a local checkout into a separate target directory:

```bash
node bin/nayoshi.mjs --source . --target ../my-project
```

Run tests and inspect the npm package payload:

```bash
npm test
npm run pack:check
```

## Versioning

Nayoshi uses `MAJOR.MINOR.PATCH` versioning.

| Segment | Increment when |
|---|---|
| `MAJOR` | The project ownership model or core workflow is redesigned incompatibly |
| `MINOR` | Skills or backward-compatible capabilities are added or removed |
| `PATCH` | Existing skills, documentation, or installer behavior is corrected |

Current release: `0.0.1`.

> 生在744番地。
