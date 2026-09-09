import "./style.css";
import { Game } from "./game";
const game = new Game();
// Expose state only on the local Vite development server for gameplay verification.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  (window as unknown as { game: Game }).game = game;
