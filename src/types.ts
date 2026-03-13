export type GameStatus = "waiting" | "playing" | "ended";
export type SubState = "turn_open" | "challenge_window";
export type PlayerType = "human" | "ai";
export type ActionType = "play" | "challenge" | "chat";

export interface AiConfig {
  modelId: string;
  personaId: "aggressive" | "stable" | "loud" | "quiet";
  displayName: string;
}

export interface Player {
  seat: number;
  type: PlayerType;
  displayName: string;
  modelId?: string;
  personaId?: AiConfig["personaId"];
  hand: number[];
  isActive: boolean;
}

export interface LastPlay {
  seat: number;
  claimedRank: number;
  claimedCount: number;
  cards: number[];
  actionId: string;
  createdAt: string;
}

export interface GameEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Game {
  gameId: string;
  status: GameStatus;
  subState: SubState;
  roundNo: number;
  turnSeat: number;
  currentRank: number;
  pile: number[];
  winnerSeat: number | null;
  players: Player[];
  lastPlay: LastPlay | null;
  challengeDeadlineMs: number | null;
  pendingWinnerSeat: number | null;
  events: GameEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicPlayer {
  seat: number;
  type: PlayerType;
  displayName: string;
  modelId?: string;
  personaId?: AiConfig["personaId"];
  handCount: number;
  hand?: number[];
  isActive: boolean;
}

export interface PublicGame {
  gameId: string;
  status: GameStatus;
  subState: SubState;
  roundNo: number;
  turnSeat: number;
  currentRank: number;
  pileCount: number;
  winnerSeat: number | null;
  players: PublicPlayer[];
  lastPlay: LastPlay | null;
  challengeDeadlineMs: number | null;
  recentEvents: GameEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameRequest {
  humanName: string;
  aiConfigs: [AiConfig, AiConfig, AiConfig];
}

export interface PlayRequest {
  seat: number;
  cards: number[];
  claimedRank: number;
}

export interface ChallengeRequest {
  seat: number;
}

export interface ChatRequest {
  seat: number;
  text: string;
}
