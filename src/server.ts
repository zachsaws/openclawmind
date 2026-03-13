import express from "express";
import cors from "cors";
import path from "node:path";
import http from "node:http";
import { Server as SocketServer } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { GameEngine } from "./engine";
import { AiConfig, ChallengeRequest, ChatRequest, CreateGameRequest, PlayRequest } from "./types";
import { LocalStore } from "./store";
import { API_VERSION, GAME_RULES, WS_EVENTS } from "./contracts";

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*",
  },
});
const engine = new GameEngine();
const store = new LocalStore();
const port = Number(process.env.PORT || 3000);
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  pinoHttp({
    autoLogging: true,
  }),
);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(rateLimiter);
app.use(express.static(path.join(process.cwd(), "public")));

const defaultAis: [AiConfig, AiConfig, AiConfig] = [
  { modelId: "openai-gpt", personaId: "stable", displayName: "GPT Stable" },
  { modelId: "anthropic-claude", personaId: "loud", displayName: "Claude Loud" },
  { modelId: "google-gemini", personaId: "aggressive", displayName: "Gemini Aggro" },
];

function emitGameUpdate(gameId: string): void {
  const game = engine.toPublicGame(gameId);
  store.persistGame(game);
  io.to(gameId).emit(WS_EVENTS.update, { game });
}

io.on("connection", (socket) => {
  socket.on(WS_EVENTS.subscribe, (gameId: string) => {
    if (!gameId) return;
    socket.join(gameId);
    try {
      socket.emit(WS_EVENTS.update, { game: engine.toPublicGame(gameId) });
    } catch {
      // ignore invalid game on subscribe
    }
  });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/meta/bootstrap", (_req, res) => {
  res.json({
    apiVersion: API_VERSION,
    rules: GAME_RULES,
    wsEvents: WS_EVENTS,
  });
});

app.post("/games", (req, res) => {
  try {
    const body = req.body as Partial<CreateGameRequest>;
    const game = engine.createGame({
      humanName: body.humanName || "Human",
      aiConfigs: (body.aiConfigs as [AiConfig, AiConfig, AiConfig]) || defaultAis,
    });
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/games/:id/start", (req, res) => {
  try {
    const game = engine.startGame(req.params.id);
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/games/:id/state", (req, res) => {
  try {
    engine.tickGame(req.params.id);
    res.json({ game: engine.toPublicGame(req.params.id) });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.post("/games/:id/actions/play", (req, res) => {
  try {
    const body = req.body as PlayRequest;
    const game = engine.play(req.params.id, body);
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/games/:id/actions/challenge", (req, res) => {
  try {
    const body = req.body as ChallengeRequest;
    const game = engine.challenge(req.params.id, body);
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/games/:id/actions/chat", (req, res) => {
  try {
    const body = req.body as ChatRequest;
    const game = engine.chat(req.params.id, body);
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/games/:id/rematch", (req, res) => {
  try {
    const game = engine.rematch(req.params.id);
    const view = engine.toPublicGame(game.gameId);
    emitGameUpdate(game.gameId);
    res.json({ game: view });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/games/:id/replay", (req, res) => {
  try {
    res.json({ events: engine.listEvents(req.params.id) });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

setInterval(() => {
  engine.tickAllGames();
  for (const gameId of engine.listGameIds()) {
    emitGameUpdate(gameId);
  }
}, 1000);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});
