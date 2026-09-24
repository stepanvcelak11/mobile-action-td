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

## Meta game (v4)
- **Menu** in the style of mobile games: currencies bar (trophies, coins, gems, tech) plus bottom navigation: **Shop · Armory · Battle · Pass · Road**.
- **Mission briefing** before each map: 3D portraits of the enemies you will meet, bosses and rewards.
- **Chests** after every match (Wood, Iron, Gold, Epic), opened with an animation. They drop coins, gems, **turret cards**, **ability charges** and sometimes a skin.
- **Turret levels 1–10** from cards + coins: +7% damage and +1.5% range per level. A card of a locked turret unlocks it.
- **Collectible abilities:** Airstrike, EMP, Repair and Cryo Bomb. Each use costs a charge.
- **Trophy Road** with 40 milestones, and a 30-tier **Battle Pass** with a free and a premium track (the premium track is unlocked with gems earned in the game).
- **Daily quests**, a daily gift and daily shop deals.
- **Skins:** 7 turret skins with rarities, equipped per turret type.
- **Enemy codex** with 3D portraits and tips.
- **Settings:** dark/light theme, button size, aim sensitivity, volume, left-handed mode and a **layout editor** (drag the in-game buttons wherever you want).
- **First-run tutorial** on Green Valley.
- **Upgrade tree** redrawn as a graph: 3 rows of round nodes with effect icons and an info bar with BUY.

## Tech
| File | Contents |
|---|---|
| `index.html` | Viewport, import map for Three.js, HUD markup |
| `style.css` | HUD, first-person overlay, sheets, upgrade tree, menu; portrait and landscape layouts |
| `src/main.js` | Renderer, state machine (`IDLE`, `WAVE_IN_PROGRESS`, `VICTORY`, `GAME_OVER`), camera transitions, input, weapons, damage and status pipeline, waves, abilities, menu flow |
| `src/config.js` | Turrets, enemies, maps, themes, perks, abilities |
| `src/trees.js` | Upgrade trees for all 10 turrets and the purchase rules |
| `src/progress.js` | Saved progression: XP and levels, Tech points, unlocks, stars |
| `src/ui.js` | Menu shell and tabs, briefing, chest opening, turret details and skins, codex, settings, layout editor |
| `src/meta.js` | Currencies, turret cards and levels, chests, Trophy Road, Battle Pass, quests, shop, skins |
| `src/portraits.js` | 3D portraits of turrets and enemies rendered from the game models |
| `src/treeview.js` | Graphical upgrade tree |
| `src/icons.js` | SVG icon set for HUD buttons, enemies and turrets |
| `src/world.js` | Waypoint roads (arc-length paths), gradient sky, ground, build plots, portals, base, landmarks, pools, instanced decor |
| `src/entities.js` | Procedural low-poly turrets (10 weapon heads) and enemies (8 types) with billboard health and shield bars |
| `src/effects.js` | Pooled particles, projectiles (with gravity and homing), beams and weather |
| `src/audio.js` | Synthesized WebAudio sound effects (no asset files) |

Run it locally with any static server, e.g. `python -m http.server 3000`, then open http://localhost:3000.

## Skill, modes and feel (v6)
- **Wave grades** S/A/B/C after every wave (accuracy, headshots, leaks). The **3rd star** of a map needs its challenge (shown under the map), e.g. "40% headshots" or "no leaks".
- **Turret mastery**: manual kills and headshots level up each turret type (Recruit → Legend).
- **Endless is a roguelite run**: every 5 waves pick 1 of 3 upgrade cards (18 cards, Common/Rare/Epic).
- **Daily challenge**: the same map, mutator and enemies for everyone each day, plus a weekly mutator. The first run counts for the online leaderboard (`worker/`, Cloudflare Worker + D1, https://serpentline-api.ar-geodet.workers.dev).
- **World map** with 3 chapters, radio talk between HQ and the enemy commander Viper, and **Hard** mode for maps with 3 stars (tougher, more enemies, 2 extra waves).
- **Adaptive music** (layers follow the fight, own key and tempo per map) and layered weapon sounds.
- **Living maps**: wind in trees, ripples on ponds, birds that scatter at explosions.
- **Graphics setting** Auto/Low/Mid/High (auto lowers resolution when the phone struggles) and an FPS meter.
- **Install to home screen / offline** (manifest + service worker, Three.js served locally from `vendor/`).
- **Tests**: `python tests/smoke.py --dir .` plays the first wave in landscape and portrait; GitHub Actions runs it on every push.
