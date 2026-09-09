# Chroma Depot

A fast arcade puzzle game about routing colour. Orbs arrive on a rail that only
holds eight; four bays each want a specific hue in a specific quantity. Ship
orders before the rail backs up.

Built with **TypeScript + PixiJS + Vite**. Every visual and every sound is
generated at runtime — the repository contains no art or audio files.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (http://localhost:5188). `npm run build` produces a
static bundle in `dist/`.

## Controls

| Action | Mouse | Keyboard |
| --- | --- | --- |
| Select an orb | Click it (the front orb is auto-selected) | `←` `→` |
| Deploy to a bay | Click the bay, or drag the orb onto it | `1` – `4` |
| Vent an orb | Click the vent, or drag the orb onto it | `Space` / `V` |
| Pause | Click PAUSE | `P` / `Esc` |
| Mute | Click SOUND | `M` |
| Retry after a run | Click RUN IT AGAIN | `R` |

## Core mechanics

- **Match and ship.** A bay accepts only its own hue. Fill every unit of an
  order and it ships, scores, and is replaced by a new one.
- **The rail is the clock.** Eight slots. When it fills you get three seconds of
  grace before the depot floods and the run ends.
- **Multiplier and flow.** Each shipped order raises the multiplier. It slips
  back down if you go too long without shipping, and the window gets tighter the
  higher it climbs — a big multiplier has to be held, not just earned.
- **Chains.** Ship two or more orders within about three seconds of each other
  for a rising chain bonus. Holding several bays one unit from done and finishing
  them in a burst is where the points are.
- **Special cargo.** *Twin* orbs fill two units at once (overfilling wastes the
  spare). *Prisms* are wildcards. *Slag* is dead weight that no bay will take.
- **The vent.** The one escape valve: it destroys any orb, including slag, then
  recharges. It recharges faster the higher your multiplier, so playing well buys
  you room to breathe. Venting anything other than slag halves your multiplier.
- **Priority orders.** From wave 4, some orders run on a timer and pay triple.
  Let one expire and the bay jams and your multiplier resets.

Waves add hues, larger orders, slag, priority timers and a faster intake. A
typical run lasts three to ten minutes.

## Project layout

```
src/
  core/     app shell, scene stack, maths, procedural textures, camera shake
  audio/    WebAudio synth (sfx + generative backing pulse)
  game/     rules model, balance config, and the view for each element
  fx/       particle layer and animated backdrop
  ui/       buttons, banner, modal panel
  scenes/   menu and gameplay screens
tools/sim.ts  headless balance harness (`npm run sim`)
```

`src/game/model.ts` holds all gameplay rules and touches no Pixi objects; it
returns events that `src/scenes/game-scene.ts` turns into visuals and sound. All
tuning lives in `src/game/config.ts`.
