---
name: manage-data-version
description: Manage DVC ownership and versions for the standard data/ and etc/ directories. Use to initialize DVC, configure a remote, add or update DVC hashes, push, pull, or diagnose data-version state; do not use for Git commits or for docs/rsc content.
---

# Manage Data Version

Manage DVC state for a general-purpose team project while keeping Git and DVC ownership separate.
Act on the user-confirmed project root.

## Persistent language

At the start, read `etc/project-settings.json` when available. Use
`communication.language` for conversation and keep all repository working documents in the
`documentation.language`, which must be `en`. Do not change language settings in this skill; that
belongs to `initialize-project`. Because the settings file is inside `etc/`, include its changes
when updating `etc.dvc`.

## Ownership contract

The only standard DVC content units are:

```text
data/  -> data.dvc
etc/   -> etc.dvc
```

Track the two directories separately. Do not collapse them into one parent unit and do not track
their contents directly with Git. Git owns the DVC metadata and the contents of `docs/` and
`rsc/`. Never run `dvc add docs/` or `dvc add rsc/` under this standard.

DVC is not a secrets manager. Before adding `etc/`, inspect filenames and configuration patterns
for likely credentials or private keys without printing secret values. Stop and ask the user to
remove or externalize suspected secrets before tracking them.

## Inspect first

Before every mutation, inspect:

```bash
git status --short --branch
git ls-files data etc docs rsc
dvc --version
dvc status
dvc remote list
dvc config core.remote
```

Also check for `.dvc/`, `data.dvc`, `etc.dvc`, `.dvcignore`, `.gitignore`, and any existing DVC
pipeline files. Missing tools or configuration are findings, not permission to install or rewrite
them.

Determine the requested mode from the user's request: `initialize`, `update`, `push`, `pull`,
`remote`, or `inspect`. If the mode is materially ambiguous, ask in the user's chosen conversation
language before changing state.

## Initialize

1. Ensure `data/` and `etc/` exist. Preserve all contents.
2. If DVC is missing, ask before installing it. Prefer the project's existing toolchain; when no
   project toolchain exists, an isolated `uv` tool install is acceptable. Use `uv add --dev dvc`
   for a Python project that records development tools, or `uv tool install dvc` when DVC should
   remain independent of a non-Python project. Install only the extra required by the chosen remote.
3. If `.dvc/` is absent, ask before running `dvc init`.
4. If the user supplies a storage address, use remote name `storage`. Ask before changing any
   existing remote URL or default remote.
5. Run `dvc add data/` and `dvc add etc/` separately. If either directory is empty, place a minimal
   English ownership `README.md` inside it before the initial add; do not overwrite existing files.
6. Verify that Git sees `data.dvc`, `etc.dvc`, and required ignore/config metadata, but not DVC
   payload files.

Do not upload data or create a Git commit as an implicit part of initialization. Hand the metadata
changes to `manage-git-version` only when the user asks to commit them.

## Update hashes

Run `dvc status` and update only changed standard units:

```bash
dvc add data/
dvc add etc/
```

Do not run both commands when only one unit changed. Review `git status --short` and the pointer
diffs afterward. The Git change should be metadata, not payload content.

## Remote management

Use `storage` as the default remote name for a new configuration. Accept storage supported by the
installed DVC version, including local or mounted paths and cloud URLs. Do not create, overwrite,
or migrate remote storage without explicit authorization. Keep credentials in local DVC config,
environment variables, or an approved secret store; never commit credentials.

After a remote change, verify `dvc remote list` and `dvc config core.remote`. Do not expose secret
configuration values in the report.

## Push and pull

Treat `dvc push` as an external upload and `dvc pull` as a workspace-changing restore. Run either
only when requested or explicitly confirmed. Inspect the configured remote first. After the
operation, run `dvc status` and report whether the workspace and cache are consistent.

Never use `dvc gc`, delete cache/data, remove tracking, or force an overwrite unless the user
explicitly requests the exact destructive operation and confirms its scope.

## Completion report

Report the mode, affected unit, pointer state, remote name without credentials, transfer outcome,
Git metadata still awaiting commit, and any reproducibility risk.

## Boundaries

This skill does not commit or synchronize Git, manage `docs/` or `rsc/`, restructure the project,
or decide what project artifacts should contain. Use `manage-git-version` for Git operations and
`inspect-repo` for a read-only whole-repository audit.
