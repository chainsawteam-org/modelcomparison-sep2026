# EMBER / Relay Zero — Development postmortem

Written on 8 September 2026. This report reconstructs the original game-building task from its recorded conversation, execution results, token telemetry, and the resulting source files. Design rationale below combines the stated plan with interpretation of the implementation; it is not a verbatim record of private reasoning.

## Outcome and scope

The project became a self-contained browser arena shooter using the required TypeScript, Three.js, and Vite stack. It contains five escalating survival encounters followed by the Warden boss, two weapons, a dash, an energy discharge, seven possible permanent upgrades, scoring, procedural graphics and audio, and complete menu, pause, defeat, victory, and restart flows.

The README describes a 5–8 minute successful run. This is a design estimate, not a measured player average: five 55-second encounter timers account for 4 minutes 35 seconds before clearing survivors, choosing upgrades, and fighting the boss.

## Process followed

1. **Read the brief and inspect the workspace.** The agent read `design.md`, checked available files, and attempted to locate the referenced `RTK.md`. That file was unavailable in the locations checked. The build proceeded from the supplied design requirements.
2. **Define a bounded game.** The initial plan named the game, chose an industrial arena, and established the rifle/scattergun, dash, energy, cover, upgrades, and six-encounter structure. This gave implementation a concrete end condition and kept content scope manageable.
3. **Implement the complete loop.** Rendering, procedural actors, input, collision, combat, progression, UI, and synthesized sound were implemented. The first production build passed before browser verification began.
4. **Exercise game flows in the browser.** Playwright checked movement, combat input, pause, damage, upgrade transitions, death, boss spawning, victory, and restarts. Screenshots supported visual inspection. Initial flow checks exposed resource 404 errors; subsequent results reported an empty console-error list.
5. **Correct combat behavior.** The agent separated charger attack duration from its cooldown, added a visible charge warning, and moved the mouse-aim intersection plane to projectile height. Encounter timers increased from 48 to 55 seconds. Cleanup was added for removed geometry and transient materials.
6. **Test navigation and sustained combat.** A targeted test showed that local obstacle steering could leave enemies trapped behind machinery. The agent replaced it with obstacle-aware waypoint routing, reran the failing scenario, and exercised a later encounter with automated movement and aiming.
7. **Package and verify.** UI functions moved into a separate module, files were formatted, Three.js received its own build chunk, and a test runner was added to manage a local Vite server. The agent wrote the README, removed temporary scripts and screenshots, reran the build and browser tests, and opened the local game.

## Design decisions and their logic

| Decision | Purpose and tradeoff |
| --- | --- |
| One industrial arena with four cover blocks | Makes positioning and line of fire meaningful while limiting level-production work. The obstacles also created a navigation problem that required explicit routing. |
| Elevated orthographic camera | Preserves consistent scale and a broad view of threats. Mouse coordinates are raycast onto the shot-height plane so rendered targets and aiming agree. |
| Rifle and scattergun with reloads | Provides sustained precision versus close-range spread without a large weapon inventory. Reload windows introduce timing decisions; automatic reload reduces input burden. |
| Invulnerable dash and energy discharge | Supplies immediate escape and a resource-based emergency attack. Energy pickups encourage movement toward defeated enemies, while discharge rewards saving or spending charge at the right moment. |
| Pursuers, ranged sentries, chargers, and a boss | Creates pressure through different behaviors: pursuit, distance management, telegraphed bursts, and combined projectile patterns. Orbital hazards later discourage staying behind cover indefinitely. |
| Survival timer followed by clearing survivors | Creates a predictable pacing floor and a clear transition into upgrades. Five choices give a run a developing build before its final encounter. |
| Behavioral upgrades alongside stat upgrades | Piercing, death explosions, offensive dashes, and collection improvements can change positioning and ability use. Simpler fire-rate, mobility, and armor choices remain easy to understand. |
| Combo scoring and local personal best | Rewards fast, clean play and supplies replay motivation without a backend or account. |
| Procedural geometry and Web Audio | Produces a coherent, locally available presentation without an asset pipeline or remote dependencies. Audio unlocks through interaction to accommodate browser restrictions. |
| Small responsibility-based modules | `world.ts` owns scene construction and camera work, `audio.ts` sound, `ui.ts` screens and HUD, and `game.ts` simulation. This kept iteration direct, although `game.ts` remains the dominant module and UI functions are tightly coupled to it. |
| Practical rendering limits | Pixel ratio is capped at 1.75, particles are bounded, removed resources are disposed, and projectile movement uses collision substeps. These are safeguards, not proof of a particular frame-rate target. |

## Verification results and lessons

The final recorded `npm run build` passed TypeScript checking and Vite bundling. Vite reported 1.96 seconds for bundling; this is not the duration of the whole build command. The output split into approximately 27.22 kB of game JavaScript and 484.76 kB of Three.js JavaScript, before gzip. Separating the library removed the earlier single-chunk size warning; it did not eliminate the library download.

The final `npm test` results included:

- Flow checks passed, with no collected console errors.
- Targeted aiming test killed its one intended enemy.
- Charger movement covered approximately 5.67 units, exceeding the 4-unit test threshold.
- Navigation ended approximately 0.03 units from the player, compared with 5.94 units before the routing fix; the acceptance threshold was 2 units.
- Discharge consumed the full charge and cleared the nearby test enemy.
- The sustained-combat sample ended with 20 kills, 18 enemies, 9 bullets, and 360 renderer geometries.

The strongest lesson is that successful screen transitions did not establish correct combat. The first flow check could pass while reporting zero kills. Focused aiming and navigation assertions provided much stronger evidence and found a defect that directly affected encounter completion.

Testing also has clear limits. Several checks modify exposed game state, advance simulation directly, grant invulnerability, or force boss damage. They verify mechanics and transitions but do not demonstrate an unaided full-run victory, balanced difficulty, or player enjoyment. The sustained-combat sample is not a long-duration memory or FPS benchmark. No broad browser/hardware matrix or human playtest study is recorded. This documentation task reviewed historical results; it did not rerun the game tests.

For a further iteration, prioritize unassisted full-run playtests, navigation cases around every obstacle and enemy radius, and frame-time/resource measurements across repeated runs. Extract additional simulation modules if future features make the central game class harder to maintain.

## Time spent

The original task was **Build polished playable game**, ID `01a08262-1abc-7563-accd-57d4d7ad8ebd`, using **gpt-6-astra with medium reasoning effort**.

| Measurement | Recorded value |
| --- | --- |
| Development turn start | 8 September 2026, 20:58:00 Europe/Madrid (18:58:00 UTC) |
| Development turn completion | 8 September 2026, 21:12:01 Europe/Madrid (19:12:01 UTC) |
| Exact recorded turn duration | **840,739 ms — 14 minutes 0.739 seconds** |

Approximate phase windows, reconstructed from progress-message timestamps:

| Phase | Local time window | Approximate elapsed time |
| --- | --- | --- |
| Brief inspection and concept | 20:58:00–20:58:33 | 33 seconds |
| Main implementation and first build | 20:58:33–21:05:20 | 6 minutes 47 seconds |
| Browser flow checks and initial fixes | 21:05:20–21:07:59 | 2 minutes 39 seconds |
| Navigation fix, combat checks, cleanup, final verification | 21:07:59–21:11:45 | 3 minutes 46 seconds |
| Final cleanup and handoff | 21:11:45–21:12:01 | 16 seconds |

These are wall-clock windows, including model generation and tool execution. They are not separately measured labor or CPU time. They exclude this later postmortem-writing task.

## Token usage

The final cumulative `token_count` event in the original session was recorded at 19:12:01.488 UTC:

| Counter | Tokens |
| --- | ---: |
| Input | 873,784 |
| Cached input, included in input | 809,472 |
| Uncached input, calculated as input minus cached input | 64,312 |
| Output | 21,469 |
| Reasoning output, reported within output | 2,804 |
| **Total input + output** | **895,253** |

Approximately 92.64% of input tokens were cached. These cumulative counters include context processed repeatedly across model calls; they are not the number of unique words in the prompt or source code. Cached input and reasoning output must not be added to the total again. No monetary cost is inferred from these counters. They exclude the separate documentation task.

## Evidence sources

- Original task record: `01a08262-1abc-7563-accd-57d4d7ad8ebd`, including progress messages, command results, and turn timing.
- Local telemetry: `C:/Users/JB/.codex/sessions/2026/09/08/rollout-2026-09-08T20-57-49-01a08262-1abc-7563-accd-57d4d7ad8ebd.jsonl`.
- Project evidence: `design.md`, `README.md`, `package.json`, `vite.config.ts`, `src/`, `test-runner.mjs`, `test-game.mjs`, and `test-combat.mjs`.

The project is inside a broader Git working tree and had no project-specific tracked commit history available for this reconstruction. Unrelated parent-repository commits were excluded.
