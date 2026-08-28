---
name: manage-git-version
description: Manage Git initialization, commits, branches, version files, tags, and synchronization for a standard team project. Use for source/version workflow affecting docs, rsc, and DVC metadata; do not use to version data/etc payloads or mutate DVC storage.
---

# Manage Git Version

Manage source history and release versions without absorbing DVC-owned payloads or unrelated user
changes. Act on the user-confirmed project root and honor repository-local instructions first.

## Persistent language

At the start, read `etc/project-settings.json` when available. Use
`communication.language` for conversation and keep repository working documents and commit
messages in the `documentation.language`, which must be `en`. Do not modify the settings file in
this skill; Git should see only the resulting `etc.dvc` pointer update, never the file itself.

## Git ownership contract

Git directly tracks:

```text
docs/
rsc/
README.md and other root project metadata
.gitignore
.dvcignore
.dvc/config
data.dvc
etc.dvc
Python metadata such as pyproject.toml, uv.lock, and .python-version when present
```

Git must not directly track the contents of `data/`, `etc/`, `.codex/skills/`,
`.claude/skills/`, `.venv/`, `.env`, caches, or credentials. An ignore entry does not untrack an
already tracked file; report ownership violations and obtain approval before removing paths from
the Git index.

## Inspect first

Before changing Git state, inspect at least:

```bash
git status --short --branch
git diff --stat
git diff
git diff --cached
git branch --show-current
git remote -v
```

Use `git ls-files` to verify ownership when data, environment, or skills paths are involved. Treat
all pre-existing staged, unstaged, and untracked changes as user work. Never discard, rewrite, or
include unrelated changes.

Determine the mode from the request: `initialize`, `commit`, `branch`, `release`, `pull`, `push`,
or `inspect`. Ask only when ambiguity would change history or external state.

## Initialize

If the target is not a Git repository and initialization was requested, initialize it with default
branch `main`. Do not make an initial commit automatically. Add only user-provided remotes; use
`origin` for the primary project remote. Ask before changing any existing remote URL.

Verify that `.gitignore` includes `.codex/skills/`, `.claude/skills/`, `.venv/`, `.env`, and
common local caches, and that DVC owns `data/` and `etc/` before proposing a commit.

## Commit

Group only in-scope changes into logical commits. Before committing, present the exact paths and
proposed message. After approval, stage explicit paths; do not use `git add .`, `git add -A`, or a
broad wildcard when unrelated changes may exist. Review `git diff --cached` before committing.

Use the repository's existing commit convention. If none exists, use:

```text
<type>: <imperative English summary>
```

Preferred types are `feat`, `fix`, `docs`, `data`, `refactor`, `test`, `build`, and `chore`. Use
`data` for DVC pointer/hash changes, not for committing data payloads.

Run relevant checks before the commit. Do not bypass failing hooks with `--no-verify` unless the
user explicitly requests it. Do not amend or rewrite an existing commit unless explicitly asked.

## Branch and synchronization

Warn about uncommitted changes before switching or creating branches. Use `git switch` for ordinary
branch operations. Do not delete branches without an explicit request.

Fetching is read-only; pulling changes the worktree and pushing changes a remote. Run pull or push
only when requested or confirmed, with an explicit remote and branch. Ask before setting an
upstream. Never force-push unless the user requests the exact operation after a clear risk warning.

## Release version

When the user requests a release, first discover the repository's version source, changelog and
tag convention. If no policy exists, propose Semantic Versioning and explain the inferred bump;
do not silently choose a version.

Update every authoritative version file that must stay in sync, update the English changelog when
the project uses one, and run relevant tests. Present the release commit and tag plan before
mutation. Creating a tag, pushing a tag, or publishing a release are separate external-state steps
and each requires authorization from the user's request or confirmation.

## Safety

Never use destructive history/worktree operations such as `git reset --hard`, `git clean`, forced
checkout, or rebase of shared history without an explicit request and a precise scope. Never commit
secrets. Never push merely because a commit succeeded.

## Completion report

Report the mode, branch, paths changed or committed, commit hash or tag if created, checks run,
remote action if any, and remaining uncommitted work.

## Boundaries

This skill does not run `dvc add`, push/pull DVC data, create the standard directory structure, or
repair findings that the user asked only to inspect. Use `manage-data-version` for DVC state and
`inspect-repo` for a read-only audit.
