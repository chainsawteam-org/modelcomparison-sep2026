# Chroma Dispatch

A polished arcade puzzle about keeping a tiny freight terminal flowing. Group incoming color cells, fill outbound orders, and deliver all 30 orders across five increasingly demanding stages. A shift takes roughly 3–6 minutes.

## Run

Requires Node.js 22.18+ (or Node.js 24+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the production build; `npm run preview` serves it. `npm test` runs the simulation tests.

## Controls

- Click a cell to select every cell of its color; click a matching dock to dispatch.
- Only the cells the order needs are sent. Excess stays selected in the buffer.
- **A / S / D / G:** select mint / coral / iris / gold. **1–4:** dispatch to a dock.
- **F:** emergency flush. **P / Escape:** pause. **M:** sound. **?:** help.
- The entire game is also playable with the mouse.

## Find your flow

Fill an untouched color requirement in one batch for a bonus. Clear orders within 11 seconds of one another to build a multiplier, up to ×5. NEXT previews show the following orders; later stages introduce cargo with two colors that must be filled in sequence.

The buffer holds 12 cells. If it stays full for five seconds, the shift ends. Emergency flush ejects up to four selected cells (or the oldest four if no color is selected), breaks your chain, and recharges after 24 delivered cells. The first delivery starts the clock. Switching tabs automatically pauses the game.

Personal best and sound preference are saved locally when browser storage is available. All art is rendered with PixiJS; audio is synthesized locally. No backend, external assets, or account required.
