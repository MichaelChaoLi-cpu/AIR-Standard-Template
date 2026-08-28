# Nayoshi

一套面向通用项目的轻量标准，以 Codex 和 Claude 的 AI Agent Skills 形式提供。Nayoshi
将项目结构、源码历史、数据版本和仓库健康检查拆分为职责明确的独立技能。

**v0.0.1 · Nayoshi**

> 生在744番地。

[English](README.md) · [日本語](README-JP.md)

---

## 技能

| 技能 | 用途 |
|---|---|
| `initialize-project` | 初始化或对齐标准项目结构、语言设定、可选 Python 环境、Git 和 DVC |
| `manage-data-version` | 为独立的 `data/` 和 `etc/` 单元初始化并操作 DVC |
| `manage-git-version` | 管理提交、分支、发布、标签和同步，同时避免把 DVC payload 纳入 Git |
| `inspect-repo` | 严格只读地审计结构、所有权、忽略规则、Git、DVC 和可选 Python 状态 |

技能会同时安装到两个 Agent 目录：

```text
.codex/skills/
.claude/skills/
```

## 快速开始

运行要求：Node.js 18 或更高版本。只有对应项目流程需要时，才会使用 Git、DVC 和
`uv`。

在已经存在的目标项目目录中安装最新 Nayoshi 版本：

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/latest --target .
```

精确安装 `0.0.1`：

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 --target .
```

安装成功时，最后两行是：

```text
Installed version: 0.0.1
生在744番地。
```

安装器会：

- 将四个内置技能安装到 Codex 和 Claude 两个目录；
- 保留所有不属于 Nayoshi 的其他技能；
- 写入 `.codex/nayoshi-install.json`，记录精确版本和技能清单；
- 将 `.codex/skills/` 和 `.claude/skills/` 合并写入目标 `.gitignore`；
- 不执行 stage、commit、push，不初始化 Git/DVC，也不创建项目标准目录。

如果目标中已经存在 Nayoshi 技能，请先检查本地修改，再显式替换这四个技能：

```bash
npx --yes github:MichaelChaoLi-cpu/AIR-Standard-Template#version/0.0.1 \
  --target . --force
```

安装后，在 Codex 或 Claude 中调用第一个技能：

```text
initialize-project
```

## 项目标准

`initialize-project` 建立以下结构：

```text
project/
├── docs/                  # 英文工作文档；由 Git 管理
├── data/                  # DVC payload；在 Git 中以 data.dvc 表示
├── rsc/                   # 源码和可复用资源；由 Git 管理
├── etc/                   # DVC payload；在 Git 中以 etc.dvc 表示
│   └── project-settings.json
├── .codex/
│   ├── nayoshi-install.json
│   └── skills/            # 被 Git 忽略
└── .claude/
    └── skills/            # 被 Git 忽略
```

所有权规则保持简单明确：

| 管理者 | 路径 |
|---|---|
| Git | `docs/`、`rsc/`、根目录元数据、`data.dvc`、`etc.dvc` 和 DVC 配置 |
| DVC | `data/` 与 `etc/` 的内容，分别作为两个独立单元 |
| 仅本地 | `.codex/skills/`、`.claude/skills/`、`.venv/`、`.env` 和缓存 |

DVC 不是秘密管理器。凭据、token 和私钥不得存入 `data/`、`etc/`、Git 或 DVC
元数据。

## 持久化语言策略

首次初始化项目时，Agent 会用英文询问：

```text
Before we initialize the project, which language would you like to use for our conversation?
You may communicate with me in any language. All project working documents will be written in
English so the repository remains consistent for the team.
```

回答会在可行时转换为标准语言标签，并保存到由 DVC 管理的
`etc/project-settings.json`：

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

后续会话直接复用已保存的交流语言，不再重复询问。用户可以用该语言与 Agent
交流，但目标项目的工作文档和 Git commit message 始终使用英文。三份本地化 README
属于 Nayoshi 软件包文档，不改变目标项目的英文文档规则。

## 可选 Python 环境

Nayoshi 不会把所有项目都变成 Python 项目。只有确实需要 Python 时才执行以下规则：

- 默认使用 `uv`；
- 新项目推荐 Python `3.12`；
- 将版本记录在 `.python-version`；
- 使用 `uv` 创建并同步 `.venv/`；
- 使用 `uv add`、`uv remove` 和 `uv sync` 管理依赖。

对于已有项目，项目已经记录的 Python 版本和包管理器优先。

## 安装器命令

```text
nayoshi --target <directory> [--force]
nayoshi --source <checkout> --target <directory> [--force]
nayoshi --help
nayoshi --version
```

| 参数 | 含义 |
|---|---|
| `--target <directory>` | 已存在的项目根目录；默认是当前目录 |
| `--source <checkout>` | 用于开发或测试的本地 Nayoshi checkout |
| `--force` | 仅替换四个 Nayoshi 技能目录 |
| `--help` | 显示帮助 |
| `--version` | 输出安装器版本 |

安装器会拒绝符号链接根目录、技能内符号链接、不安全的 manifest、不安全的
`.gitignore` 目标以及相互嵌套的 source/target。安装采用事务式处理：替换失败时会恢复
原有 Nayoshi 技能和 manifest。

## 开发

从本地 checkout 安装到另一个目标目录：

```bash
node bin/nayoshi.mjs --source . --target ../my-project
```

运行测试并检查 npm 打包内容：

```bash
npm test
npm run pack:check
```

## 版本规则

Nayoshi 使用 `主版本号.次版本号.修订号`。

| 版本号 | 何时递增 |
|---|---|
| 主版本号 | 项目所有权模型或核心流程发生不兼容的重新设计 |
| 次版本号 | 新增、移除技能或加入向后兼容能力 |
| 修订号 | 修正现有技能、文档或安装器行为 |

当前版本：`0.0.1`。

> 生在744番地。
