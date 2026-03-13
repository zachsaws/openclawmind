import crypto from "node:crypto";
import {
  ChallengeRequest,
  ChatRequest,
  CreateGameRequest,
  Game,
  GameEvent,
  PlayRequest,
  Player,
  PublicGame,
} from "./types";

const MAX_CHAT_LENGTH = 60;
const CHALLENGE_WINDOW_MS = 9000;
const RANK_MIN = 1;
const RANK_MAX = 15;
const DECK_COUNT = 2;
const INCLUDE_JOKERS = true;

function nowIso(): string {
  return new Date().toISOString();
}

function event(eventType: string, payload: Record<string, unknown>): GameEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    payload,
    createdAt: nowIso(),
  };
}

function nextRank(rank: number): number {
  return rank >= RANK_MAX ? RANK_MIN : rank + 1;
}

function nextSeat(game: Game, seat: number): number {
  const activeSeats = game.players.filter((p) => p.isActive).map((p) => p.seat);
  const idx = activeSeats.indexOf(seat);
  return activeSeats[(idx + 1) % activeSeats.length];
}

function buildDeck(): number[] {
  const deck: number[] = [];
  for (let repeat = 0; repeat < DECK_COUNT; repeat += 1) {
    for (let rank = 1; rank <= 13; rank += 1) {
      for (let count = 0; count < 4; count += 1) {
        deck.push(rank);
      }
    }
    if (INCLUDE_JOKERS) {
      deck.push(14);
      deck.push(15);
    }
  }
  return shuffle(deck);
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortHand(hand: number[]): void {
  // Keep jokers first, then sort by rank descending to match common card-game habits.
  hand.sort((a, b) => b - a);
}

function deal(players: Player[]): void {
  const deck = buildDeck();
  let seat = 0;
  while (deck.length > 0) {
    players[seat].hand.push(deck.pop()!);
    seat = (seat + 1) % players.length;
  }
  for (const player of players) {
    sortHand(player.hand);
  }
}

function removeHandCards(hand: number[], cards: number[]): boolean {
  const copy = [...hand];
  for (const card of cards) {
    const idx = copy.indexOf(card);
    if (idx === -1) {
      return false;
    }
    copy.splice(idx, 1);
  }
  hand.splice(0, hand.length, ...copy);
  sortHand(hand);
  return true;
}

function personaChallengeRate(personaId?: string): number {
  if (personaId === "aggressive") return 0.48;
  if (personaId === "loud") return 0.32;
  if (personaId === "stable") return 0.22;
  return 0.12;
}

export class GameEngine {
  private readonly games = new Map<string, Game>();

  createGame(input: CreateGameRequest): Game {
    if (!input.humanName?.trim()) {
      throw new Error("humanName is required");
    }

    const players: Player[] = [
      {
        seat: 0,
        type: "human",
        displayName: input.humanName.trim(),
        hand: [],
        isActive: true,
      },
      ...input.aiConfigs.map((ai, idx) => ({
        seat: idx + 1,
        type: "ai" as const,
        displayName: ai.displayName,
        modelId: ai.modelId,
        personaId: ai.personaId,
        hand: [],
        isActive: true,
      })),
    ];

    const created = nowIso();
    const game: Game = {
      gameId: crypto.randomUUID(),
      status: "waiting",
      subState: "turn_open",
      roundNo: 1,
      turnSeat: 1,
      currentRank: 1,
      pile: [],
      winnerSeat: null,
      players,
      lastPlay: null,
      challengeDeadlineMs: null,
      pendingWinnerSeat: null,
      events: [event("game_created", { humanName: input.humanName })],
      createdAt: created,
      updatedAt: created,
    };

    this.games.set(game.gameId, game);
    return game;
  }

  startGame(gameId: string): Game {
    const game = this.mustGetGame(gameId);
    if (game.status === "playing") {
      return game;
    }
    if (game.status === "ended") {
      throw new Error("game already ended");
    }

    game.players.forEach((player) => {
      player.hand = [];
    });
    deal(game.players);

    game.status = "playing";
    game.subState = "turn_open";
    game.turnSeat = 1;
    game.currentRank = 1;
    game.challengeDeadlineMs = null;
    game.pendingWinnerSeat = null;
    game.lastPlay = null;
    game.events.push(
      event("game_started", {
        deckCount: DECK_COUNT,
        includeJokers: INCLUDE_JOKERS,
        cardsPerPlayer: game.players[0]?.hand.length ?? 0,
        starterSeat: game.turnSeat,
      }),
    );
    game.updatedAt = nowIso();
    return game;
  }

  play(gameId: string, input: PlayRequest): Game {
    const game = this.mustGetGame(gameId);
    this.tickGame(gameId);
    this.assertGamePlaying(game);

    if (game.subState !== "turn_open") {
      throw new Error("play is not allowed in current subState");
    }
    if (input.seat !== game.turnSeat) {
      throw new Error("not your turn");
    }
    if (input.claimedRank !== game.currentRank) {
      throw new Error("claimedRank must match currentRank");
    }
    if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 4) {
      throw new Error("cards length must be between 1 and 4");
    }

    const player = game.players[input.seat];
    const ok = removeHandCards(player.hand, input.cards);
    if (!ok) {
      throw new Error("player does not own these cards");
    }

    game.pile.push(...input.cards);
    game.lastPlay = {
      seat: input.seat,
      claimedRank: input.claimedRank,
      claimedCount: input.cards.length,
      cards: [...input.cards],
      actionId: crypto.randomUUID(),
      createdAt: nowIso(),
    };
    game.subState = "challenge_window";
    game.challengeDeadlineMs = Date.now() + CHALLENGE_WINDOW_MS;
    game.pendingWinnerSeat = player.hand.length === 0 ? input.seat : null;
    game.events.push(
      event("play", {
        seat: input.seat,
        claimedRank: input.claimedRank,
        claimedCount: input.cards.length,
      }),
    );
    game.updatedAt = nowIso();
    return game;
  }

  challenge(gameId: string, input: ChallengeRequest): Game {
    const game = this.mustGetGame(gameId);
    this.tickGame(gameId);
    this.assertGamePlaying(game);

    if (game.subState !== "challenge_window" || !game.lastPlay || game.challengeDeadlineMs === null) {
      throw new Error("challenge window is closed");
    }
    if (input.seat === game.lastPlay.seat) {
      throw new Error("cannot challenge your own play");
    }

    const allTruth = game.lastPlay.cards.every((card) => card === game.lastPlay!.claimedRank);
    const penaltySeat = allTruth ? input.seat : game.lastPlay.seat;
    game.players[penaltySeat].hand.push(...game.pile);
    game.pile = [];

    game.events.push(
      event("challenge", {
        challengerSeat: input.seat,
        targetSeat: game.lastPlay.seat,
        result: allTruth ? "fail" : "success",
        penaltySeat,
      }),
    );

    game.subState = "turn_open";
    game.turnSeat = penaltySeat;
    game.roundNo += 1;
    game.currentRank = 1;
    game.challengeDeadlineMs = null;
    game.pendingWinnerSeat = null;
    game.lastPlay = null;
    game.updatedAt = nowIso();
    return game;
  }

  chat(gameId: string, input: ChatRequest): Game {
    const game = this.mustGetGame(gameId);
    this.assertGamePlaying(game);

    const text = input.text.trim();
    if (!text) {
      throw new Error("chat text is empty");
    }
    if (text.length > MAX_CHAT_LENGTH) {
      throw new Error(`chat text length exceeds ${MAX_CHAT_LENGTH}`);
    }
    if (this.isBlockedChat(text)) {
      throw new Error("chat blocked by moderation");
    }

    game.events.push(event("chat", { seat: input.seat, text }));
    game.updatedAt = nowIso();
    return game;
  }

  tickGame(gameId: string): Game {
    const game = this.mustGetGame(gameId);
    if (game.status !== "playing") {
      return game;
    }

    if (game.subState === "challenge_window") {
      this.tryAiChallenge(game);
      if (game.subState === "challenge_window" && game.challengeDeadlineMs !== null && Date.now() >= game.challengeDeadlineMs) {
        if (game.pendingWinnerSeat !== null) {
          game.status = "ended";
          game.winnerSeat = game.pendingWinnerSeat;
          game.events.push(event("game_ended", { winnerSeat: game.winnerSeat, reason: "no_challenge" }));
        } else if (game.lastPlay) {
          game.subState = "turn_open";
          game.turnSeat = nextSeat(game, game.lastPlay.seat);
          game.currentRank = nextRank(game.currentRank);
        }
        game.pendingWinnerSeat = null;
        game.lastPlay = null;
        game.challengeDeadlineMs = null;
        game.updatedAt = nowIso();
      }
      return game;
    }

    if (game.subState === "turn_open") {
      const current = game.players[game.turnSeat];
      if (current.type === "ai") {
        const aiAction = this.aiPlay(game, current.seat);
        this.play(game.gameId, aiAction);
      }
    }
    return game;
  }

  tickAllGames(): void {
    for (const gameId of this.games.keys()) {
      this.tickGame(gameId);
    }
  }

  getGame(gameId: string): Game {
    return this.mustGetGame(gameId);
  }

  rematch(gameId: string): Game {
    const game = this.mustGetGame(gameId);
    const human = game.players.find((p) => p.type === "human");
    if (!human) {
      throw new Error("human player not found");
    }
    const aiConfigs = game.players
      .filter((p) => p.type === "ai")
      .map((p) => ({
        modelId: p.modelId || "ai-model",
        personaId: p.personaId || "stable",
        displayName: p.displayName,
      }));
    if (aiConfigs.length !== 3) {
      throw new Error("only 4-player mode is supported");
    }
    const next = this.createGame({
      humanName: human.displayName,
      aiConfigs: aiConfigs as CreateGameRequest["aiConfigs"],
    });
    return this.startGame(next.gameId);
  }

  toPublicGame(gameId: string, viewerSeat = 0): PublicGame {
    const game = this.mustGetGame(gameId);
    return {
      gameId: game.gameId,
      status: game.status,
      subState: game.subState,
      roundNo: game.roundNo,
      turnSeat: game.turnSeat,
      currentRank: game.currentRank,
      pileCount: game.pile.length,
      winnerSeat: game.winnerSeat,
      players: game.players.map((player) => ({
        seat: player.seat,
        type: player.type,
        displayName: player.displayName,
        modelId: player.modelId,
        personaId: player.personaId,
        handCount: player.hand.length,
        hand: player.seat === viewerSeat ? [...player.hand] : undefined,
        isActive: player.isActive,
      })),
      lastPlay: game.lastPlay,
      challengeDeadlineMs: game.challengeDeadlineMs,
      recentEvents: game.events.slice(-30),
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    };
  }

  listEvents(gameId: string): GameEvent[] {
    return this.mustGetGame(gameId).events;
  }

  listGameIds(): string[] {
    return [...this.games.keys()];
  }

  private aiPlay(game: Game, seat: number): PlayRequest {
    const player = game.players[seat];
    const matching = player.hand.filter((card) => card === game.currentRank);
    const truthful = matching.length > 0;
    let cards: number[];

    if (truthful) {
      cards = [matching[0]];
    } else {
      cards = [player.hand[Math.floor(Math.random() * player.hand.length)]];
    }
    return {
      seat,
      cards,
      claimedRank: game.currentRank,
    };
  }

  private tryAiChallenge(game: Game): void {
    if (!game.lastPlay) return;
    const challengers = game.players.filter((player) => player.type === "ai" && player.seat !== game.lastPlay!.seat);
    for (const challenger of challengers) {
      const rate = personaChallengeRate(challenger.personaId);
      if (Math.random() < rate) {
        this.challenge(game.gameId, { seat: challenger.seat });
        return;
      }
    }
  }

  private isBlockedChat(text: string): boolean {
    const blocked = ["诈骗", "毒品", "恐怖主义", "色情", "仇恨"];
    return blocked.some((word) => text.includes(word));
  }

  private assertGamePlaying(game: Game): void {
    if (game.status !== "playing") {
      throw new Error("game is not playing");
    }
  }

  private mustGetGame(gameId: string): Game {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("game not found");
    }
    return game;
  }
}
