import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "./engine";

function makeGame(engine: GameEngine) {
  return engine.createGame({
    humanName: "Tester",
    aiConfigs: [
      { modelId: "openai-gpt", personaId: "stable", displayName: "GPT" },
      { modelId: "anthropic-claude", personaId: "loud", displayName: "Claude" },
      { modelId: "google-gemini", personaId: "aggressive", displayName: "Gemini" },
    ],
  });
}

test("startGame is idempotent when already playing", () => {
  const engine = new GameEngine();
  const game = makeGame(engine);
  const first = engine.startGame(game.gameId);
  const second = engine.startGame(game.gameId);

  assert.equal(first.gameId, second.gameId);
  assert.equal(second.status, "playing");
  assert.equal(second.turnSeat, 1);
});

test("public view only exposes human seat hand", () => {
  const engine = new GameEngine();
  const game = makeGame(engine);
  engine.startGame(game.gameId);

  const pub = engine.toPublicGame(game.gameId, 0);
  const human = pub.players.find((p) => p.seat === 0);
  const ai = pub.players.find((p) => p.seat === 1);

  assert.ok(human?.hand && human.hand.length > 0);
  assert.equal(ai?.hand, undefined);
});

test("two decks are evenly dealt to 4 players (27 each)", () => {
  const engine = new GameEngine();
  const game = makeGame(engine);
  engine.startGame(game.gameId);
  const pub = engine.toPublicGame(game.gameId, 0);
  for (const player of pub.players) {
    assert.equal(player.handCount, 27);
  }
});
