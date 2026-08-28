# Nayoshi

汎用プロジェクトのための小さな標準を、Codex と Claude 向けの AI Agent Skills
として提供します。Nayoshi は、プロジェクト構造、ソース履歴、データの版管理、
リポジトリの健全性確認を、責務の明確なスキルに分離します。

**v0.0.1 · Nayoshi**

> 生在744番地。

[English](README.md) · [中文](README-ZH.md)

---

## スキル

| スキル | 目的 |
|---|---|
| `initialize-project` | 標準構造、言語設定、任意の Python 環境、Git、DVC を初期化または整合させる |
| `manage-data-version` | 独立した `data/` と `etc/` 単位の DVC を初期化・操作する |
| `manage-git-version` | DVC payload を Git に混在させず、commit、branch、release、tag、同期を管理する |
| `inspect-repo` | 構造、所有境界、ignore、Git、DVC、任意の Python 状態を完全な読み取り専用で監査する |

スキルは両方の Agent ディレクトリにインストールされます。

```text
.codex/skills/
.claude/skills/
```

## クイックスタート

要件：Node.js 18 以降。Git、DVC、`uv` は、対応するプロジェクト作業で必要な場合に
のみ使用されます。

既存の対象プロジェクトで、最新の Nayoshi をインストールします。

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/latest --target .
```

バージョン `0.0.1` を指定してインストールします。

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 --target .
```

正常に完了すると、最後に次の二行が表示されます。

```text
Installed version: 0.0.1
生在744番地。
```

インストーラーは次を行います。

- 4 個の同梱スキルを Codex と Claude の両方へインストールする。
- Nayoshi が所有しない名前のスキルをすべて保持する。
- 正確なバージョンとスキル一覧を `.codex/nayoshi-install.json` に記録する。
- `.codex/skills/` と `.claude/skills/` を対象の `.gitignore` に追記・統合する。
- stage、commit、push、Git/DVC の初期化、プロジェクト構造の作成は行わない。

Nayoshi スキルがすでに存在する場合は、ローカル変更を確認してから、4 個のスキル
だけを明示的に置き換えます。

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 \
  --target . --force
```

その後、Codex または Claude で最初のスキルを呼び出します。

```text
initialize-project
```

## プロジェクト標準

`initialize-project` は次の構造を作成します。

```text
project/
├── docs/                  # 英語の作業文書。Git で管理
├── data/                  # DVC payload。Git では data.dvc で表現
├── rsc/                   # ソースと再利用可能なリソース。Git で管理
├── etc/                   # DVC payload。Git では etc.dvc で表現
│   └── project-settings.json
├── .codex/
│   ├── nayoshi-install.json
│   └── skills/            # Git の対象外
└── .claude/
    └── skills/            # Git の対象外
```

所有ルールは意図的に単純です。

| 管理主体 | パス |
|---|---|
| Git | `docs/`、`rsc/`、ルートのメタデータ、`data.dvc`、`etc.dvc`、DVC 設定 |
| DVC | `data/` と `etc/` の内容。それぞれ独立した単位として管理 |
| ローカルのみ | `.codex/skills/`、`.claude/skills/`、`.venv/`、`.env`、キャッシュ |

DVC は秘密情報管理ツールではありません。認証情報、token、秘密鍵を `data/`、
`etc/`、Git、DVC メタデータへ保存してはいけません。

## 永続化される言語ポリシー

プロジェクトの初回初期化時、Agent は英語で次の質問をします。

```text
Before we initialize the project, which language would you like to use for our conversation?
You may communicate with me in any language. All project working documents will be written in
English so the repository remains consistent for the team.
```

回答は可能な場合に標準言語タグへ正規化され、DVC 管理の
`etc/project-settings.json` に保存されます。

```json
{
  "schema_version": 1,
  "communication": {
    "language": "ja"
  },
  "documentation": {
    "language": "en"
  }
}
```

以後のセッションは保存済みの会話言語を再利用し、再質問しません。ユーザーはその
言語で Agent と会話できますが、対象プロジェクトの作業文書と Git commit message
は常に英語です。この多言語 README は Nayoshi パッケージの説明文書であり、対象
プロジェクトの英語文書ルールを変更しません。

## 任意の Python 環境

Nayoshi はすべてのプロジェクトを Python プロジェクトにはしません。Python が実際
に必要な場合のみ、次の規則を適用します。

- 既定で `uv` を使用する。
- 新規プロジェクトには Python `3.12` を推奨する。
- バージョンを `.python-version` に記録する。
- `uv` で `.venv/` を作成・同期する。
- `uv add`、`uv remove`、`uv sync` で依存関係を管理する。

既存プロジェクトでは、記録済みの Python バージョンとパッケージ管理ツールを優先
します。

## インストーラー CLI

```text
nayoshi --target <directory> [--force]
nayoshi --source <checkout> --target <directory> [--force]
nayoshi --help
nayoshi --version
```

| オプション | 意味 |
|---|---|
| `--target <directory>` | 既存のプロジェクトルート。既定値は現在のディレクトリ |
| `--source <checkout>` | 開発・テスト用のローカル Nayoshi checkout |
| `--force` | 4 個の Nayoshi スキルディレクトリだけを置き換える |
| `--help` | ヘルプを表示する |
| `--version` | インストーラーのバージョンを表示する |

インストーラーは、symlink のルート、スキル内 symlink、安全でない manifest、
安全でない `.gitignore`、入れ子になった source/target を拒否します。インストールは
トランザクションとして実行され、置換に失敗した場合は以前の Nayoshi スキルと
manifest を復元します。

## 開発

ローカル checkout から別の対象ディレクトリへインストールします。

```bash
node bin/nayoshi.mjs --source . --target ../my-project
```

テストと npm パッケージ内容の確認：

```bash
npm test
npm run pack:check
```

## バージョニング

Nayoshi は `MAJOR.MINOR.PATCH` を使用します。

| 区分 | 更新する場合 |
|---|---|
| `MAJOR` | プロジェクト所有モデルまたは中核ワークフローを非互換に再設計した場合 |
| `MINOR` | スキルを追加・削除した場合、または後方互換の機能を追加した場合 |
| `PATCH` | 既存スキル、文書、インストーラーの動作を修正した場合 |

現在のリリース：`0.0.1`。

> 生在744番地。
