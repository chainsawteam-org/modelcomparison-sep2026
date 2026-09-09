# Chroma Dispatch postmortem

Written on 8 September 2026. This report covers the original game implementation in this workspace, completed in **18 minutes 39.131 seconds** using **2,081,323 recorded tokens** across model requests. The token total includes cached input; the breakdown below explains how to interpret it. The later work of preparing this document is excluded from those figures.

The result was a self-contained desktop arcade puzzle built with TypeScript, PixiJS, and Vite: four cargo docks, a twelve-cell incoming buffer, thirty orders across five stages, batch bonuses, score chains, emergency recovery, synthesized audio, and restart, help, pause, and end screens.

This is a retrospective reconstructed from the build task, its timestamped session record, and the delivered source. The design rationale describes the purpose and tradeoffs of the implemented choices. It does not claim that every rationale was explicitly recorded during development.

**Process followed**

1. **Read the brief and inspect the environment.** The initial workspace contained `design.md`. The brief required an original flow-management puzzle, a small dependency set, mouse-first controls, a 1280×720 desktop presentation, and a complete playable experience. Node.js 24.13.0 and npm 11.6.2 were available. The referenced `RTK.md` was missing from the paths inspected during the build, so no additional instructions were obtained from it.
2. **Choose one core interaction and a supporting theme.** The game became a neon freight terminal: select every queued cell of a color, then send a batch to a matching dock. The plan established five stages, upcoming-order previews, layered cargo, synthesized sound, and a short restart flow. PixiJS documentation was consulted before implementation.
3. **Build the simulation and project foundation.** The first implementation added the game state, order and supply generation, scoring, overflow, recovery, audio, Vite configuration, and local assets. Dependency installation ran during implementation. The simulation was kept separate from rendering so it could be exercised without a browser.
4. **Create the playable presentation.** The next pass added the PixiJS board, reusable drawing helpers, mouse and keyboard input, delivery effects, pressure and combo meters, tutorial guidance, and modal screens. Browser storage was optional, and audio was initialized through player interaction.
5. **Validate rules and play the game in the browser.** Eight automated tests covered the main state transitions and included forty complete seeded simulations. Browser checks exercised selection, delivery, keyboard controls, pause, overflow, restart, help, and resizing. The first build exposed a missing type declaration for CSS imports; adding `src/vite-env.d.ts` resolved it.
6. **Iterate on defects and readability.** Browser inspection caught docks changing color before incoming delivery animations arrived. The fix preserved the delivered layer for the routing animation. Further changes improved the first-action button, separated the overflow countdown from the buffer count, prevented competing status messages, and increased small-label contrast.
7. **Verify installation and finish the handoff.** An initial clean-install check failed because the running Vite process held a Windows native-module file open. Stopping that process allowed `npm ci` to succeed. Package-lock metadata was refreshed, the final build and tests passed, and the game received a final browser and console check. The README remained focused on running and playing the game.

**Game design decisions**

| Decision | Purpose and tradeoff |
| --- | --- |
| Freight-terminal theme with four fixed docks | Gives matching targets, arrivals, and limited storage a coherent meaning. Fixed destinations keep the screen readable and reduce the instruction burden. |
| Select a color, then dispatch a batch | Makes a useful move take two clicks. The player decides when to send and which matching order to prioritize. Individual placement was outside the chosen scope. |
| Dispatch only what an order still needs | Prevents accidental waste. Excess cells remain in the buffer and stay selected, making subsequent dispatches predictable. |
| Twelve-cell capacity with five seconds of grace when full | Keeps pressure visible while allowing a last recovery action. Losing follows a sustained full buffer, giving warnings time to be useful. |
| No timed arrivals until the first successful delivery | Lets the player learn the interaction safely. The opening six cells include three mint cells that exactly fill the first dock, demonstrating the batch bonus immediately. |
| Full-batch bonuses and an eleven-second chain window | Creates tension between waiting for a profitable batch and clearing space or preserving a chain. The multiplier increases every three completed orders and caps at ×5. |
| Upcoming-order previews and sequential two-color orders | Adds planning and sequencing to later stages. Difficulty changes through order size and structure as well as arrival speed. |
| Supply weighted toward current demand | Reduces the risk of unusable random arrivals dominating a run. After the first stage, every fourth generated arrival anticipates a randomly chosen next order, rewarding use of the previews. This is a fairness heuristic, not a proof that every possible situation is recoverable. |
| Emergency flush removes up to four cells | Provides a recovery option. It breaks the chain and requires twenty-four delivered cells to recharge, so repeatedly discarding cargo cannot replace playing the main loop. |
| Thirty completed orders across five stages | Supplies a clear objective, a finish line, and replay value through scoring. Every six completions advances the stage; arrival intervals decrease from 2.45 to 1.30 seconds. |

The intended strategic choice is whether to hold useful colors for a complete batch or future order, or send a partial batch now to reduce pressure. Layered orders make that choice more consequential because a later requirement remains inaccessible until the current layer is filled. Larger and layered orders enter through generated previews, so a stage transition does not immediately replace all existing cargo.

The forty simulated winning runs lasted **172–216 seconds**, approximately **2:52–3:36** of simulation time. That supports a short session, although the fastest run falls slightly below the brief's approximate three-minute lower bound. The README's three-to-six-minute description is a player-facing estimate; a human playtime distribution was not measured.

**Presentation and technical decisions**

The visual identity uses a dark terminal surface, restrained mint, coral, iris, and gold accents, clear counters, and distinct geometric symbols for each color. Pairing shape with color improves recognition. Matching docks highlight when a batch is selected, and fill previews show the expected transfer before the player commits.

Delivery arcs, staggered cell flights, particles, floating scores, and synthesized tones explain successful actions. Stronger feedback accompanies complete batches and completed orders. The routing fix was particularly important: the destination must continue to look like the target the player chose while the cells travel toward it.

All displayed art is built locally from drawing primitives and a generated background texture. Web Audio oscillators provide sound without external files. This kept the visual and audio treatment consistent while satisfying the requirement for no external service or supplied assets.

| Component | Responsibility and rationale |
| --- | --- |
| `src/model.ts` | Pure simulation with explicit modes, a supplied random-number function, and emitted game events. This supports reproducible tests and keeps gameplay rules independent of PixiJS. |
| `src/main.ts` | Application setup, input, screen composition, event handling, browser storage, and the frame loop. A direct coordinator is sufficient for this small game, though it is the largest module and the first candidate for splitting if the UI grows. |
| `src/visuals.ts` | Palette, symbols, drawing helpers, buttons, and transient effects. Shared helpers keep repeated controls and cargo cards visually consistent. |
| `src/audio.ts` | Sound generation, mute preference, and audio unlocking. Failed or unavailable audio leaves the game playable. |
| `tests/model.test.ts` | Node's built-in test runner and seeded simulation. This avoids adding a separate test framework while allowing fast checks of complete runs. |

The UI rebuilds when a dirty flag or model revision changes; continuously animated meters and effects update separately. This is simple enough for four docks and twelve cells, but still recreates interface objects on state changes. It was not performance-profiled under a larger workload.

The canvas keeps a 1280×720 logical layout and scales proportionally to the window. This preserves the composition and pointer geometry, with the tradeoff that labels shrink in smaller windows. Browser checks included a 960×640 viewport and mouse targeting after resizing. Device-pixel resolution is capped at two to limit rendering cost.

The frame delta is capped at 100 milliseconds, and hiding the browser tab pauses the simulation. These choices prevent a return from a suspended tab from consuming the overflow grace period in one update. Heavy sustained frame stalls can make simulation time advance more slowly than wall-clock time. Local-storage failures are caught, so persistence is optional.

**Problems encountered and lessons**

| Observed issue | Resolution | Lesson |
| --- | --- | --- |
| TypeScript rejected the side-effect CSS import with TS2882. | Added the Vite client type reference in `src/vite-env.d.ts`. | Include the framework's environment declarations in the initial scaffold and compile early. |
| A dock displayed its next color before the delivery animation reached it. | Saved the delivered layer as `dock.previous` and displayed it while the dock was busy. | Rendering must preserve the visual continuity of a completed action even when simulation state advances immediately. |
| The opening button did not guide the selected batch through its first delivery. | Changed the prompt and action to dispatch to a matching dock when a color is selected. | Onboarding controls should follow the player's current state. |
| Countdown placement, overlapping status text, and faint small labels reduced clarity. | Moved and clamped the countdown, suppressed it outside play, gated the no-match hint behind the toast, and brightened faint text. | Inspect the actual screen at different states and sizes; rule tests cannot catch layout problems. |
| `npm ci` failed with Windows `EPERM` on the Rolldown native binding while Vite was running. | Stopped the workspace's Vite process and repeated the clean install successfully. | Stop processes using native dependencies before replacing `node_modules`. |
| The lockfile still contained the initial npm project name. | Refreshed it with `npm install --package-lock-only` after finalizing package metadata. | Recheck scaffold metadata after initialization and overlapping setup work. |

One failed validation command combined `npm ci; npm run build; npm test`. The install failed, the build then lacked `tsc`, and the tests still passed, leaving the command with a zero exit code. The failures were visible in the output and were subsequently resolved. Future validation should run dependent checks separately or stop immediately on a nonzero exit code; the last command's status alone is insufficient evidence.

**Validation evidence and limits**

The original task recorded a successful clean installation, final TypeScript check and Vite production build, and **eight passing tests with zero failures**. The tests cover initial teaching behavior, capped dispatch and busy docks, layered orders, overflow and rescue, paused timers, flush consumption and immediate reuse rejection, chain expiry and fresh state, and forty seeded complete wins with capacity and charge assertions.

Browser checks recorded selection and dispatch, keyboard input, pause, natural overflow, restart, help, smaller-window layout, and pointer accuracy. The final handoff reported no console errors. These are historical validation results from the build task; this documentation pass inspected the source and records without repeating a browser playthrough or rebuilding the game.

The strongest evidence is for rule correctness and basic interaction. Forty wins by one automated strategy do not establish universal solvability, beginner difficulty, or long-term enjoyment. A full human-played win was not explicitly documented, and the successful simulations do not validate the appearance of the victory screen. There was also no documented cross-browser matrix, performance benchmark, extended session soak test, or full screen-reader audit. The canvas has keyboard shortcuts and an accessible label, but its individual controls do not form a complete semantic interface.

The highest-value follow-up would be a few observed first-time play sessions, followed by targeted balance changes and a repeatable browser check of both end screens. Additional mechanics should depend on that feedback.

**Time spent**

The original task's completion event records `duration_ms: 1119131`: **1,119.131 seconds**, or **18 minutes 39.131 seconds**. Its start and completion fields are 8 September 2026 at **17:55:39–18:14:18 UTC**, equivalent to **19:55:39–20:14:18 in Europe/Madrid (UTC+02:00)**. The event's millisecond duration is more precise than those integer-second timestamps.

The following approximate phase boundaries use timestamped progress messages, rounded to the nearest second. They describe elapsed intervals, not separately measured active work.

| Local time | Approximate interval | Milestone |
| --- | ---: | --- |
| 19:55:39–19:56:45 | 1m 06s | Inspect brief and environment; announce the game concept. |
| 19:56:45–20:05:59 | 9m 14s | Consult PixiJS documentation, install dependencies, and implement simulation and presentation. |
| 20:05:59–20:09:15 | 3m 16s | Fix the first build issue; add tests and perform initial browser checks. |
| 20:09:15–20:13:37 | 4m 22s | Correct routing visuals, improve UX, check remaining screens and resizing, and recover the clean install. |
| 20:13:37–20:14:18 | 0m 41s | Complete final validation and handoff. |

Wall-clock time includes model generation, tool execution, dependency downloads, and waits. Some commands overlapped other work. For example, the initial npm setup command recorded 164.769 seconds and the successful stop-and-clean-install command recorded 101.754 seconds. These durations are already inside the overall run; adding tool durations to the task duration would double-count time. A separate total for active coding or model-compute time is unavailable.

**Token usage**

The session identifies the model as **`gpt-6-astra`**, with **`medium`** reasoning effort. The final `token_count` event, timestamped **2026-09-08T18:14:18.407Z**, reports:

| Counter | Tokens | Interpretation |
| --- | ---: | --- |
| `input_tokens` | 2,055,590 | Cumulative input across requests, including cached input. |
| `cached_input_tokens` | 1,985,024 | Cached portion of the input total, approximately 96.57%. |
| Uncached input, calculated | 70,566 | Input minus cached input. |
| `cache_write_input_tokens` | 0 | Recorded cache-write counter. |
| `output_tokens` | 25,733 | Cumulative generated output. |
| `reasoning_output_tokens` | 5,220 | Reported reasoning portion of output; do not add it again. |
| `total_tokens` | **2,081,323** | Input plus output. |

Arithmetic check: `2,055,590 + 25,733 = 2,081,323`; `2,055,590 - 1,985,024 = 70,566`.

These are request-accounting totals, not the number of unique words read or tokens of source code written. Repeated conversation context is counted again on later requests, and much of it was served from cache. The final cumulative counter is used once; summing the session's cumulative snapshots would overcount. Uncached input plus output totals **96,299 tokens**, but that derived number is not the reported total and should not be presented as one. No monetary cost is inferred from these counters.

**Source trail**

The build task was **Build 2D arcade puzzle game**, task ID `01a08229-4510-7d53-bfab-7f9373be1708`, with turn ID `01a08229-4baa-7cf3-8af2-dafec658071f`. The authoritative local session record used for timing, model settings, and token counters is:

```text
C:\Users\JB\.codex\sessions\2026\09\08\rollout-2026-09-08T19-55-38-01a08229-4510-7d53-bfab-7f9373be1708.jsonl
```

Implementation claims were cross-checked against `design.md`, `README.md`, `package.json`, `src/model.ts`, `src/main.ts`, `src/visuals.ts`, `src/audio.ts`, and `tests/model.test.ts`. The local session record is outside the repository, so the relevant measurements and their accounting definitions are preserved here for readers without access to it.
