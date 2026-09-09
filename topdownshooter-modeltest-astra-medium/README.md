# EMBER / Relay Zero

A complete 3D tactical arcade shooter built with TypeScript, Three.js, and Vite. Survive five escalating encounters, select permanent upgrades, then destroy the Warden. A successful run takes roughly 5–8 minutes.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. No accounts, backend, remote assets, or services are needed. `npm run build` creates the production game in `dist`; `npm run preview` serves it locally.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left mouse | Fire |
| 1 / 2 | Pulse rifle / scattergun |
| R | Reload (also automatic on empty) |
| Shift | Invulnerable directional dash |
| Space | Discharge at full energy |
| Escape | Pause / resume |

## Field guide

- **Hold, then clear:** survive each 55-second encounter, then eliminate remaining machines. Between encounters, repair 20 integrity and choose a permanent modification.
- **Use cover:** the four machinery blocks stop all projectiles. Enemies route around them. Keep moving when orbital warning circles appear.
- **Prioritize threats:** red drones pursue, blue sentries keep their distance and fire spreads, amber lancers telegraph a rapid charge. The Warden combines radial barrages and aimed fire, accelerating at half integrity.
- **Harvest energy:** amber cells charge your discharge, which destroys nearby threats and clears hostile projectiles. Mint cells repair 18 integrity. Move close to collect them.
- **Build your operator:** piercing shots, explosive deaths, offensive dashes, energy collection, rapid fire, mobility, or armor. Five choices per run.
- **Keep the chain alive:** consecutive kills within 3.5 seconds increase score multipliers. Taking damage breaks the chain. Your personal best is saved locally.

Procedural 3D geometry, shadows, particles, and synthesized audio are included. Sound starts after you enter the relay and can be muted. Losing focus pauses the game.

## Verification

```sh
npx playwright install chromium
npm test
npm run build
```

Browser checks cover movement, aiming and kills, charge distance, navigation around cover, discharge, damage, pause, upgrades, death, victory, restarts, console errors, and sustained combat. Tests start their own Vite server on port 5188; screenshots go to `.test-artifacts`. Installed Microsoft Edge is used as a fallback if Playwright Chromium is absent.
