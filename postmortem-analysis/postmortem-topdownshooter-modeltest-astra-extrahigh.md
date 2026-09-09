# LAST SIGNAL — Development postmortem

Prepared on 9 September 2026. Covers the original **Build polished playable game** task (`01a08276-5946-7402-b523-a7ea9fc1e2d2`), which ran on 8 September 2026 using **gpt-6-astra with xhigh reasoning effort**.

## Outcome

The development pass produced LAST SIGNAL, a local, browser-based 3D arena shooter using the required TypeScript, Three.js, and Vite stack. The implementation includes a procedural environment, two weapons, dash and Discharge abilities, four ordinary enemy archetypes, six encounters followed by a boss, eleven possible augmentations, scoring, generated audio, settings, and the surrounding menu and restart flows.

Recorded development time was **26 minutes 19.211 seconds**, with **1,160,123 total tokens** processed, including cached input. The task ended with `usage_limit_exceeded`, without a final handoff. This was an interruption, not a recorded decision that further polish had little value.

The code compiled and six unit tests passed during development. A browser inspection reached the title screen, gameplay HUD, and defeat screen. The automated browser suite failed before launching Chromium, so the original record does **not** establish a completed playthrough, working restart and victory paths, acceptable sustained performance, or the requested level of game feel. The result is a substantial implementation with an unfinished validation pass.

## Evidence and scope

This account uses `design.md`, the current source and tests, and the original task's commands, patches, public progress messages, and usage telemetry. The local record is:

```text
%USERPROFILE%\.codex\sessions\2026\09\08\rollout-2026-09-08T21-19-49-01a08276-5946-7402-b523-a7ea9fc1e2d2.jsonl
```

The design rationale below describes the announced direction and the tradeoffs supported by the implementation. Intended benefits such as satisfying combat or fair difficulty are not presented as measured player outcomes. The project's parent Git history belongs to other work, so it was not used to reconstruct this development pass.

The original task's time and token figures exclude preparing this document and the verification rerun on 9 September. No gameplay code was changed for this postmortem.

## Process followed

The workspace initially contained only `design.md`. The agent read the benchmark, checked the environment and ancestor instructions, and searched for the referenced `RTK.md`; that file was not found. It chose the name and overall combat loop before adding the implementation in several large patches. No subagent work appears in the original record.

All times below are **UTC on 8 September 2026**; Madrid local time was two hours later. Phase durations are approximate wall-clock intervals between logged milestones, not separate measurements of coding, reasoning, or tool execution.

| Phase | Time interval | Approx. time | Recorded work |
| --- | --- | ---: | --- |
| Requirements, concept, and foundations | 19:19:51–19:23:25 | 3m 34s | Read the brief; announce the relay setting and combat loop; add npm/TypeScript setup, HTML, collision/navigation utilities, input, and procedural audio. |
| Arena and rendering | 19:23:25–19:27:39 | 4m 14s | Install dependencies; create models, suspended deck, cover, relay, floor artwork, camera, lighting, particles, and static geometry batching. |
| Actors, progression, interface, and AI | 19:27:39–19:37:34 | 9m 55s | Add player/enemy/projectile data, upgrade definitions, menus and HUD, and enemy attack state machines. |
| Game integration | 19:37:34–19:42:43 | 5m 09s | Connect combat, resources, waves, hazards, scoring, save/settings behavior, and application startup; write the README. |
| Compilation, inspection, fixes, and tests | 19:42:43–19:46:10 | 3m 27s | Fix a TypeScript error, build successfully, open the game, run six unit tests, add browser fixtures, and make cleanup fixes. Browser automation then fails at launch; the usage limit ends the task. |

The first build failed because `enemy-ai.ts` imported `THREE` without using it. Removing that import restored compilation. The same patch corrected the timer's minute-boundary formatting and removed an unnecessary CSS import.

Vite started on port 5176 because ports 5173–5175 were occupied. The agent inspected the title screen, clicked **Deploy Operator**, and observed the first-encounter HUD. A later inspection showed defeat in encounter one, with zero eliminations and 13 seconds of displayed game time. That demonstrates an operational start and defeat presentation; it does not demonstrate active combat mastery or balanced onboarding.

After the successful build, the agent added a separate Three.js vendor chunk and unit tests. The last patch corrected disposal of hazard child meshes, stopped projectile processing after lethal player damage, and compared a finished score against the saved best for the run's assist category. Those changes were followed by an attempted browser test, but no successful end-to-end result was recorded.

## Design decisions and their logic

### A finite mission in one authored arena

Six 45-second encounters followed by the Warden give the run a clear destination. Clearing surviving enemies and choosing augmentations create pauses between pressure peaks. The README's roughly 6–9 minute run length is a design estimate; a full timed run was not recorded.

One arena concentrates effort on readable cover, combat combinations, and presentation. The central relay and four cooling units interrupt movement and shooting lanes; explosive canisters create opportunities to clear nearby enemies. The relay is the narrative objective and a physical obstacle, rather than a separately damageable escort target. The actual failure condition is losing the operator's integrity.

### Two weapon roles and a resource loop

The Needle rifle provides rapid, relatively precise sustained fire with a 28-round magazine. The Breaker fires seven short-lived pellets from a six-shell magazine, making close groups its intended strength. Reloads create timing decisions while unlimited reserve ammunition prevents a run from becoming unwinnable through exhausted supplies.

The two-charge dash supplies an escape with brief invulnerability. Discharge consumes collected energy to damage and stun nearby enemies and clear hostile projectiles. Fragments dropped by enemies encourage moving toward cleared combat space to recharge that ability. This connects shooting, movement, collection, and survival instead of treating pickups as a separate activity.

### Enemy combinations create pressure

The four ordinary archetypes have different behaviors: crawlers pursue, gunners maintain distance and fire telegraphed spreads, chargers commit to a warned rush and recovery period, and swarms move quickly with lateral variation. Later waves mix these roles and add timed ground hazards. The Warden combines volleys, radial projectiles, hazards, and summons, with a faster phase below 45% health.

Attack warnings, spawn delays, gates chosen away from the player, and recovery windows are intended to make damage avoidable. They are sensible fairness mechanisms, but their timing still needs active playtesting. Difficulty also includes modest health scaling; it is not based exclusively on new behaviors.

### Augmentations support different play styles

Between encounters, three unowned options are offered from a pool of eleven. Piercing, ricochets, death explosions, slowing shots, offensive dashes, a drone, and a modified Discharge change positioning or attack behavior. Fire-rate, recovery, and mobility bonuses provide simpler alternatives. Six selections allow a run to develop a recognizable build without requiring a larger progression system.

The elimination streak multiplier rewards sustained engagement, while damage resets it. Separate saved best scores for assist mode preserve a meaningful comparison when incoming damage is reduced by 35%.

### Procedural presentation keeps the project self-contained

The suspended communications deck, foggy city, angular models, generated floor texture, and lime/coral combat colors provide a consistent visual identity without external art. An elevated orthographic camera maintains stable apparent object size and a broad view of the arena, with limited follow movement and shake.

Muzzle flashes, recoil, hit feedback, knockback, brief hit-stop, destruction particles, and synthesized sound layer feedback onto combat. Web Audio starts after user interaction and tolerates audio failure. Quality, motion, ambient audio, and volume controls let players reduce expensive or distracting effects. These features establish a presentation approach; the original record does not prove their combined feel was tuned successfully.

### Lightweight architecture with explicit technical safeguards

The code separates rendering (`world.ts`, `models.ts`), input, audio, effects, entity data, AI, progression, UI, and orchestration (`game.ts`). Three.js is the only runtime package dependency; Playwright is development tooling. This matches a small, local game without introducing a larger engine or backend.

Collision runs on the horizontal plane even though rendering is 3D. Swept segment/circle checks reduce missed fast-projectile hits, and movement substeps limit dashes passing through cover. A shared 41×31 navigation field, refreshed every 0.3 seconds, routes pursuers around obstacles without independent path searches for every enemy. These choices fit the flat, fixed arena; they would need reassessment for complex elevation or changing terrain.

Performance safeguards include merged static geometry, reused projectile meshes, instanced particles, a pixel-ratio cap, and limits of 36 enemies, 420 projectiles, and 900 particles. The HUD updates at 20 Hz. These bound selected costs, but they are not a substitute for measured frame times. The frame loop clamps elapsed time to 33 ms rather than running a fixed-step accumulator, so sustained low frame rates can slow simulated game time.

The main maintainability compromise is density: many methods and nearly all CSS are compressed onto long lines, and `game.ts` still coordinates many responsibilities. The module split is useful, but formatting and narrower combat/wave responsibilities would make subsequent tuning easier.

## Verification and remaining uncertainty

| Check | Original development record | Postmortem check, 9 September |
| --- | --- | --- |
| TypeScript and production build | First attempt failed on an unused import; second passed before the final patches. | `npm run build` passes on the current files, including those patches. |
| Core tests | Six passed; reported test-runner duration 282.6112 ms. | Six passed; reported test-runner duration 391.8363 ms. |
| Browser inspection | Title, first-encounter HUD, and defeat screen observed. | Original evidence reviewed; no new gameplay session performed. |
| Automated browser suite | Failed before browser launch: Playwright expected Chromium headless shell revision 1243, while revision 1234 was installed. | Not rerun; no original `browser-results.json` or screenshots exist in `.test-artifacts`. |
| Full mission, victory, restart, sustained performance | No completed validation recorded. | Remain unverified. |

The six core tests cover swept hits, dash/arena boundaries, diagonal movement and obstacle clearance, navigation across 48 combinations of radius/start/target, cover occlusion, and unique upgrade availability through six selections. They test important failure modes, but do not exercise all enemy behaviors or a complete run.

`tests/browser.mjs` contains checks for movement, weapon switching, firing, reload, dash, pause, a short automated combat opening, Discharge, death, restart, upgrades, and victory. Several edge cases manipulate the development-only game instance directly. Even a future pass would demonstrate those transitions, not prove a naturally played seven-encounter run is balanced. The script requires a Vite development server because `window.__LAST_SIGNAL__` is omitted from production builds.

The current build produces a 92.94 kB game JavaScript chunk and a 523.12 kB Three.js chunk, before gzip. Vite still warns about a chunk exceeding 500 kB. Separating the vendor chunk improved organization but did not eliminate that warning or establish load-time performance.

## Token usage and time spent

These are recorded figures, not estimates from source size or account usage percentages.

| Metric | Recorded value |
| --- | ---: |
| Model | gpt-6-astra |
| Reasoning effort | xhigh |
| Original development turns | 1 |
| Model responses with usage records | 17 |
| Input tokens, including cached input | 1,111,770 |
| Cached input tokens, included above | 1,019,776 |
| Uncached input tokens, by subtraction | 91,994 |
| Output tokens | 48,353 |
| Reasoning output tokens, included in output | 3,531 |
| Cache-write input tokens | 0 |
| **Total input + output tokens** | **1,160,123** |
| Cached share of input | 91.73% |
| Start | 2026-09-08 19:19:51 UTC / 21:19:51 Madrid |
| End | 2026-09-08 19:46:10 UTC / 21:46:10 Madrid |
| **Recorded turn duration** | **1,579,211 ms / 26m 19.211s** |

The sum of the 17 `token_usage_record.payload.usage` objects matches both the final `turn_token_usage` and the last `token_count` cumulative total. The cumulative snapshots must not be summed again. Cached input and reasoning output are subsets of their parent categories, so adding them separately would double-count usage.

The large input total reflects context processed repeatedly across model responses; it is not a count of unique prompt text or generated source code. These records do not establish a monetary cost, which is therefore not estimated here.

Time comes from the terminal `task_complete.payload.duration_ms` field. It includes work within the turn, including tool waits; there is no reliable separate total for active model computation or manual effort. The log also contains a development-server shutdown at 21:26:42 UTC, well after the turn ended. That lingering process does not extend development time. The rounded timestamps and milestone intervals have slightly different precision from the recorded duration.

## Lessons and follow-up priorities

The pass established a coherent theme, a bounded mission, complementary combat systems, and focused collision/navigation tests. Procedural assets and generated audio kept the deliverable self-contained. Compilation also caught a real integration issue before browser inspection.

The clearest process weakness was how late integration and validation happened. The first complete build was attempted about 23 minutes into a 26-minute turn. Large implementation patches delivered breadth quickly, but left little room to discover and tune interaction problems before the usage limit interrupted the work.

For a subsequent pass:

1. **Make browser testing runnable first.** Install the Chromium revision required by the locked Playwright dependency, use the actual Vite port through `GAME_URL`, and run the existing suite. Treat a browser-launch failure separately from an application test failure.
2. **Validate an early playable slice before adding all content.** Movement, one weapon, one enemy, cover, damage, and restart should be exercised together before expanding the upgrade pool and interface.
3. **Play complete runs and preserve evidence.** Check normal and assist modes, death/restart and victory/restart, late-wave navigation, boss readability, and actual run duration. Capture console errors and screenshots alongside results.
4. **Measure performance and tune feel.** Record frame times and resource counts under heavy combat and across repeated runs; assess low quality, frame-rate dependence, weapon impact, warning times, and early survival through direct play.
5. **Improve reviewability and reserve validation capacity.** Format the source, separate the busiest orchestration responsibilities where useful, and allocate remaining time and tokens to validation before adding more features. A usage-limit interruption should leave an explicit status record of what passed and what remains unverified.
