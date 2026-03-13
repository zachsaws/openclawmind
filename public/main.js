let gameId = null;
let gameState = null;
let selectedCardIdx = [];
const challengeWindowMs = 9000;
const socket = io();

function rankText(rank) {
  const m = { 1: "A", 11: "J", 12: "Q", 13: "K", 14: "SJ", 15: "BJ" };
  return m[rank] || String(rank);
}

function suitForRank(rank) {
  if (rank >= 14) return "";
  const suits = ["♠", "♥", "♣", "♦"];
  return suits[Math.abs(rank) % suits.length];
}

function seatText(seat) {
  return seat === 0 ? "你" : `AI${seat}`;
}

function latestPlayMap(events) {
  const map = new Map();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.eventType === "play" && !map.has(ev.payload?.seat)) {
      map.set(ev.payload.seat, {
        claimedCount: ev.payload.claimedCount,
        claimedRank: ev.payload.claimedRank,
      });
    }
  }
  return map;
}

function aiConfig(i) {
  const model = document.getElementById(`model${i}`).value.trim();
  const persona = document.getElementById(`persona${i}`).value;
  return {
    modelId: model || `model-${i}`,
    personaId: persona,
    displayName: `${model || `AI-${i}`}(${persona})`,
  };
}

function setStatus(text) {
  document.getElementById("statusText").textContent = text;
}

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request failed");
  return data;
}

async function quickStart() {
  const humanName = document.getElementById("humanName").value.trim() || "Player";
  const { game } = await api("/games", "POST", {
    humanName,
    aiConfigs: [aiConfig(1), aiConfig(2), aiConfig(3)],
  });
  gameId = game.gameId;
  subscribeGame();
  const started = await api(`/games/${gameId}/start`, "POST");
  selectedCardIdx = [];
  document.getElementById("setupPanel").style.display = "none";
  render(started.game);
  setStatus("对局开始，等待你的回合。");
}

async function rematch() {
  if (!gameId) throw new Error("当前没有对局");
  const { game } = await api(`/games/${gameId}/rematch`, "POST");
  gameId = game.gameId;
  selectedCardIdx = [];
  subscribeGame();
  render(game);
  hideModal("resultModal");
}

function hintSelect() {
  ensureGame();
  if (gameState.status !== "playing" || gameState.subState !== "turn_open" || gameState.turnSeat !== 0) {
    setStatus("当前不需要提示选牌");
    return;
  }
  const myHand = gameState.players.find((p) => p.seat === 0)?.hand || [];
  if (!myHand.length) return;

  const sameRankIdx = [];
  for (let i = 0; i < myHand.length; i += 1) {
    if (myHand[i] === gameState.currentRank) sameRankIdx.push(i);
  }
  if (sameRankIdx.length > 0) {
    selectedCardIdx = sameRankIdx.slice(0, Math.min(2, sameRankIdx.length));
    setStatus(`提示：优先出真实牌 ${rankText(gameState.currentRank)}。`);
  } else {
    selectedCardIdx = [0];
    setStatus("提示：你没有当前报点，先出 1 张进行诈唬。");
  }
  render(gameState);
}

async function play() {
  ensureGame();
  if (gameState.status !== "playing" || gameState.turnSeat !== 0 || gameState.subState !== "turn_open") {
    throw new Error("当前不能出牌");
  }
  if (selectedCardIdx.length < 1 || selectedCardIdx.length > 4) {
    throw new Error("请选择 1-4 张牌");
  }
  const myHand = gameState.players.find((p) => p.seat === 0)?.hand || [];
  const cards = selectedCardIdx.map((idx) => myHand[idx]).filter((n) => Number.isFinite(n));
  await api(`/games/${gameId}/actions/play`, "POST", {
    seat: 0,
    claimedRank: gameState.currentRank,
    cards,
  });
  selectedCardIdx = [];
}

async function challenge() {
  ensureGame();
  if (gameState.status !== "playing" || gameState.subState !== "challenge_window") {
    throw new Error("当前不可质疑");
  }
  if (!gameState.lastPlay || gameState.lastPlay.seat === 0) {
    throw new Error("不能质疑自己");
  }
  await api(`/games/${gameId}/actions/challenge`, "POST", { seat: 0 });
}

async function sendChat() {
  ensureGame();
  const input = document.getElementById("chatText");
  const text = input.value.trim();
  if (!text) return;
  await api(`/games/${gameId}/actions/chat`, "POST", { seat: 0, text });
  input.value = "";
}

function ensureGame() {
  if (!gameId || !gameState) throw new Error("请先开始对局");
}

function subscribeGame() {
  if (!gameId) return;
  socket.emit("game:subscribe", gameId);
}

function renderSeat(player, turnSeat, lp) {
  const node = document.getElementById(`seat-${player.seat}`);
  node.classList.toggle("active", player.seat === turnSeat);
  node.innerHTML = `
    <div class="seat-name">${seatText(player.seat)} · ${player.displayName}</div>
    <div class="seat-meta">手牌 ${player.handCount} 张</div>
    <div class="seat-meta">类型 ${player.type}</div>
    ${player.personaId ? `<div class="seat-badge">${player.personaId}</div>` : ""}
    ${lp ? `<div class="last-chip">上一手: ${rankText(lp.claimedRank)} x ${lp.claimedCount}</div>` : ""}
  `;
}

function renderCenter(game) {
  const phase = game.subState === "turn_open" ? "出牌阶段" : "质疑阶段";
  const last = game.lastPlay
    ? `${seatText(game.lastPlay.seat)} 报 ${rankText(game.lastPlay.claimedRank)} x ${game.lastPlay.claimedCount}`
    : "暂无出牌";
  document.getElementById("centerInfo").innerHTML = `
    <div>轮到 ${seatText(game.turnSeat)} · ${phase}</div>
    <div>当前报点 ${rankText(game.currentRank)} · 牌堆 ${game.pileCount} 张</div>
    <div>${last}</div>
  `;
  const pileBackCount = Math.max(1, Math.min(10, game.pileCount));
  const pileBacks =
    game.pileCount > 0
      ? `${Array.from({ length: pileBackCount })
          .map(() => '<span class="pile-back"></span>')
          .join("")}<span class="pile-count">${game.pileCount} 张</span>`
      : '<span class="feed-item">牌堆为空</span>';
  document.getElementById("pileCards").innerHTML = pileBacks;
}

function renderTimer(game) {
  const label = document.getElementById("timerLabel");
  const bar = document.getElementById("timerBar");
  if (game.subState !== "challenge_window" || !game.challengeDeadlineMs) {
    label.textContent = "倒计时 -";
    bar.style.width = "0%";
    return;
  }
  const left = Math.max(0, game.challengeDeadlineMs - Date.now());
  const leftSec = (left / 1000).toFixed(1);
  const usedPct = Math.min(100, Math.max(0, ((challengeWindowMs - left) / challengeWindowMs) * 100));
  label.textContent = `质疑窗口 ${leftSec}s`;
  bar.style.width = `${usedPct}%`;
}

function renderHand(game) {
  const handNode = document.getElementById("handCards");
  const myHand = game.players.find((p) => p.seat === 0)?.hand || [];
  if (!myHand.length) {
    handNode.innerHTML = '<div class="feed-item">暂无手牌</div>';
    document.getElementById("myHandCount").textContent = "0";
    return;
  }
  document.getElementById("myHandCount").textContent = String(myHand.length);
  handNode.innerHTML = myHand
    .map((rank, idx) => {
      const selected = selectedCardIdx.includes(idx) ? "selected" : "";
      const suit = suitForRank(rank);
      const isRed = suit === "♥" || suit === "♦" ? "red" : "";
      return `<button class="poker-card ${selected} ${isRed}" data-idx="${idx}" type="button">${rankText(rank)}${suit}</button>`;
    })
    .join("");
}

function eventText(e) {
  const p = e.payload || {};
  if (e.eventType === "play") return `${seatText(p.seat)} 报 ${rankText(p.claimedRank)} x ${p.claimedCount}`;
  if (e.eventType === "challenge")
    return `${seatText(p.challengerSeat)} 质疑 ${seatText(p.targetSeat)} (${p.result === "success" ? "成功" : "失败"})`;
  if (e.eventType === "chat") return `${seatText(p.seat)}: ${p.text}`;
  if (e.eventType === "game_started") {
    return `本局开始：${p.deckCount || 1}副牌，${p.cardsPerPlayer || "-"}张/人，${seatText(p.starterSeat || 0)}先手`;
  }
  if (e.eventType === "game_ended") return `本局结束，${seatText(p.winnerSeat)}获胜`;
  return e.eventType;
}

function renderFeeds(game) {
  const logs = game.recentEvents
    .filter((e) => e.eventType !== "chat")
    .slice(-12)
    .reverse()
    .map((e) => `<div class="feed-item">${eventText(e)}</div>`)
    .join("");
  document.getElementById("actionLog").innerHTML = logs || '<div class="feed-item">暂无记录</div>';

  const chats = game.recentEvents
    .filter((e) => e.eventType === "chat")
    .slice(-14)
    .reverse()
    .map((e) => {
      const self = e.payload?.seat === 0 ? "self" : "";
      return `<div class="feed-item ${self}">${eventText(e)}</div>`;
    })
    .join("");
  document.getElementById("chatFeed").innerHTML = chats || '<div class="feed-item">暂无聊天</div>';
}

function updateButtons(game) {
  const isChallengePhaseForHuman =
    game.status === "playing" &&
    game.subState === "challenge_window" &&
    game.lastPlay &&
    game.lastPlay.seat !== 0;

  document.getElementById("btnPlay").disabled = !(
    game.status === "playing" &&
    game.turnSeat === 0 &&
    game.subState === "turn_open"
  );
  document.getElementById("btnHint").disabled = !(
    game.status === "playing" &&
    game.turnSeat === 0 &&
    game.subState === "turn_open"
  );
  document.getElementById("btnChallenge").disabled = !(
    isChallengePhaseForHuman
  );
  document.getElementById("btnPassChallenge").disabled = !isChallengePhaseForHuman;
  document.getElementById("btnChat").disabled = game.status !== "playing";
  document.getElementById("btnRematch").disabled = !gameId;
  document.getElementById("claimRankView").textContent = game.status === "playing" ? rankText(game.currentRank) : "-";
  document.getElementById("selectedCount").textContent = String(selectedCardIdx.length);
}

function showModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function render(game) {
  gameState = game;
  document.getElementById("gameInfo").textContent = gameId ? `gameId: ${gameId}` : "未创建对局";
  const playMap = latestPlayMap(game.recentEvents || []);
  game.players.forEach((p) => renderSeat(p, game.turnSeat, playMap.get(p.seat)));
  renderCenter(game);
  renderTimer(game);
  renderHand(game);
  renderFeeds(game);
  updateButtons(game);

  if (game.status === "ended") {
    document.getElementById("resultTitle").textContent = game.winnerSeat === 0 ? "胜利" : "失败";
    document.getElementById("resultDesc").textContent = `本局赢家: ${seatText(game.winnerSeat)}`;
    showModal("resultModal");
  }

  if (game.status === "playing" && game.turnSeat === 0 && game.subState === "turn_open") {
    setStatus("轮到你出牌，点击手牌选择后按「出牌」。");
  } else if (game.status === "playing" && game.subState === "challenge_window") {
    setStatus(game.lastPlay?.seat === 0 ? "等待他人质疑..." : "你可在倒计时内选择「质疑」。");
  } else if (game.status === "waiting") {
    setStatus("请开始游戏。");
  }

  document.getElementById("stateView").textContent = JSON.stringify(game, null, 2);
}

function onCardClick(e) {
  const t = e.target;
  if (!t.classList.contains("poker-card")) return;
  const idx = Number(t.dataset.idx);
  if (!Number.isFinite(idx)) return;
  if (selectedCardIdx.includes(idx)) {
    selectedCardIdx = selectedCardIdx.filter((x) => x !== idx);
  } else {
    if (selectedCardIdx.length >= 4) {
      setStatus("最多选择 4 张");
      return;
    }
    selectedCardIdx.push(idx);
  }
  if (gameState) render(gameState);
}

function passChallenge() {
  setStatus("你选择了不质疑，等待倒计时结束。");
}

function safe(fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      setStatus(err.message || "操作失败");
    }
  };
}

function bind() {
  document.getElementById("btnQuickStart").addEventListener("click", safe(quickStart));
  document.getElementById("btnRematch").addEventListener("click", safe(rematch));
  document.getElementById("btnModalRematch").addEventListener("click", safe(rematch));
  document.getElementById("btnHint").addEventListener("click", hintSelect);
  document.getElementById("btnPlay").addEventListener("click", safe(play));
  document.getElementById("btnChallenge").addEventListener("click", safe(challenge));
  document.getElementById("btnPassChallenge").addEventListener("click", passChallenge);
  document.getElementById("btnChat").addEventListener("click", safe(sendChat));
  document.getElementById("btnHideModal").addEventListener("click", () => hideModal("resultModal"));
  document.getElementById("btnGuideClose").addEventListener("click", () => hideModal("guideModal"));
  document.getElementById("handCards").addEventListener("click", onCardClick);

  socket.on("game:update", ({ game }) => {
    if (!gameId || game.gameId !== gameId) return;
    render(game);
  });
}

bind();
