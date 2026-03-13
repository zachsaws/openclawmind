# Contract Freeze v1

## 1. 游戏规则基础

- 牌组：2副扑克牌（含大小王），共108张。
- 玩家：固定4人（1人类 + 3AI）。
- 发牌：每人27张。
- 起手：AI1（`seat=1`）先手。
- 阶段：
  - `turn_open`：当前玩家可出牌。
  - `challenge_window`：其余玩家可质疑。

## 2. HTTP API（v1）

1. `POST /games`
- 创建房间。

2. `POST /games/:id/start`
- 开局；幂等（已开局时返回当前状态）。

3. `POST /games/:id/actions/play`
- 出牌动作。

4. `POST /games/:id/actions/challenge`
- 质疑动作。

5. `POST /games/:id/actions/chat`
- 聊天动作（长度和审核限制）。

6. `POST /games/:id/rematch`
- 再来一局。

7. `GET /games/:id/state`
- 拉取当前状态。

8. `GET /games/:id/replay`
- 拉取事件回放。

9. `GET /healthz`
- 健康检查。

10. `GET /meta/bootstrap`
- 前端启动元数据（版本、规则、事件名、UI建议参数）。

## 3. WebSocket 事件（v1）

- 客户端 -> 服务端：`game:subscribe`
- 服务端 -> 客户端：`game:update`

## 4. 公共状态安全规则

- 人类玩家只能看到自己的手牌明细。
- AI玩家手牌只返回数量，不返回牌面明细。
