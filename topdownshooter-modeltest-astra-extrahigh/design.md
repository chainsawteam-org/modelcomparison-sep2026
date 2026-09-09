# Game Development Benchmark

Your task is to independently design and build a complete, polished, playable **3D top-down action shooter**.

You are being evaluated not only on whether the game works, but also on the quality of your game design, combat, controls, enemy behavior, visual presentation, game feel, technical decisions, and overall level of polish.

Do not ask questions.

Make reasonable design decisions yourself and continue working until you consider the game finished.

---

# Core Concept

Create an original **3D top-down arcade shooter** built around the following idea:

> The player controls a character inside a dangerous combat arena or environment, fighting increasingly threatening enemies while moving, aiming, collecting resources, and making tactical decisions.

The exact interpretation of this concept is up to you.

The game should emphasize:

- movement
- aiming
- shooting
- enemy avoidance
- positioning
- combat decision-making
- escalating pressure

You may introduce additional mechanics if they improve the game.

Examples include:

- multiple weapons
- weapon switching
- limited ammunition
- reload mechanics
- melee attacks
- dash or dodge
- shields
- environmental hazards
- enemy projectiles
- explosive objects
- pickups
- temporary power-ups
- experience
- upgrades
- combo systems
- kill streaks
- procedural encounters
- elite enemies
- bosses
- destructible objects

You do **not** need to implement all of these.

Choose the systems that result in the strongest game.

The game should be an original design rather than a direct clone of an existing title.

---

# Design Goals

The game should be:

- immediately understandable
- responsive
- satisfying to control
- visually readable
- challenging without feeling unfair
- replayable
- polished
- fun within the first 30 seconds

A typical gameplay session should last approximately **5–15 minutes**.

The player should frequently make meaningful decisions involving:

- positioning
- target prioritization
- movement
- risk versus reward
- resource usage
- upgrades or pickups where applicable

There should be a clear:

- objective
- gameplay loop
- progression in difficulty
- scoring or performance system
- failure condition
- restart flow

---

# Technical Stack

Use exactly:

- **TypeScript**
- **Three.js**
- **Vite**

Do not replace Three.js with:

- Unity
- Unreal Engine
- Godot
- Babylon.js
- PlayCanvas
- Phaser
- PixiJS
- another game engine

Three.js should handle rendering and the 3D scene.

You are responsible for implementing the game systems required around it.

Additional lightweight libraries may only be introduced when they provide a clear technical benefit.

Avoid unnecessary dependencies.

---

# Technical Requirements

The project must:

- run locally using standard npm commands
- compile without TypeScript errors
- launch through Vite
- run in a modern desktop browser
- require no backend
- require no user account
- require no external service
- work from a fresh install using only the repository contents

Prefer a setup such as:

```bash
npm install
npm run dev
```

The game should remain performant during normal gameplay.

---

# Camera

The game must use a **3D top-down or elevated isometric-style camera**.

The player should always have enough visibility to understand:

- nearby enemies
- incoming projectiles
- environmental threats
- important pickups
- navigable space

The camera may:

- remain fixed
- follow the player
- smoothly interpolate
- dynamically adjust
- use limited camera shake

Choose the solution that produces the best gameplay.

Avoid camera movement that makes aiming or spatial awareness unnecessarily difficult.

---

# Controls

Design the game primarily for:

- **WASD** movement
- **mouse** aiming
- **left mouse button** or equivalent primary input for shooting

Additional controls may be introduced where useful.

Examples:

- Shift — dash
- R — reload
- Space — secondary action
- number keys — weapon selection

Do not overload the controls unnecessarily.

The game should feel good using mouse and keyboard.

---

# Combat

Combat is the core of the game.

Pay particular attention to:

- responsiveness
- aiming
- weapon feedback
- hit detection
- enemy reactions
- projectile readability
- movement while shooting
- damage feedback
- pacing
- enemy pressure

Weapons should feel impactful.

Shots should produce appropriate feedback through techniques such as:

- recoil
- muzzle flashes
- tracers
- projectile effects
- impact effects
- particles
- hit flashes
- enemy knockback
- hit-stop
- sound
- camera response
- animation

Use these techniques carefully.

Clarity is more important than visual noise.

---

# Enemy Design

Include multiple enemy behaviors.

Enemies should not simply differ by health values.

Consider behavioral archetypes such as:

- melee pursuers
- ranged attackers
- chargers
- swarm enemies
- slow tanks
- evasive enemies
- suicide attackers
- enemies that maintain distance
- enemies that flank
- enemies that spawn or support others

You do not need all of these.

Choose a small number of enemy types that interact well with each other.

Enemy combinations should create different tactical situations.

---

# Enemy AI

Enemy behavior should be understandable but not completely predictable.

AI should appropriately handle:

- finding the player
- movement
- attacking
- maintaining useful combat distance
- avoiding obviously broken behavior
- reacting to the environment where necessary

Sophisticated navigation is not required if simpler systems produce good gameplay.

Prioritize reliable and fun behavior over unnecessary AI complexity.

---

# Environment

Create at least one complete 3D combat environment.

The environment should affect gameplay rather than serving purely as decoration.

Consider elements such as:

- walls
- cover
- chokepoints
- open areas
- obstacles
- hazards
- elevation differences
- destructible props
- explosive objects

Maintain clear navigation.

Avoid environments where the player frequently becomes stuck or cannot understand where movement is possible.

---

# 3D Presentation

The game should have a coherent visual identity.

You are encouraged to build the visual presentation using procedural or programmatically created assets.

Possible styles include:

- low-poly
- stylized minimalist
- neon
- industrial
- sci-fi
- fantasy
- abstract
- toy-like
- dark atmospheric
- colorful arcade

The specific theme is your decision.

Do not rely on manually supplied art assets.

Use Three.js geometry, materials, lighting, particles, meshes, generated textures, or other locally available techniques where appropriate.

---

# Lighting

Use lighting intentionally.

The scene should have enough depth to clearly communicate its 3D nature while maintaining gameplay readability.

Consider:

- directional lighting
- ambient lighting
- shadows
- emissive materials
- environmental lights

Avoid sacrificing readability for realism.

---

# Game Feel

Game feel is a major evaluation criterion.

Combat and movement should feel satisfying.

Pay attention to:

- acceleration
- deceleration
- movement responsiveness
- aiming
- recoil
- weapon impact
- enemy death
- particles
- hit effects
- sound
- animation
- camera shake
- screen feedback
- transitions

Enemy destruction or death should be particularly satisfying and readable.

---

# Audio

Include audio if practical.

You may generate sound effects programmatically using browser audio APIs.

Audio should reinforce:

- shooting
- impacts
- enemy deaths
- damage
- pickups
- UI interactions
- important game states

The game must still function if browser autoplay restrictions prevent audio until the first player interaction.

Do not depend on external copyrighted music or audio.

---

# Progression

The game should become meaningfully more difficult over time.

Do not rely solely on:

- increasing enemy health
- increasing enemy movement speed
- spawning larger numbers of identical enemies

Prefer escalation through:

- new enemy combinations
- new enemy types
- environmental pressure
- elite enemies
- stronger attack patterns
- reduced safe space
- tactical complications
- player upgrade decisions

If upgrades are implemented, they should meaningfully affect how the player plays.

---

# Player Progression

You may include an upgrade system if it improves the game.

Possible upgrades include:

- weapon changes
- fire rate
- damage
- projectile behavior
- movement
- dash
- health
- shields
- explosions
- piercing
- ricochet
- elemental effects
- drones
- temporary abilities

Avoid upgrades that only increase numbers when more interesting alternatives are possible.

The player should ideally be able to create noticeably different combat builds.

---

# UX

Include all interface necessary for a finished experience.

The player should be able to understand:

- health
- score
- objective
- current weapon
- ammunition, if relevant
- cooldowns, if relevant
- upgrades, if relevant
- current danger level or progression
- when the game has ended
- how to restart

Keep the gameplay area readable.

Avoid covering large portions of the screen with unnecessary UI.

---

# Difficulty

The opening should allow a new player to learn the controls without immediately dying.

Difficulty should then increase steadily.

The game should reward skill improvement.

A stronger player should be able to survive longer, score higher, or progress further through:

- better aim
- better movement
- positioning
- target prioritization
- efficient ability use
- understanding enemy behavior

Avoid unavoidable damage whenever possible.

---

# Architecture

Structure the code appropriately for a small professional game project.

Separate major responsibilities when useful.

Examples might include:

- game state
- player
- enemies
- weapons
- projectiles
- input
- camera
- rendering
- effects
- audio
- UI
- progression

This list is illustrative rather than mandatory.

Avoid both extremes:

- one enormous file
- unnecessary architectural abstraction

Choose an architecture appropriate to the scope.

---

# Performance

The game should maintain good performance during intense combat.

Pay attention to potentially expensive systems such as:

- projectiles
- particles
- enemies
- shadows
- lights
- object creation
- collision checks

Use practical optimizations where necessary.

Do not sacrifice gameplay quality through premature optimization.

---

# Robustness

Before considering the game finished:

- run the game
- test movement
- test aiming
- test shooting
- test enemy behavior
- test player damage
- test death
- test restarting
- test progression
- check the browser console
- fix obvious bugs
- fix softlocks
- verify that enemies cannot regularly become permanently stuck
- verify that repeated sessions work correctly

Play the game yourself.

Do not consider a merely functional implementation finished.

If combat feels weak, improve it.

If the game is difficult to read, improve it.

If an enemy is frustrating rather than challenging, improve it.

Iterate.

---

# Scope

This is intentionally a **small arcade game**.

Prioritize:

1. excellent movement
2. excellent shooting
3. interesting enemies
4. strong game feel
5. readable combat
6. meaningful difficulty progression
7. polish

over a large quantity of content.

A small game with exceptional combat is preferable to a large unfinished game.

---

# Autonomy

You have complete creative control over:

- game name
- setting
- visual identity
- player character
- weapons
- enemy types
- progression
- level design
- upgrades
- scoring
- difficulty curve
- sound design
- visual effects
- architecture
- balance

Do not ask the user to make these decisions.

Make them yourself.

---

# Completion Standard

Do not stop once the following technically work:

> move → aim → shoot → enemy dies.

That is the prototype stage.

Once the core gameplay works, continue improving:

- movement feel
- weapon feel
- enemy diversity
- combat pacing
- difficulty
- visual coherence
- enemy death feedback
- particles
- sounds
- UI
- transitions
- balance
- edge cases
- overall enjoyment

Treat the result as a game you would be comfortable showing publicly as a small finished project.

Continue iterating until further changes would provide relatively little improvement compared with the current result.

---

# Final Deliverable

The repository should contain everything required to run the game.

Include a short `README.md` containing:

- game name
- brief description
- controls
- how to run it
- explanation of the main mechanics

Do not include a long development diary.

Do not provide an extensive explanation of your reasoning.

The primary deliverable is the **playable game**.

---

# Evaluation

The result will be compared against games independently produced by other AI development agents receiving the same instructions.

It will approximately be evaluated on:

| Category | Weight |
|---|---:|
| Combat / core gameplay quality | 20% |
| Game feel and responsiveness | 20% |
| Polish | 15% |
| Game design and depth | 10% |
| Enemy design and AI | 10% |
| Visual presentation | 10% |
| Creativity / originality | 5% |
| Technical robustness | 5% |
| Code quality | 5% |

Do not optimize mechanically for this table.

The ultimate objective is:

> **Create the best small 3D top-down shooter you can using TypeScript, Three.js and Vite.**