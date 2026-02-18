# OpenSpec 工具链分析

> 更新时间: 2025-02-15

## 1. 什么是 OpenSpec 模式

OpenSpec 是一个**规格驱动的开发工作流系统**，核心理念是：在写代码之前，先把需求、设计、任务全部结构化写清楚，然后再按步骤实现。

### 核心概念

```
                    OpenSpec 工作流
    ════════════════════════════════════════════

    探索(Explore)  →  提案(Proposal)  →  规格(Specs)
         │                                    │
         ▼                                    ▼
    理清问题/方向      设计(Design)  ←  需求定义
                          │
                          ▼
                     任务(Tasks)  →  实现(Apply)
                                        │
                                        ▼
                                   验证(Verify)  →  归档(Archive)
```

### 目录结构

```
openspec/
├── openspec.yaml          # 项目级配置
├── specs/                 # 主规格目录（各能力模块的正式规格）
│   └── <capability>/
│       └── spec.md
└── changes/               # 变更目录（进行中的工作）
    ├── <change-name>/
    │   ├── .openspec.yaml # 变更配置（使用的 schema 等）
    │   ├── proposal.md    # 为什么做这个变更
    │   ├── specs/         # delta specs（增量规格）
    │   │   └── <capability>/
    │   │       └── spec.md
    │   ├── design.md      # 怎么做（技术决策）
    │   └── tasks.md       # 拆分的实现任务（checkbox 列表）
    └── archive/           # 已完成变更的归档
        └── YYYY-MM-DD-<name>/
```

### 默认工作流 Schema: spec-driven

制品创建顺序：`proposal → specs → design → tasks`

每个制品有依赖关系，必须按顺序创建。

---

## 2. 怎么用 Claude Code + OpenSpec 做需求

### 典型工作流

1. **探索阶段** — 想法还没成型时
   - 使用 `/opsx:explore` 进入探索模式
   - AI 会读代码、画 ASCII 图、问问题、帮你理清思路
   - 不写代码，只思考

2. **创建变更** — 想法成型后
   - `/opsx:new <change-name>` — 逐步创建制品（先看模板，确认后才写）
   - `/opsx:ff <change-name>` — 快速前进（一口气生成所有制品）

3. **继续推进** — 中断后继续
   - `/opsx:continue` — 继续创建下一个未完成的制品

4. **实现** — 制品都就绪后
   - `/opsx:apply` — 按 tasks.md 的 checkbox 逐个实现，完成一个勾一个

5. **验证** — 实现完成后
   - `/opsx:verify` — 验证代码是否符合规格、任务是否完成、设计是否一致

6. **归档** — 一切完成后
   - `/opsx:archive` — 移到 archive 目录，delta specs 可同步到主规格

---

## 3. 可用的 Skills/命令

所有 skill 位于 `/root/.coco/skills/openspec-*/`，通过 Coco AI 的 `/opsx:` 前缀调用。

| 命令 | 用途 | 说明 |
|------|------|------|
| `/opsx:explore` | 探索模式 | 思考伙伴，不写代码，只读代码+画图+讨论 |
| `/opsx:new <name>` | 新建变更 | 创建变更目录，展示第一个制品模板，等用户确认 |
| `/opsx:ff <name>` | 快速前进 | 一口气生成 proposal → specs → design → tasks |
| `/opsx:continue` | 继续变更 | 创建下一个待完成的制品 |
| `/opsx:apply` | 实现任务 | 逐个实现 tasks.md 中的 checkbox 任务 |
| `/opsx:verify` | 验证实现 | 检查完整性、正确性、一致性，出报告 |
| `/opsx:archive` | 归档变更 | 移到 archive/，可选同步 delta specs |
| `/opsx:sync-specs` | 同步规格 | 将 delta specs 合并到主 specs（智能合并） |
| `/opsx:bulk-archive` | 批量归档 | 一次归档多个变更，处理规格冲突 |
| `/opsx:onboard` | 引导教学 | 引导新用户走完一个完整工作流周期 |

### 底层 CLI 命令

```bash
openspec --version          # 检查 CLI 是否安装
openspec new change "<name>" [--schema <schema>]  # 创建变更
openspec list --json        # 列出所有活跃变更
openspec status --change "<name>" --json  # 查看变更状态
openspec instructions <artifact-id> --change "<name>" --json  # 获取制品指令
openspec schemas --json     # 列出可用工作流 schema
openspec archive "<name>"   # 归档变更
```

---

## 4. 怎么让 Claude Code 长期运行

### 方法 1：Coco Runner（已有设计）

在 `/root/openspec/changes/setup-coco-integration/` 中有一个已设计的方案：

**目标**：创建 `coco-spec-runner.js` 脚本，作为 openspec 和 coco 之间的桥梁

**流程**：
1. 查询 `openspec status` 找到下一个待创建的制品
2. 获取 `openspec instructions` 得到指令
3. 收集相关上下文（README、已有 specs 等）
4. 调用 `coco` CLI 传入指令让它创建制品
5. 支持循环模式，连续创建多个制品

**状态**：proposal 已完成，设计和任务待创建

### 方法 2：直接在终端跑 Claude Code / Coco

```bash
# 使用 coco CLI 直接交互
coco chat "使用 openspec-apply-change skill 实现 <change-name>"

# 或者用 Claude Code
claude code "按照 openspec/changes/<name>/tasks.md 逐个实现任务"
```

### 方法 3：Screen/Tmux 持久化

```bash
# 开一个 tmux session
tmux new -s openspec

# 在里面运行 coco
coco chat --session openspec-work

# detach 后任务继续跑
# Ctrl+B, D

# 重新接入
tmux attach -t openspec
```

---

## 5. 当前项目状态

### openspec.yaml

文件存在但为空 — 项目级配置未设置。

### 已有变更

| 变更名 | 状态 | 说明 |
|--------|------|------|
| `setup-coco-integration` | 进行中 | 有 proposal.md，缺 design + tasks |
| `medicine-reminder-app` | 已创建 | 只有 .openspec.yaml |
| `test-change` | 已创建 | 只有 .openspec.yaml |

### 主 specs 目录

`/root/openspec/specs/` — 空，无任何主规格文件。

---

## 6. 实用笔记

- OpenSpec 是**工具无关**的 — 可以配合任何 AI 编码工具使用（Coco、Claude Code、Cursor 等）
- **spec-driven** 是默认 schema，适合大多数开发场景
- 探索模式（explore）是最自由的入口，不确定该做什么时先 explore
- `/opsx:ff` 是最快路径 — 描述需求后直接生成全部制品到 tasks，然后 apply
- 归档不只是清理 — 归档的变更是项目决策历史，未来可回溯
