# Lumen · Signal Flow — Postmortem

Date: 8 September 2026

Lumen was built from the supplied game benchmark into a complete desktop arcade puzzle using TypeScript, PixiJS, and Vite. The delivered game has five sectors, a ten-packet buffer, six target lanes, linked bursts, score multipliers, shields, rerouting, synthesized sound, saved scores, and complete pause, help, victory, loss, and replay flows.

The build used **24 minutes 55.606 seconds of active task time**, or approximately **27 minutes 12 seconds elapsed**, across two turns. The session log reports **3,213,108 total tokens**, including **39,987 output tokens**. Definitions and the interruption are recorded below.

This retrospective covers the original task, **Build 2D arcade puzzle game** (`01a08242-b1ca-7970-ac75-3e27466a8906`). It was reconstructed from its recorded actions and results, the benchmark, and the delivered source. Design explanations describe the purpose and tradeoffs of the implemented systems; they are not a verbatim development diary. Writing this document is a separate task and is excluded from the build metrics.

## Process followed

1. **Read the brief and inspect the environment.** The project initially contained `design.md`. The brief required an original flow-management puzzle, the exact TypeScript/PixiJS/Vite stack, mouse controls, local execution without a backend, and sessions of roughly 3–10 minutes. The referenced `RTK.md` was not found in the project or the locations searched during development. Work proceeded from the available benchmark and session instructions.

2. **Choose one central interaction.** The concept became a signal-routing board: incoming colored packets collect in a limited buffer; the player selects an adjacent color run and sends it into a matching lane. The initial concept already included six lanes, five sectors, additional colors, shields, and rerouting as a recovery option.

3. **Scaffold the project and implement the rules.** Standard npm scripts, strict TypeScript configuration, the HTML entry point, a procedural favicon, and dependencies were added. The game model was implemented separately from rendering, including queue selection, damage, progression, scoring, arrivals, overflow, and state transitions.

4. **Build the complete presentation.** PixiJS board and HUD components, selection previews, animations, effects, sound, onboarding, overlays, persistence, and keyboard shortcuts were added. By 18:38 UTC, the recorded update described the full game as implemented and ready for playtesting.

5. **Playtest and improve pacing.** Initial browser checks exercised linked launches and pause. A **Call** button and the `N` shortcut were then added so players could request the next packet immediately. This addressed idle waiting without forcing a faster arrival rate on everyone.

6. **Verify rules and full campaigns.** An initial suite of 11 tests checked core rules and lifecycle behavior. A simple simulated routing policy completed all 40 seeded campaigns, averaging 7.7 minutes of simulated gameplay without early calls. Development fixtures made sector completion, victory, and later-sector layouts reachable for browser checks through the actual controls.

7. **Check end states and presentation.** Browser testing covered victory, loss, replay, rerouting, pause, and a smaller 960×600 viewport. Fixture sessions were isolated from saved player scores, and production output was searched for fixture identifiers.

8. **Resume after an interruption and finish.** The first turn ended at an account usage limit. Following the user's continuation, the browser test tab was recreated, the opening was adjusted to guarantee a two-packet mint burst, and a regression test checked that opening across 100 seeds. The final 12-test suite and production build passed, and the game was opened for the user.

## Game design decisions

| Decision | Purpose and tradeoff |
| --- | --- |
| Select a packet, then click a matching lane | A consistent two-step mouse interaction keeps the basic action easy to learn. Choosing between lanes still changes which targets become exposed next. |
| Automatically select adjacent packets of the same color | Runs make larger launches satisfying. Removing an intervening color can merge separated groups, creating planning beyond immediate matching. |
| Consume only packets that can deal damage | Surplus packets remain selected in the buffer; invalid launches consume nothing. This reduces accidental punishment while preserving the risk of holding packets too long. |
| Ten buffer slots with a five-second overflow grace period | Space creates urgency, but reaching capacity leaves a visible opportunity to recover. A successful launch clears the overflow timer. |
| Bursts increase a multiplier up to ×5, with a 12-second timeout | Players can trade the safety of immediate single shots for the score potential of larger bursts. Clearing space and maximizing score need not favor the same move. |
| Three forecast packets and demand-aware generation | Supply is weighted by remaining target hit points, minus queued and forecast packets. Every third arrival preferentially considers exposed colors when possible. This reduces unproductive supply while leaving buried targets to manage. |
| Replace obsolete forecast colors | Clearing the final target of a color updates the forecast. Already queued packets remain, but future arrivals do not keep introducing a color with no targets. |
| Reroute the entire exposed color run | Moving that run to the back reveals a different color. It costs eight energy, with capacity for sixteen; hits and passive recharge replenish it. Same-color-only lanes cannot consume a charge for an ineffective rotation. |
| Reset the buffer and restore at least one reroute charge between sectors | Sector boundaries provide a recovery point and a clear introduction to the next mechanic. This softens the consequences of inefficient play in the previous sector. |
| Guarantee the opening mint pair | The first lane accepts the two adjacent mint packets in the starting buffer. This makes the opening demonstrate the game's signature burst reliably. |
| Provide optional early arrivals | **Call** gives confident players control over pacing. It also introduces a voluntary risk: requesting another packet occupies scarce buffer space. |

Difficulty changes along several dimensions rather than arrival speed alone. The final values in `src/config.ts` are:

| Sector | Colors | Targets per lane | Arrival interval | Shield probability for eligible targets |
| --- | ---: | ---: | ---: | ---: |
| First light | 3 | 5 | 2.90 s | 0% |
| Afterglow | 4 | 6 | 2.65 s | 0% |
| Double exposure | 4 | 6 | 2.50 s | 24% |
| Full spectrum | 5 | 7 | 2.35 s | 20% |
| Event horizon | 5 | 7 | 2.15 s | 35% |

Initially exposed targets are excluded from shield generation. Additional colors increase routing conflicts; taller stacks make exposure decisions matter for longer; shields require two hits and make packet budgeting more important. The fourth sector introduces the fifth color while slightly reducing shield probability, limiting the simultaneous increase in pressure.

## Presentation and architecture

The signal-console theme fits the mechanics: packets, lanes, forecasts, and rerouting share a coherent visual vocabulary. A dark background, restrained luminous colors, and a central board separate actionable objects from supporting information. Each color also has a distinct symbol. Hover previews state how many targets will clear, how many packets will be used, and whether packets will remain.

Procedural PixiJS shapes, text, beams, particles, floating scores, and movement provide feedback without external art production. Web Audio oscillators produce selection tones, ascending launch notes, warnings, and completion cues. Audio initializes from player interaction and is optional if the browser cannot provide it. Reduced-motion settings limit animation, and focus loss automatically pauses gameplay.

The game uses a 1280×720 logical stage that scales uniformly and centers within the viewport. This preserves layout and input geometry at other desktop sizes. It also means small windows shrink text and controls; the result is not a separately designed mobile layout.

| Area | Responsibility and rationale |
| --- | --- |
| `src/model.ts` | Rendering-independent state, rules, seeded randomness injection, and gameplay events. This made fast campaign simulation and focused rule tests possible. |
| `src/config.ts` | Palette, geometry, capacity, and sector tuning. Centralizing these values makes the progression inspectable. |
| `src/board.ts`, `src/hud.ts`, `src/draw.ts` | Board objects, status information, and reusable drawing primitives. Presentation can change without rewriting game rules. |
| `src/game.ts` | Input, timing, overlays, event handling, and coordination between the model and views. A single coordinator keeps the small project understandable, although this is the largest module. |
| `src/effects.ts`, `src/audio.ts` | Visual and audio responses to gameplay events. Effects follow rule outcomes instead of determining them. |
| `src/storage.ts` | Validated local preferences, wins, and personal bests, with fallbacks for unavailable or malformed storage. No account or server is required. |
| `src/main.ts`, `tests/fixtures.ts` | Application startup and development-only screen scenarios. Vite's development guard excludes fixture loading from production. |

The runtime dependency is PixiJS; development dependencies provide TypeScript, Vite, and the test runner. The final recorded installation resolved PixiJS 8.20.1, Vite 7.3.6, TypeScript 5.9.3, tsx 4.23.13, and `@types/node` 24.13.3. Those are observed installed versions; `package.json` specifies compatible ranges and `package-lock.json` records the resolved dependency tree.

## Validation and its limits

These results come from the original build task. The documentation task inspected the code and recorded outputs; it did not repeat browser testing or rebuild the game.

| Check | Recorded result |
| --- | --- |
| `npm install` | Completed; the audit at installation reported zero vulnerabilities. |
| Final `npm test` | 12 tests passed, zero failures. |
| Opening consistency | Two-hit, two-clear mint opening verified across 100 seeds. |
| Campaign simulation | 40/40 wins; mean simulated duration 7.7 minutes. |
| Final `npm run build` | TypeScript checking and Vite production bundling passed. Vite reported 6.58 seconds for bundling. |
| Browser interaction | Linked bursts, pause, rerouting, sector continuation, victory, loss, and restarting were exercised. |
| Resizing | The later-sector board and scaled mouse targets were checked at 960×600. |
| Console | The final browser checks reported no console errors. |
| Fixture isolation | Production output searches found no fixture identifiers; fixture mode bypasses progress reads and writes. |

Rule tests additionally cover queue merging without reordering, unused ammunition, invalid launches, shields damaged across separate launches, overflow recovery and a single loss event, reroute energy, restart state, guarded sector advancement, frozen terminal states, and forecast reconciliation.

The campaign simulation is useful evidence against common deadlocks, but it is not a proof that every random campaign is solvable or enjoyable. Its policy evaluates available moves every 0.25 simulated seconds, and the test asserts at least 36 wins out of 40 rather than requiring every seed to win. The observed run achieved 40. Its 7.7-minute mean is a simulated pacing measurement, not a measured average from human players.

Victory and sector-completion browser checks used prepared near-completion fixtures. Those checks verify the real interaction and screen transitions without representing a complete human-played campaign. The record does not establish broad browser compatibility, measured frame-rate performance, full screen-reader usability, or long-term replay value.

## Time spent

All timestamps below refer to 8 September 2026 in **UTC**. Europe/Madrid local time was UTC+02:00, so the build ran approximately **20:23:26–20:50:38 local time**.

| Segment | UTC interval | Duration |
| --- | --- | ---: |
| Initial build and testing turn | 18:23:26–18:46:13 | 22 min 46.302 s |
| Gap after usage-limit interruption | 18:46:13–18:48:29 | Approximately 2 min 16 s |
| Resumed final checks and opening adjustment | 18:48:29–18:50:38 | 2 min 9.304 s |
| Active task time | Sum of the two recorded `duration_ms` values | **24 min 55.606 s** |
| Elapsed build window | First `started_at` to final `completed_at` | **Approximately 27 min 12 s** |

Active task time includes reasoning, tools, installation, compilation, and browser work while each turn was running. It is not an isolated measure of model inference or hands-on coding. The duration fields retain milliseconds while the displayed start/end fields have whole-second precision, so their differences do not reconcile exactly at the millisecond level.

Recorded progress milestones were concept selection at 18:24:48, core rules complete at 18:29:10, full-game implementation at 18:38:03, initial browser feedback and the Call addition at 18:39:38, and successful campaign tests at 18:43:09. These are reporting timestamps, not independently measured time allocations for each discipline.

## Token usage

Both development turns record model **`gpt-6-astra`** with reasoning effort **`xhigh`**. The session metadata records Codex CLI version **0.153.4**.

| Logged metric | Initial turn | Resumed turn, calculated delta | Complete build |
| --- | ---: | ---: | ---: |
| Input tokens | 2,209,157 | 963,964 | **3,173,121** |
| Cached input tokens, included in input | 2,098,176 | 942,080 | **3,040,256** |
| Uncached input, calculated | 110,981 | 21,884 | **132,865** |
| Output tokens | 37,898 | 2,089 | **39,987** |
| Reasoning output tokens, included in output | 6,691 | 1,115 | **7,806** |
| Total tokens: input + output | 2,247,055 | 966,053 | **3,213,108** |

The source is the session's `event_msg` → `token_count` → `info.total_token_usage` data. The initial-turn boundary is the snapshot at **18:46:13.124 UTC**; the complete-build boundary is **18:50:38.959 UTC**. The resumed-turn figures are the final cumulative counters minus the initial-turn counters.

The log contains 40 usage snapshots but only 39 distinct cumulative totals, including a repeated snapshot at the interruption. Summing cumulative snapshots would substantially overcount usage. Cached input and reasoning output are shown as components and are not added again to the total.

Approximately **95.81% of recorded input tokens were cached**. The large input total includes context processed repeatedly across requests; it is not the size of the prompt, the repository, or unique text authored. The final request alone recorded 110,046 input tokens and 80 output tokens, illustrating why short verification steps can still add substantial aggregate context traffic. The log does not provide a monetary bill, so no currency cost is estimated here.

## What worked and what to improve

The most effective structural choice was separating the model from PixiJS. It supported rapid rule checks and complete simulated campaigns while the same model drove the browser experience. A small set of connected mechanics supplied progression without adding unrelated systems. Procedural graphics and audio kept the result self-contained, and playtesting produced concrete improvements: early packet calls, isolated fixtures, and a reliable opening burst.

The main process disruption was the usage-limit interruption before delivery. Work resumed successfully, but repeated context processing was substantial, particularly during the final browser checks. Future work should keep retrieved output focused, retain compact verification summaries, and group independent checks where practical. The missing `RTK.md` reference should also be resolved in the project setup so future runs have an unambiguous instruction source.

The next useful evaluation is observation of unfamiliar human players: whether they discover the first burst, understand rerouting, perceive the supply as fair, and find the later sectors challenging. Further engineering work should follow evidence from that evaluation or measured performance issues. If overlays and settings expand, extracting them from `src/game.ts` would be a natural maintenance improvement.

## Evidence sources

- [`design.md`](design.md): original scope, constraints, and completion standard.
- [`README.md`](README.md), [`package.json`](package.json), and the `src/` files listed above: delivered behavior, commands, architecture, and tuning.
- [`tests/model.test.ts`](tests/model.test.ts) and [`tests/fixtures.ts`](tests/fixtures.ts): verification coverage, simulation policy, and browser scenarios.
- Original task **Build 2D arcade puzzle game**, ID `01a08242-b1ca-7970-ac75-3e27466a8906`: development actions, commentary, command results, and browser checks.
- Local session log `rollout-2026-09-08T20-23-24-01a08242-b1ca-7970-ac75-3e27466a8906.jsonl`, under the Codex home directory's `sessions/2026/09/08/`: model metadata, cumulative token counters, and turn timing fields. This log is external to the project and is not required to run the game.
