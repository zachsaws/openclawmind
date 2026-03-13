# Global Skill Strategy Research

## TL;DR

对你这种跨多个工作区、任务横跨前端实现、Figma 落地、研究整理、图片/内容生产、发布准备的人来说：

- `AGENTS.md` 应该承担稳定、持续生效的默认工作方式
- 全局 `skills` 应该只放少量高频、跨项目可复用的能力
- 项目或工作区级 `skills` 应该承接具体流程、脚本、模板和资产
- 不要把“框架文档索引”优先塞进全局 skill；这类内容更适合项目级 `AGENTS.md` 或项目级检索

## 外部共识

### 1. 官方 Codex 建议

OpenAI 当前文档把 skill 定义为一组“任务专用能力包”，并强调：

- skill 由 `SKILL.md` 加可选 `scripts/`、`references/`、`assets/` 组成
- 触发方式分为显式调用和隐式匹配描述
- 最佳实践是：
  - 一个 skill 只做一件事
  - 默认优先用说明而不是脚本
  - 步骤要写成命令式，输入输出明确
  - 需要测试 skill 的触发描述是否稳定

同时，Codex 也明确区分了 skill 的保存层级：

- repo 级：适合团队共享、仓库相关能力
- user 级：适合用户跨项目复用
- admin/system 级：适合机器或平台默认能力

### 2. 开发者实测趋势

Vercel 在 2026-01-27 的一篇评测文章里给出一个很有参考价值的结论：

- 对“版本相关框架知识”这类上下文，`AGENTS.md` 的稳定注入效果优于把文档做成 skill 等待 agent 自己触发
- 他们的 eval 中，skill 默认情况下经常不被调用
- 加了明确指令后，skill 会好很多，但行为对 wording 比较敏感

这个结论对你很重要，因为你有多个工作区，不同工作区的知识密度和文档依赖差异很大。

### 3. Claude Code / 更广泛 agent 社区的做法

Anthropic 当前文档对 subagent 的建议，本质上也支持同一个方向：

- 用用户级 agent / subagent 复用跨项目能力
- 把 agent scope 控制得很窄
- 限制工具访问，避免一个 agent 既探索又乱改
- 让 description 清楚表达“什么时候应该委派给它”

这个和 skill 设计原则是一致的：不要做大而全。

## 你本机的现状

从当前机器上能看到几个信号：

### 1. 你不是单仓库开发流

你至少有这些工作区痕迹：

- `Playground`：Node/TS 项目，偏产品原型/游戏 MVP
- `算力冗余`：带独立 `AGENTS.md` 和自定义 skill，偏文档/内容生产工作流
- `目澈`：同时存在 `.agent/skills` 和 `.agents/skills`，并已落过整套 Impeccable 风格技能

### 2. 你已经在做“混合型工作流”

你现有和已安装的 skill 方向，集中在这些主题：

- Figma 到前端
- 前端设计质量提升
- 文档/研究整理
- 图片生成
- 小红书发布

这说明你更像“产品设计工程 + 内容运营 + 自动化工作流”的复合型用户，而不是只需要代码审查、测试、重构那套纯工程 skill 包。

### 3. 你现在最需要的是统一，不是继续堆

当前同类内容出现在多个目录：

- `~/.codex/skills`
- `~/.agents/skills`
- 某些仓库内的 `.agent/skills`
- 某些仓库内的 `.agents/skills`

问题不是 skill 少，而是入口分散、职责重叠、触发路径不统一。

## 适合你的全局配置

## 全局层：只放 6-9 个长期高频 skill

建议全局层只保留三类：

### A. 核心执行类

- `figma`
- `frontend-design`
- `polish`
- `audit`

理由：
- 这几项跨多个产品工作区都常用
- 属于方法论和质量控制，不强绑定某个项目

### B. 研究与产出类

- `notion-research-documentation`
- `imagegen`

理由：
- 你明显有“研究整理”和“配图生成”的固定需求
- 这类能力适合作为全局底座

### C. 渠道与组合类

- `xhs-publisher`
- `content-launch-kit`
- `figma-ship-page`
- `landing-page-polish`

理由：
- 这些不是底层原子能力，而是高频组合流程
- 你的任务经常不是单一 artifact，而是一组相关输出

## 不建议放进全局层的内容

- 某个项目特有的框架文档索引
- 某个产品独有的品牌规则
- 某个仓库的发布脚本
- 某个专题内容生产模板

这些更适合项目级 `AGENTS.md` 或项目内 `.agents/skills/`。

## 我建议的三层结构

### 1. Global defaults: `~/.codex/AGENTS.md`

这里写“你这个人怎么工作”，而不是“某个项目怎么做”：

- 默认先读项目规则
- 默认少改、先验证
- 默认产出要带可点击路径
- 默认前端要避免模板味
- 默认研究类输出要标注来源

### 2. User skills: `~/.codex/skills`

这里放跨项目可复用的长期能力：

- Figma 落地
- 前端精修
- 设计审计
- 研究整理
- 图片生成
- 发布准备

### 3. Project instructions and project skills

每个工作区里再放：

- `AGENTS.md`：写项目约束、栈、输出路径、评审规则
- `.agents/skills/`：写该项目特有流程

## 推荐封装方式

### 1. 原子 skill

只做一个小能力，适合被复用：

- `audit`
- `polish`
- `imagegen`
- `xhs-publisher`

### 2. 组合 skill

把 2-4 个原子能力编排成一个固定流程：

- `figma-ship-page`
- `landing-page-polish`
- `content-launch-kit`

这是最适合你的类型，因为你很多任务天然是多阶段的。

### 3. 项目 skill

只服务某个工作区：

- 某个产品页生成器
- 某个品牌文案风格器
- 某个内容图包脚本

这类不要上升为全局 skill，除非它在至少两个工作区重复出现。

## 建议新增的全局 skills

如果你要继续建设，我建议优先补这 5 个：

### `bug-triage`

用途：
- 读取报错、日志、复现线索
- 给出定位路径、优先级、验证方案

为什么适合你：
- 横跨所有代码工作区
- 复用率高

### `react-feature-ship`

用途：
- 从需求到前端 feature 落地
- 覆盖实现、边界状态、测试检查、交付说明

为什么适合你：
- `Playground` 这类仓库会频繁用

### `repo-onboard`

用途：
- 新工作区快速扫仓
- 输出栈、入口、命令、风险、建议改动区域

为什么适合你：
- 你切工作区频繁

### `research-to-brief`

用途：
- 把零散资料快速转成结构化 brief

为什么适合你：
- 和 Notion、内容策划、产品调研都兼容

### `doc-to-image-pack`

用途：
- 从 markdown / brief 生成封面图 + 内容图的提示词或成图

为什么适合你：
- 你的 `算力冗余` 已经有类似需求，说明这不是一次性的

## 不建议新增的全局 skills

- `nextjs-docs`
- `vite-docs`
- `tailwind-docs`
- `brand-xxx`
- `project-release`

这些都更应该按项目层维护。

## 基于你当前工作区，我给你的推荐版本

### 必备全局 skills

- `figma`
- `frontend-design`
- `polish`
- `audit`
- `notion-research-documentation`
- `imagegen`
- `xhs-publisher`
- `repo-onboard`
- `bug-triage`

### 高优先级组合 skills

- `figma-ship-page`
- `landing-page-polish`
- `content-launch-kit`
- `react-feature-ship`

### 项目级专属

放在各仓库里，不进全局：

- `document-illustrator-openai`
- 某个产品专属发布/配图模板
- 某个项目的技术栈文档索引

## 下一步

最合理的推进顺序：

1. 先稳定 `~/.codex/AGENTS.md`
2. 再把 `~/.codex/skills` 收敛成 8-12 个长期技能
3. 然后按工作区补项目级 `.agents/skills`
4. 最后才做更细的自动化或 agent 分工

## 参考来源

- OpenAI Codex Skills: https://developers.openai.com/codex/skills
- OpenAI Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Anthropic Claude Code Subagents: https://code.claude.com/docs/en/sub-agents
- Vercel eval article: https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- vercel-labs/skills: https://github.com/vercel-labs/skills
