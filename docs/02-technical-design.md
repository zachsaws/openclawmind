# 吹牛牌 AI 对战 - 技术评审稿

## 1. 总体架构
- 前端（Web）：大厅、组局、牌桌、结果页
- 游戏服务：规则引擎 + 回合状态机 + 对局存储
- AI 编排层：模型适配器 + 性格策略层 + 超时降级
- 内容审查：聊天发送前审核
- 埋点服务：行为日志与指标聚合

## 2. 状态机定义
### 2.1 顶层状态
- `waiting`：房间创建，未开始
- `playing`：对局进行中
- `ended`：已结算

### 2.2 回合子状态
- `turn_open`：当前玩家可执行 `play`
- `challenge_window`：其他玩家可执行 `challenge`
- `turn_settle`：结算挑战结果并移动回合

### 2.3 状态迁移
1. `waiting -> playing`：发牌成功且玩家就绪
2. `turn_open -> challenge_window`：玩家提交出牌
3. `challenge_window -> turn_settle`：收到挑战或窗口超时
4. `turn_settle -> turn_open`：结算完成，下一玩家回合开始
5. `playing -> ended`：有玩家手牌为 0 且最终判定有效

## 3. 数据模型（建议）
### 3.1 `games`
- `game_id` (PK)
- `status` (`waiting|playing|ended`)
- `round_no`
- `turn_seat`
- `current_rank`
- `pile_count`
- `winner_seat` (nullable)
- `created_at`, `updated_at`

### 3.2 `players`
- `game_id` + `seat` (PK)
- `type` (`human|ai`)
- `model_id`
- `persona_id`
- `hand_count`
- `is_active`

### 3.3 `actions`
- `action_id` (PK)
- `game_id`
- `seat`
- `type` (`play|challenge|chat`)
- `claimed_rank` (nullable)
- `claimed_count` (nullable)
- `cards_payload` (server encrypted or tokenized)
- `chat_text` (nullable)
- `created_at`

### 3.4 `events`
- `event_id` (PK)
- `game_id`
- `event_type`
- `payload_json`
- `created_at`

## 4. API（MVP）
### 4.1 房间与开局
- `POST /games`：创建房间
- `POST /games/{id}/start`：开局发牌
- `GET /games/{id}/state`：当前状态快照

### 4.2 对局动作
- `POST /games/{id}/actions/play`
- `POST /games/{id}/actions/challenge`
- `POST /games/{id}/actions/chat`

### 4.3 复盘与分享
- `GET /games/{id}/replay`
- `POST /share/{id}`

## 5. AI 编排层规则
- 输入上下文：公开牌面信息、历史动作、聊天历史、当前合法动作列表
- 严禁输入：其他玩家手牌、系统内部判定字段
- 输出格式：统一为 `play/challenge/chat/pass` 结构化 JSON
- 超时策略：超过时限执行降级动作（保守出牌或放弃挑战）

## 6. 聊天策略与审查
- 限制：每回合最多 1 条，长度上限例如 60 字
- 审查：发送前经过敏感内容与违规语义检测
- 失败处理：返回“消息未发送”并提示原因，不阻断回合推进

## 7. 风险与对策
- 延迟风险：多模型回合响应慢
  - 对策：模型超时降级 + 并发预请求
- 规则一致性风险：前后端判定不一致
  - 对策：以后端为单一权威，前端只渲染
- 注入风险：聊天影响系统提示
  - 对策：系统 prompt 隔离与白名单字段注入

## 8. 测试要求（最低）
- 规则单测：合法性、挑战成败、结束判定边界
- 集成测试：主流程与异常流程
- E2E：从创建到结算全链路
- 稳定性：并发烟测 + 超时恢复
