# Lumen · Signal Flow

A luminous arcade puzzle about making room for what comes next. Route color packets into six target lanes, build satisfying bursts, and keep a ten-slot buffer from overflowing. Clear five sectors in roughly 5–8 minutes, or call packets early to play at your own pace.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` creates the production game in `dist`; `npm run preview` serves it. `npm test` runs the game-rule and seeded campaign tests.

## Play

- Click a packet in the bottom buffer. Adjacent packets of its color link together.
- Click a lane with a matching bottom target to send the run. One packet deals one hit; surplus packets stay in the buffer.
- Bursts of two or more packets build a score multiplier, up to ×5. Keep making bursts within 12 seconds to preserve it.
- Use **Reroute**, then click a lane to move its front color run behind the other targets. It holds two charges and refills from hits and over time.
- **Call** brings the next forecast packet in immediately when you want to pick up the pace.
- At ten packets, a five-second overflow countdown begins. Launch anything to recover.
- Later sectors add iris and sky packets, taller stacks, and shields that need two hits. Clear every target in all five sectors to win. Between sectors, the buffer resets and at least one reroute charge is restored.

The whole game is playable with the mouse. Optional keys: **1–0** select a buffer slot; **A S D F G H** launch into lanes 1–6; **R** reroutes; **N** calls a packet; **P / Space** pauses; **Esc** cancels selection or pauses; **M** toggles sound; **?** opens help; **Enter** starts, resumes, or continues.

Sound is synthesized locally. Sound and reduced-motion settings are available on the pause screen. Symbols distinguish every color. Losing focus automatically pauses the game. Personal bests and preferences are saved on this device when browser storage is available.

Built with TypeScript, PixiJS, and Vite. No accounts, backend, external assets, or network access are required after installation.
