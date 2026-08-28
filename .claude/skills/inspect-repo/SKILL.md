---
name: inspect-repo
description: Perform a read-only health and ownership audit of a standard general-purpose project. Use to check docs/data/rsc/etc structure, Git and DVC boundaries, ignored local skills and environments, optional uv/Python reproducibility, and prioritized repository risks; never repair the repository.
---

# Inspect Repo

Inspect whether a project follows the team standard and is safe and reproducible to continue. This
skill is strictly read-only. It reports evidence, risks, and the appropriate follow-up skill; it
does not fix anything.

Act on the user-confirmed project root. If the target is unclear, ask before inspecting. Report in
the user's conversation language, while keeping any proposed repository document names or example
content in English.

Before reporting, read `etc/project-settings.json` when available. Use its
`communication.language` for the report and verify that `documentation.language` is `en`. Reading
this one DVC-owned file is part of the audit; never print unrelated `etc/` contents.

Run the bundled inspector first:

```bash
python3 scripts/inspect_repo.py --root <target-root> --pretty
```

The script uses only read-only checks, redacts DVC remote URLs, and returns structured JSON. Review
its findings against repository-local instructions before writing the human report.

## Read-only boundary

Allowed actions include listing and reading repository files and running non-mutating commands such
as:

```bash
git status --short --branch
git remote -v
git branch --show-current
git ls-files
git check-ignore -v <path>
dvc status
dvc remote list
dvc config core.remote
uv --version
uv lock --check
```

Do not create/edit files, install or sync packages, initialize Git or DVC, add/commit/push/pull,
switch branches, change remotes, update DVC hashes, transfer DVC data, or delete anything. Do not
print values from `.env`, credential files, or secret-bearing configuration.

## Health contract

### Structure

Check that the top-level project layout contains:

```text
docs/
data/
rsc/
etc/
```

The local `.codex/skills/` and `.claude/skills/` directories may be absent until skills are
installed. When present, both must be ignored by Git. Check baseline root files such as
`README.md`, `.gitignore`, and repository-specific instructions without assuming every project
needs Python.

Check that `etc/project-settings.json` is valid JSON with `schema_version`, a non-empty
`communication.language`, and `documentation.language` set to `en`. A missing or invalid setting
means the conversation preference is not reproducible.

### Ownership and ignores

Verify:

- `docs/` and `rsc/` are eligible for direct Git tracking and are not DVC units;
- `data/` and `etc/` are separate DVC units represented by `data.dvc` and `etc.dvc`;
- Git tracks DVC metadata but not payload content under `data/` or `etc/`;
- `.codex/skills/`, `.claude/skills/`, `.venv/`, `.env`, and common caches are ignored;
- ignored local files are not already tracked by Git;
- DVC or Git does not expose obvious credentials, private keys, or environment files.

When checking suspected secrets, report only the path and reason for concern, never the value.

### Git

Report whether the target is a Git repository, current branch, upstream, remotes, staged/unstaged/
untracked state, and ownership violations. Missing remotes are informational unless collaboration
or release synchronization is expected.

### DVC

Report DVC availability, `.dvc/` initialization, configured/default remote, `dvc status`, presence
of `data.dvc` and `etc.dvc`, and any directly Git-tracked payload. A missing DVC remote is a warning
for team reproducibility, but do not assume remote credentials should be committed.

### Optional Python environment

Only apply Python checks when Python indicators exist, such as `pyproject.toml`, `uv.lock`,
`.python-version`, `.venv/`, or Python source files. Then verify:

- the project uses `uv` unless it deliberately records another tool;
- the Python version is recorded, with `3.12` recommended for a new project;
- `uv.lock` is consistent when available;
- `.venv/` is ignored and not tracked;
- dependency metadata is present and internally consistent.

Do not flag a non-Python project merely for lacking Python files or a virtual environment.

## Severity

- `critical`: secrets appear tracked, DVC payload is directly committed, standard ownership is
  contradictory, or the repository cannot be reproduced without likely data loss.
- `warning`: a required standard directory or pointer is missing, ignore coverage is incomplete,
  lock/DVC state is stale, or team reproducibility is incomplete.
- `info`: useful state with no required repair, including intentionally absent optional Python.

Overall status is `critical` if any critical finding exists, otherwise `warning` if any warning
exists, otherwise `pass`.

## Report shape

Return a concise evidence-backed report:

```text
Overall: pass | warning | critical

Structure:
- ...

Ownership and ignores:
- ...

Git:
- ...

DVC:
- ...

Language settings:
- ...

Python/uv (when applicable):
- ...

Prioritized findings:
1. [severity] finding — evidence — recommended next skill
```

Recommend `initialize-project`, `manage-data-version`, or `manage-git-version` only when the
observed finding justifies it. Separate facts from inferences.

## Boundaries

This skill never repairs the project, even when the fix appears trivial. If the user also asks for
repairs, finish and present the audit first, then use the relevant management skill under its own
safety rules.
