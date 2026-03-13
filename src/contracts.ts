export const GAME_RULES = {
  deckCount: 2,
  includeJokers: true,
  playersPerTable: 4,
  cardsPerPlayer: 27,
  starterSeat: 1,
  challengeWindowMs: 9000,
} as const;

export const WS_EVENTS = {
  subscribe: "game:subscribe",
  update: "game:update",
} as const;

export const API_VERSION = "v1";
