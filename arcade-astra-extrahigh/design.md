# Game Development Benchmark

Your task is to independently design and build a complete, polished, playable 2D arcade puzzle game.

You are being evaluated not only on whether the game works, but also on the quality of your game design, UX, visual presentation, game feel, technical decisions, and overall level of polish.

Do not ask questions. Make reasonable design decisions yourself and continue working until you consider the game finished.

---

# Core Concept

Create an original **arcade puzzle / flow management game** built around the following idea:

> Different colored units or objects continuously enter a limited staging area or queue.  
> The player must decide how, when, or where to deploy them in order to clear matching targets and prevent the available space from filling up.

The exact interpretation of this concept is up to you.

You may introduce additional mechanics if they improve the game.

Examples of systems you may explore include:

- color matching
- limited queue capacity
- routing
- spatial placement
- target prioritization
- chain reactions
- combos
- risk/reward decisions
- temporary blockers
- special pieces
- power-ups
- escalating difficulty
- level objectives
- score multipliers

You do **not** need to implement all of these.

Choose the mechanics that produce the strongest game.

The game should feel inspired by modern accessible arcade-puzzle and sorting games, but it must be an original design rather than a direct clone of an existing game.

---

# Design Goals

The game should be:

- immediately understandable
- playable with very little instruction
- satisfying within the first 30 seconds
- increasingly challenging
- visually readable
- responsive
- replayable
- polished enough to feel like a small finished game rather than a prototype

A typical play session should last approximately **3–10 minutes**.

The player should have meaningful decisions rather than simply performing obvious actions.

There should be a clear:

- objective
- failure condition
- progression in difficulty
- scoring or performance system
- restart/game-over flow

---

# Technical Stack

Use exactly:

- **TypeScript**
- **PixiJS**
- **Vite**

Do not replace PixiJS with Phaser, Three.js, Unity, Godot, React, or another game framework.

PixiJS should handle rendering.

You are responsible for implementing any game systems you require around it.

---

# Technical Requirements

The project must:

- run locally with standard npm commands
- compile without TypeScript errors
- launch through Vite
- run in a modern desktop browser
- require no backend
- require no account or external service
- work from a fresh install using the repository files

Prefer a simple setup such as:

```bash
npm install
npm run dev
```

Keep dependencies minimal.

Do not introduce libraries unless they provide a meaningful benefit.

---

# Controls

The game should primarily use the **mouse**.

Keyboard controls may be added where useful.

The complete game must be playable without requiring a gamepad.

---

# Presentation

Target a desktop browser experience around **1280×720**, while handling reasonable changes in window size gracefully.

Create a coherent visual identity for the game.

You may generate visuals procedurally using PixiJS primitives, text, particles, shapes, gradients, simple generated textures, or other techniques available locally.

Do not depend on manually supplied art assets.

If external assets are unnecessary, prefer creating the game's presentation yourself.

The visual style is your choice.

---

# Game Feel

Pay particular attention to feedback.

Actions should feel satisfying through appropriate use of techniques such as:

- animation
- easing
- anticipation
- impact
- particles
- screen movement
- scaling
- transitions
- trails
- highlights
- combo feedback
- score feedback
- audio feedback

Do not add effects indiscriminately. Maintain clarity and readability.

---

# Audio

Include sound if practical.

Audio may be generated programmatically using browser audio APIs.

The project should not depend on external copyrighted music or audio files.

The game must still function correctly if audio cannot autoplay until the player interacts with the page.

---

# UX

Include whatever interface is necessary for a finished experience.

At minimum, make sure the player can understand:

- what they should do
- their current score or progress
- how close they are to losing, where applicable
- when the game has ended
- how to play again

Avoid lengthy instructions.

Prefer teaching the player through interface design and gameplay.

---

# Difficulty and Progression

The game should become meaningfully more difficult as the session progresses.

Do not rely solely on making everything faster.

Consider introducing new situations, combinations, constraints, target arrangements, piece behaviors, or strategic pressures.

Balance the game so that an inexperienced player can understand it quickly while a skilled player can noticeably improve their performance.

---

# Architecture

Structure the code as you consider appropriate for a small but professional game project.

Avoid putting the entire game into one enormous file.

Separate responsibilities where doing so improves maintainability.

However, do not over-engineer the project.

Choose architecture appropriate to the size of the game.

---

# Robustness

Before considering the game finished:

- run it
- test the core gameplay loop
- test restarting
- test losing/winning where applicable
- check for console errors
- check common edge cases
- fix obvious gameplay exploits or softlocks
- verify that the game remains playable after multiple sessions

You are encouraged to iterate on the game after playing it yourself.

If something is functional but not enjoyable or readable, improve it.

---

# Scope

This is intentionally a small game.

Prioritize:

1. a strong core mechanic
2. excellent interaction
3. clarity
4. game feel
5. polish

over a large quantity of features.

It is better to create **one excellent gameplay loop** than several shallow systems.

---

# Autonomy

You have creative control over:

- game name
- theme
- visual style
- exact mechanics
- scoring rules
- progression
- difficulty curve
- special pieces
- effects
- UI
- architecture
- balancing

Do not ask the user to make these decisions.

Make them yourself.

---

# Completion Standard

Do not stop when you have merely implemented the basic mechanic.

Treat the project as something that should be shown to another person as a finished small game.

After reaching a functional version, spend additional effort improving:

- usability
- balance
- visual coherence
- animations
- feedback
- transitions
- edge cases
- overall fun

Continue iterating until further changes would provide relatively little improvement compared with the current result.

---

# Final Deliverable

The repository should contain everything necessary to run the game.

Include a short `README.md` containing:

- the game's name
- a brief description
- controls
- how to run it
- a short explanation of the core mechanics

Do not include a long development diary or explanation of your reasoning.

The primary deliverable is the **game itself**.

---

# Evaluation

The result will be compared against games independently produced by other AI development agents receiving the same instructions.

It will be evaluated approximately on:

| Category | Weight |
|---|---:|
| Fun / quality of core gameplay | 25% |
| Game feel and responsiveness | 15% |
| Polish | 15% |
| Game design and depth | 15% |
| UX and readability | 10% |
| Creativity / originality | 10% |
| Technical robustness | 5% |
| Code quality | 5% |

Do not optimize specifically for the scoring table at the expense of making a good game.

Your objective is simply:

> **Create the best small arcade puzzle game you can within this concept and technical stack.**