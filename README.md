# Bluff Arena

面向「人类 vs AI」吹牛牌对战的本地可玩版本，已具备游戏化牌桌界面和实时同步。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## OpenAI Computer Use Demo

这个仓库现在带了一个最小本地 demo，会打开 Playwright 浏览器，把截图回传给 OpenAI Responses API，再执行模型返回的点击、输入、滚动动作。

按 2026-03-06 的官方 API 现状，实际执行 computer use 的模型是 `computer-use-preview-2025-03-11`。`gpt-5.4` 本身目前不能直接挂这个工具。

先准备环境变量：

```bash
export OPENAI_API_KEY=your_api_key_here
export OPENAI_COMPUTER_MODEL=computer-use-preview-2025-03-11
export OPENAI_COMPUTER_START_URL=https://example.com
```

运行 demo：

```bash
npm run computer:demo -- "Open the page, search for penguins, then summarize the results."
```

调试产物会落在 `.computer-use/`，每一步都会保存一张截图。

如果接口返回模型不存在或没有权限，说明当前 API key 还没开通 computer use preview。

## 玩法流程

1. 点击 `快速开局`
2. 轮到你出牌时，点击手牌选择 1-4 张
3. 点击 `出牌`
4. 在质疑阶段决定是否点 `质疑`
5. 局终后点 `再来一局`

## 当前能力

- 游戏化桌面 UI（HUD、座位、手牌区、聊天区、日志区、结算弹窗）
- WebSocket 实时同步（`game:update`）
- 回合状态机（`waiting / playing / ended`）
- 动作链路（`play / challenge / chat / rematch`）
- AI 人格行为（激进/稳健/嘴硬/沉默）
- 安全视图（仅玩家本人可见自己的手牌）

## API

- `POST /games`
- `POST /games/:id/start`
- `POST /games/:id/rematch`
- `GET /games/:id/state`
- `POST /games/:id/actions/play`
- `POST /games/:id/actions/challenge`
- `POST /games/:id/actions/chat`
- `GET /games/:id/replay`

## 生产化启动（容器）

```bash
docker build -t bluff-arena:local .
docker run --rm -p 3000:3000 bluff-arena:local
```

## 上线前仍需补齐

- 真实多模型适配层（OpenAI/Anthropic/Google）和降级策略
- 持久化（PostgreSQL + Redis）与断线恢复
- 账号体系与房间权限
- 内容安全服务化（审核策略中心）
- 观测体系（日志、指标、告警、追踪）
- CI/CD 与云端部署脚本（如 Fly.io/Render/K8s）
