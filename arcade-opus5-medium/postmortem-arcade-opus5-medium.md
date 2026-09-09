# Chroma Depot — Postmortem

A record of how the game in this repository was built: the process, the reasoning
behind the design decisions, and what it cost in time and tokens.

The brief lives in [`design.md`](design.md): build a complete, polished 2D arcade
puzzle game around "coloured objects arrive into a limited queue; decide where to
deploy them before the space fills up", using TypeScript + PixiJS + Vite, with no
questions asked and no external assets.

---

## 1. Process

The whole game was built in a single autonomous run from one prompt
("Following the instructions in design.md, create a complete, polished, playable
2D arcade puzzle game"), then verified in a short follow-up session. No
intermediate human direction was given.

### Phase 1 — Read and decide (~2 min)

Read the brief, checked the toolchain (`node -v`, `npm -v`, clean git tree), and
committed to a concept *before writing any code*: **Chroma Depot**, a colour
routing depot. The decision to name and frame the game up front — rather than
prototyping a generic matcher and theming it later — is what kept the visual
language, the audio, and the vocabulary (rail, bay, vent, slag, orders, waves)
coherent for the rest of the run.

### Phase 2 — Scaffold and core systems (~14 min)

Built bottom-up, in dependency order, so that nothing had to be rewritten later:

1. `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts`
2. `src/game/config.ts` — all balance numbers in one file, before any code that
   consumes them
3. `src/core/math.ts`, `src/core/textures.ts` (procedural texture generation),
   `src/audio/audio.ts` (WebAudio synth)
4. `src/game/types.ts` + `src/game/model.ts` — the pure rules layer
5. Views: orb, bay, rail, vent, HUD, particles, backdrop, shake
6. UI: button, banner, panel
7. Scenes: game scene, menu scene, then `main.ts`

Total: ~3,750 lines of TypeScript across 24 files.

### Phase 3 — First playable + typecheck (~5 min)

`npx tsc --noEmit` clean, dev server up on port 5188 via `.claude/launch.json`,
first play in the browser. Two rendering bugs in the backdrop were fixed here
(canvas gradient generation).

### Phase 4 — Headless balance harness (~5 min)

Rather than guessing at balance from a handful of manual plays, wrote
[`tools/sim.ts`](tools/sim.ts): a headless harness that drives the pure model with
scripted players of varying skill (reaction time × decision quality) over many
runs and reports median/range of run length, wave reached, score, and peak
multiplier. Exposed as `npm run sim`.

The first run was the single most useful result of the project:

```
profile   |  time (s)          |  wave      |  score
novice    |   334 (163-495)    |  7.7       |  138197
average   |   350 (223-543)    |  8.1       |  158055
expert    |   338 (195-485)    |  7.8       |  138807
```

**Skill did not matter.** An expert scored no better than a novice. The game was
functional and completely undifferentiating — exactly the failure mode the brief
warns about ("meaningful decisions rather than obvious actions"). Three targeted
changes followed (detailed in §2), each re-validated against the sim. Final:

```
profile   |  time (s)          |  wave      |  score     |  peak
sloppy    |   263 (123-512)    |  6.3       |  103423    |  x12.0  chain 3.5
novice    |   360 (166-552)    |  8.2       |  193887    |  x12.0  chain 3.5
average   |   357 (208-596)    |  8.1       |  223990    |  x12.0  chain 4.2
expert    |   404 (197-725)    |  9.0       |  239588    |  x12.0  chain 3.8
```

Skill now spans a ~2.3× score range, and median run length lands at 4–7 minutes —
inside the 3–10 minute target from the brief.

### Phase 5 — Play, observe, fix (~5 min)

Driven through the browser preview: full runs, deliberate failures, restarts,
pause, mute, resize, console checks. A temporary `o` key was injected to force
game-over so the end-of-run flow could be tested repeatedly without playing to a
loss; it was removed in the same pass. Bugs found and fixed by playing, not by
reading code:

- **Orbs parked at the door during overflow were unclickable** after the overflow
  cleared — the spawn handler assumed a fresh view and skipped re-enabling input
  on an existing one.
- **Game-over panel was semi-transparent** over a busy particle field, making the
  score hard to read. Dim raised to 0.86, panel to fully opaque.
- **"WRONG HUE" callout was drawn under the cursor** — moved from −40 to +152 px
  so the feedback is never hidden by the player's own hand.
- **"NEW BEST" showed on the first ever run**, when there was no best to beat.
- **The vent highlighted whenever anything was selected**, teaching the player to
  vent good orbs. Now it only lights when venting is genuinely correct: the orb is
  slag, or no bay on the board will take it.
- **Opening seconds were empty** — the rail now seeds with orbs matching the
  opening orders so the first action is available immediately (the brief asks for
  satisfaction within 30 seconds).
- **Opening banner said "CHROMA DEPOT"** — a title, not an instruction. Changed to
  "ROUTE THE ORBS / Send each orb to a bay that wants its hue".

### Phase 6 — Cleanup and ship (~2 min)

Dead-code sweep (grep for each exported symbol, delete the unreferenced ones:
`orbAt`, `capacity`, `slotCenter`, `slotRadius`, and others), final
`tsc --noEmit` + `npm run build` + `npm run sim`, README written.

---

## 2. Design decisions and the logic behind them

### The core loop: a rail, four bays, one vent

The brief's concept allows spatial placement, routing, or matching. The choice was
**routing with an explicit queue**, because it makes the pressure legible: eight
slots, visible, filling. The player can always see exactly how close they are to
losing — something the brief asks for directly — without a separate meter that
needs explaining.

Four bays × specific hue × specific quantity gives the decision its shape: an orb
is not simply "right" or "wrong", it is *worth more later* if you hold a bay one
unit from done and burst-complete several at once.

### Why the multiplier decays, and faster the higher it is

The first sim run's flat skill curve had one root cause: the multiplier was easy
to build and free to keep. Fix: `flowWindow(m) = max(5.5, 12.5 − m·0.7)` — the
higher the multiplier, the shorter the window before it slips. A big multiplier
now has to be *held*, which converts sustained play quality into score. Cap raised
9 → 12 to widen the ceiling for good players.

### Why the vent recharges faster at high multiplier

Originally a flat 5.5 s cooldown. That made the slag/vent interaction a hard gate
that dominated outcomes regardless of skill — sloppy and expert players alike just
waited on the cooldown. Now `ventCooldown(m) = max(2.6, 6.4 − (m−1)·0.45)`:
playing well buys you room to breathe. This is the best decision in the project —
it fuses two previously independent systems (scoring and the escape valve) into
one feedback loop, so a strong run compounds and a weak run tightens.

Venting a non-slag orb halves the multiplier, so the escape valve stays a real
cost rather than a universal "undo".

### Why chains pay so much

`chainStep` was raised 120 → 220. Chains are the only mechanic that rewards
*planning several moves ahead* rather than reacting to the front of the rail.
Making them the dominant score source is what lifted the expert profile above the
novice one.

### Progression that is not just "faster"

The brief explicitly warns against speed-only difficulty. Nine authored waves each
introduce a *situation*, not just a rate: hues 3→4→5, bigger orders, slag (dead
weight only the vent removes), priority orders on a timer paying 3× (and jamming
the bay plus resetting the multiplier if they expire), then combinations. Endless
scaling continues past wave 9 so a strong run is never artificially capped.

### Accessibility: colour is never the only signal

Every hue carries a distinct glyph (● ▲ ■ ◆ ✦) stamped on both the orb and the bay
that wants it. Slag is ✕, prism is ✳. A colour-blind player reads the game by
shape.

### Architecture: pure model, event stream, dumb views

`src/game/model.ts` (326 lines) holds every rule and imports nothing from PixiJS.
It returns an event list; `src/scenes/game-scene.ts` turns those events into
visuals and sound. Two payoffs, both realised during the run:

1. The headless sim exists *because* the model is pure — it imports the real
   rules, not a copy, so its balance numbers are trustworthy.
2. Every balance change touched `config.ts` and `model.ts` only; no view code
   moved.

All tuning lives in `config.ts`. Nothing is over-abstracted: no entity system, no
scene-graph framework, no state-management library. The project is small and the
architecture is sized to it, per the brief.

### No assets, by construction

Every texture is generated at runtime from Pixi primitives and canvas gradients;
every sound is synthesised with WebAudio, including a generative backing pulse
whose intensity tracks depot pressure. The audio context is created lazily on
first interaction, so autoplay restrictions cannot break the game.

---

## 3. Token usage

Measured from the session transcripts in
`~/.claude/projects/C--Users-JB-Desktop-Development-pixelflowtest-claude/`.

### Build session (`b3bc347d`) — the entire game

| Metric | Value |
| --- | ---: |
| API calls | 169 |
| Output tokens | 277,585 |
| Cache-write input tokens | 461,929 |
| Cache-read input tokens | 28,380,042 |
| Uncached input tokens | 338 |
| Tool calls | 96 |

Tool breakdown: `Bash` 43, `Write` 18, browser automation 32 (`browser_batch` 26,
`preview_start` 2, plus console / JS / tab calls), `preview_stop` 1.

Notes on the shape of that usage:

- **Cache reads are ~98% of all input.** 169 sequential calls over a growing
  context is inherently cache-heavy; the cost driver is the number of turns, not
  the size of any one of them.
- **Bash heredocs and in-place `python` edits were used instead of the edit
  tools** for most changes. That is cheaper per edit than re-reading a file to
  produce an exact string match — but it is also why a `MISS` guard was needed:
  a blind `str.replace` fails silently.
- **The 18 `Write` calls are the expensive ones**, accounting for the bulk of the
  277k output tokens since each emits a complete source file.

### Follow-up sessions

| Session | API calls | Output | Cache read |
| --- | ---: | ---: | ---: |
| `b5c8fa18` (browser re-check) | 7 | 888 | 338,400 |
| `e0559b75` (this postmortem) | 10+ | 3,900+ | 521,800+ |

The postmortem session's figures are partial: they were read from its own
transcript while that session was still running, so they exclude the writing of
this document.

---

## 4. Time spent

| Phase | Window (UTC) | Duration |
| --- | --- | ---: |
| Read brief, verify toolchain | 17:56:33 – 17:58:43 | ~2 min |
| Scaffold + core systems + views | 17:58:43 – 18:13:00 | ~14 min |
| First typecheck, dev server, first play | 18:13:00 – 18:17:39 | ~5 min |
| Balance harness + rebalance | 18:17:39 – 18:22:30 | ~5 min |
| Browser playtesting + fixes | 18:22:30 – 18:28:00 | ~5 min |
| Dead-code sweep, build, README | 18:28:00 – 18:29:53 | ~2 min |
| **Build session total** | **17:56:33 – 18:29:53** | **33 min 20 s** |
| Follow-up browser verification | 18:31:59 – 18:32:25 | ~25 s |

Roughly 3,750 lines of TypeScript, a playable and balanced game, and a balance
tool, in a little over half an hour of wall clock.

---

## 5. What went well, what would be done differently

**Went well**

- Naming and framing the game before writing code — the theme never drifted.
- Writing `config.ts` first. Every later balance change was a one-file edit.
- Building the headless sim. It caught the one defect manual playtesting would
  almost certainly have missed: that skill didn't affect the outcome. Five minutes
  of tool-building bought the game its entire depth axis.
- Playing the game rather than only reading it. Every UX bug in Phase 5 —
  unclickable orbs, unreadable panel, callout under the cursor, the vent
  mis-teaching the player — was invisible in the source.

**Would do differently**

- The blind `python str.replace` edit pattern is fast but silent on failure. The
  `MISS` guard was added late; it belonged in the first edit helper.
- The backdrop needed two rendering fixes immediately after first render.
  Rendering-heavy code deserves a visual check as soon as it is written, not after
  the whole view layer is done.
- Dead code (`orbAt`, `capacity`, `slotCenter`, `slotRadius`) accumulated because
  views were written speculatively against a model API that then changed. Writing
  each view's consumer first would have avoided the sweep.

**Deliberately not done**

- No unit test suite. For a 3,750-line arcade game with a pure rules core, the sim
  harness covers the layer that would benefit most, and it validates balance as
  well as correctness.
- No mobile or touch support. The brief targets 1280×720 desktop with mouse input.
- No persistence beyond best score, mute, and run count in `localStorage`.
