---
name: initialize-project
description: Initialize or align a general-purpose team project with the standard docs/data/rsc/etc layout, Git and DVC ownership, optional uv-based Python setup, and local-only skills. Use for a new project bootstrap or an explicit structure repair; do not use for routine Git or DVC updates.
---

# Initialize Project

Initialize the target project without overwriting existing work. This skill coordinates the
standard layout, optional Python environment, Git, and DVC. It preserves the confirmation and
safety rules of `manage-git-version` and `manage-data-version`.

## Persistent language gate

The only inspection allowed before establishing the conversation language is checking:

```text
etc/project-settings.json
```

When that file contains a valid `communication.language`, use it immediately and do not ask again.
Also require `documentation.language` to be `en`.

When no valid persisted language exists, ask this question in English and wait for the answer:

```text
Before we initialize the project, which language would you like to use for our conversation?
You may communicate with me in any language. All project working documents will be written in
English so the repository remains consistent for the team.
```

After the user chooses, continue the conversation in that language. Write repository working
documents, headings, templates, comments intended as documentation, and commit messages in
English. Preserve pre-existing non-English content unless the user asks to translate it.

Normalize the answer to a BCP 47 language tag when practical, such as `en`, `zh-CN`, or `ja`, and
persist it as:

```json
{
  "schema_version": 1,
  "communication": {"language": "<language-tag>"},
  "documentation": {"language": "en"}
}
```

The setting is project-wide and is versioned inside the `etc/` DVC unit. If the user explicitly
changes the conversation language later, update this setting, then update only `etc.dvc` through
`manage-data-version`. Never overwrite invalid or conflicting existing settings without showing
the conflict to the user.

## Inspect before changing

Identify the target project root; do not assume the current directory when the request names or
implies another directory. Inspect existing files, hidden files, Git state, DVC state, ignore
rules, and any `AGENTS.md` or equivalent repository instructions.

Classify the target as empty, partially initialized, or established. For an established project,
show conflicts with this standard and ask before changing ownership, moving files, replacing
configuration, or retracking data. Preserve every unrelated file and every existing user change.

Use the bundled scaffold helper for a deterministic preview and apply step:

```bash
python3 scripts/scaffold_project.py --root <target-root> --pretty
python3 scripts/scaffold_project.py --root <target-root> \
  --apply --conversation-language <language-tag> --pretty
```

The first command is read-only. Run the `--apply` form only after loading or obtaining the language
setting and after confirming that reported path-type conflicts are resolved. When a valid setting
already exists, `--conversation-language` may be omitted to preserve it. The helper does not run
Git, DVC, or `uv` commands.

## Standard layout and ownership

Ensure these top-level directories exist:

```text
docs/    # working documentation; tracked directly by Git
data/    # datasets and generated data artifacts; tracked as data.dvc
rsc/     # source, reusable resources, and project code; tracked directly by Git
etc/             # project runtime/configuration artifacts; tracked as etc.dvc
.codex/skills/   # locally installed Codex skills; ignored by Git
.claude/skills/  # locally installed Claude skills; ignored by Git
```

Treat `data/` and `etc/` as two separate DVC units. Git tracks `data.dvc`, `etc.dvc`,
`.dvc/config`, `.dvcignore`, and DVC-created ignore metadata, but not the contents of `data/` or
`etc/`. Git tracks the contents of `docs/` and `rsc/` directly. Do not place `docs/` or `rsc/`
under DVC.

`etc/` may contain machine-specific or restricted artifacts, but DVC is not a secrets manager.
Never write credentials, tokens, private keys, or unencrypted secrets there. Put secrets in a
local `.env` or the team's approved secret store.

When a new directory needs a visible initial artifact, create a short English `README.md` that
explains its ownership. Do not replace an existing README.

## Ignore contract

Merge missing entries into `.gitignore`; never replace the file. At minimum, ensure:

```gitignore
.codex/skills/
.claude/skills/
.venv/
.env
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.DS_Store
```

Let `dvc add data/` and `dvc add etc/` create or maintain the exact ignore rules for those DVC
units. An ignored file that is already tracked by Git remains tracked; detect and report that
condition instead of assuming `.gitignore` fixed it.

## Optional Python setup

Do not create a Python environment merely because DVC is implemented in Python. If the project
itself needs Python, use `uv` unless the user explicitly selects another tool.

- Recommend Python `3.12` for a new project.
- Ask before selecting another version when compatibility requirements are unclear.
- Record the selected version in `.python-version` and project metadata.
- Create/synchronize the environment with `uv`; keep `.venv/` ignored.
- Manage dependencies with `uv add`, `uv remove`, and `uv sync`, not ad-hoc `pip install`.
- Preserve an established project's recorded Python version and dependency manager.

For a new Python project using the recommended version, use the equivalent of:

```bash
uv python install 3.12
uv init --bare --python 3.12 --vcs none
uv python pin 3.12
uv sync --python 3.12
```

Skip `uv init` when `pyproject.toml` already exists. The `--vcs none` option keeps Git
initialization under `manage-git-version`; `uv sync` creates the project-local `.venv/`.

Do not add speculative dependencies. If DVC is missing, ask before installing it; a non-Python
project may use an isolated `uv` tool installation rather than becoming a Python project.

## Initialization sequence

1. Load or complete the persistent language gate and identify the target root.
2. Inspect the repository and reconcile only confirmed conflicts.
3. Create missing standard directories and merge the ignore contract.
4. Configure the optional Python environment only when the project needs Python.
5. Use `manage-git-version` initialization mode to initialize Git on `main` and configure only
   user-provided remotes.
6. Use `manage-data-version` initialization mode to initialize DVC, configure storage when the
   user provides it, and track `data/` and `etc/` separately.
7. Verify the result with the same checks defined by `inspect-repo`.

Do not make the initial Git commit, push Git, upload DVC data, or rewrite an existing remote unless
the user explicitly authorizes that operation. If remote addresses are not ready, finish local
initialization and report the deferred configuration.

## Completion report

Report the target root, persisted conversation/document languages, created and preserved paths,
Git state, DVC state, Python/uv state if applicable, deferred actions, and any conflict that still
needs a human choice.

## Boundaries

This skill initializes or explicitly repairs the standard project foundation. Routine commits,
branches, tags, and synchronization belong to `manage-git-version`; routine DVC hash updates,
pushes, and pulls belong to `manage-data-version`; read-only auditing belongs to `inspect-repo`.
