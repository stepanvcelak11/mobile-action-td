# Serpent Line — Mobile Action Tower Defense

A 3D hybrid tower defense for mobile and desktop browsers, built with Three.js (r160, ES modules straight from the CDN, no build step).

**Play:** https://stepanvcelak11.github.io/mobile-action-td/

## How to play
- **Main menu:** pick one of 7 maps in the Campaign tab (they unlock one after another), or spend Tech points in the Armory.
- **Top-down (strategic) view:**
  - Tap a glowing pad to build one of 10 turret types.
  - Tap a built turret to open its **upgrade tree**, switch its targeting (First / Strong / Near), sell it, or take **control**.
  - **START WAVE** shows a preview of the next wave. While the last enemies are still walking you can **call the next wave early** for bonus gold.
  - ❚❚ pauses and ▶ switches between 1× and 2× speed.
- **First-person turret mode:**
  - **Left half:** drag anywhere to aim.
  - **Markers** float above every other turret and empty pad. Tap a turret marker to jump into it, or a pad marker to build there without leaving your turret.
  - **Right half / FIRE:** tap or hold to fire. Watch the barrel heat gauge.
  - **Corner buttons:** MAP (back to top-down), NEXT (next turret), WAVE (start / call a wave), upgrade tree.
  - Controlling a turret yourself is about 1.7–2× stronger than auto-fire. Glowing **weak points** take ×1.75 damage (the Sniper does ×3).
  - Consecutive manual hits build a **combo**: up to +50% damage, and +20% kill gold from 10×. A miss resets it.
- **Abilities** (left edge): **Airstrike** (tap the ground in top-down view, or it hits your crosshair in first person; the bombs land 1.2 s later, so lead your target) and **EMP** (stuns everything and pops shields).
- **Desktop:** click to lock the mouse, click / hold (or Space) to fire, Tab = next turret, U = upgrades, Q = airstrike, R = EMP, E = exit, Enter = next wave, P = pause.

## Turrets
Cannon, Gatling and Sniper are unlocked from the start. The rest unlock in the Armory.

| Turret | Role | Skill in first-person mode |
|---|---|---|
| Twin Cannon | Balanced twin shells | Alternating barrels, weak points |
| Gatling | Very fast fire, shreds swarms and drones | Tracking fast targets |
| Sniper | Huge range, weak points ×3 | Bullet drop and travel time, scope sway that settles when you hold still, rangefinder |
| Cryo Lance | Slows, freezes and shatters | — |
| Flamethrower | Short cone, burn damage | Sweeping the cone |
| Rocket Pod | Homing rockets with splash, hits air | — |
| Mortar | Lobbed shells with a big blast, ground only | Arcing shells with a landing marker, so you lead the target |
| Tesla Coil | Chain lightning and slow | — |
| Laser | Continuous beam that ramps up to ×2.5 on one target | Keeping the beam on target (and on the weak point) |
| Railgun | Pierces every enemy in a line | Scope, lining up targets |

### Upgrade trees
Every turret has **3 themed branches × 5 tiers**, for example Cannon: Heavy Shells / Autoloader / Fire Control.
- You can buy **10 upgrades** per turret, tiers in order.
- Only **one branch** can go past tier 3, and tier ★ is that branch's signature ability.
- Upgrades add damage, fire rate, range, splash, pierce, chains, slow, stun, freeze, burn, armor shred, crits, execute, bounty gold, **Detection** (needed for auto-fire at cloaked enemies) and more.

## Enemies
Crawler (fast), Tank (armored −30%), Drone (flies; the Mortar can't hit it), Guardian (energy shield; hit the generator on its back to pop it), Phantom (cloaked; auto turrets need Detection, or reveal it by hitting it), Splitter (splits into 3 minis), Behemoth (boss).

## Maps and progression
- Green Valley (8 waves), Dune Sea (10), Frostbite Pass (12, two roads), Red Canyon (12), Toxic Swamp (14, two roads), Magma Core (15, spiral) and Neon Ruins (18, three gates at night).
- Each map has its own theme, landmarks, pools and weather.
- 1–3 stars per map, depending on base HP left. Clearing a map unlocks the next one plus its **Endless** mode.
- Kills and waves give **XP**. Every commander level gives 1 Tech point, and every new star gives 2.
- **Armory:** unlock turrets and buy permanent upgrades (starting gold, base armor, manual damage, heat sinks, auto fire rate, kill bounty, ability cooldowns).
- Progress is saved in the browser.

## Tech
| File | Contents |
|---|---|
| `index.html` | Viewport, import map for Three.js, HUD markup |
| `style.css` | HUD, first-person overlay, sheets, upgrade tree, menu; portrait and landscape layouts |
| `src/main.js` | Renderer, state machine (`IDLE`, `WAVE_IN_PROGRESS`, `VICTORY`, `GAME_OVER`), camera transitions, input, weapons, damage and status pipeline, waves, abilities, menu flow |
| `src/config.js` | Turrets, enemies, maps, themes, perks, abilities |
| `src/trees.js` | Upgrade trees for all 10 turrets and the purchase rules |
| `src/progress.js` | Saved progression: XP and levels, Tech points, unlocks, stars |
| `src/ui.js` | Main menu, armory, map thumbnails |
| `src/icons.js` | SVG icon set for HUD buttons, enemies and turrets |
| `src/world.js` | Waypoint roads (arc-length paths), gradient sky, ground, build plots, portals, base, landmarks, pools, instanced decor |
| `src/entities.js` | Procedural low-poly turrets (10 weapon heads) and enemies (8 types) with billboard health and shield bars |
| `src/effects.js` | Pooled particles, projectiles (with gravity and homing), beams and weather |
| `src/audio.js` | Synthesized WebAudio sound effects (no asset files) |

Run it locally with any static server, e.g. `python -m http.server 3000`, then open http://localhost:3000.
