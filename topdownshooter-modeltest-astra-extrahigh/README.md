# LAST SIGNAL

A polished, original 3D arena shooter built with TypeScript, Three.js, and Vite. Defend a suspended communications relay, adapt your operator, and bring a silent city back online.

## Run

Requires Node.js 20.19+ or 22.12+ and a modern desktop browser with WebGL 2.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. For a production build, run `npm run build`, then `npm run preview`. Everything runs locally: no account, backend, external art, fonts, or audio services.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Fire |
| Shift | Phase dash; two charges, brief invulnerability |
| Space | Discharge: radial damage and projectile clearance |
| 1 / 2 | Needle rifle / Breaker scattergun |
| Q | Switch weapon |
| R | Reload; unlimited reserve ammunition |
| Escape | Pause / resume |
| M | Mute / unmute |
| 1 / 2 / 3 in upgrade screen | Choose augmentation |

## The mission

Survive six 45-second encounters, clearing remaining enemies after each. Choose a permanent augmentation between encounters and recover 25 integrity. The seventh encounter is a two-phase Warden boss. A complete run takes roughly 6–9 minutes.

Lime fragments charge Discharge. Cyan repair pickups restore integrity. Cover blocks bullets from both sides. Orange canisters create operator-safe explosions. Enemy sights and red impact circles telegraph attacks; dash or reposition before they resolve.

Build around piercing rounds, chain explosions, slowing shots, an orbiting gun drone, offensive dashes, or energy recycling. Chain eliminations quickly to build a score multiplier up to ×4. Victory adds integrity and time bonuses. Personal bests and settings are saved locally. Assist mode reduces incoming damage by 35% and keeps its own best score.

The field manual and settings are available from the title screen. The game pauses on focus loss. Audio is generated in the browser and begins after interaction. Low quality disables bloom and shadows; camera shake and ambient audio can be disabled independently.

## Verification

`npm test` checks swept collisions, dash boundaries, cover navigation, and upgrade selection. `npm run build` checks TypeScript and builds the production game.
