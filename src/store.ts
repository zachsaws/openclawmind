import fs from "node:fs";
import path from "node:path";
import { PublicGame } from "./types";

export class LocalStore {
  private readonly root: string;

  constructor(root = path.join(process.cwd(), "data", "games")) {
    this.root = root;
    fs.mkdirSync(this.root, { recursive: true });
  }

  persistGame(game: PublicGame): void {
    const filepath = path.join(this.root, `${game.gameId}.json`);
    fs.writeFileSync(filepath, JSON.stringify(game, null, 2), "utf8");
  }
}
