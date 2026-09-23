# Serpent Line — Mobile Action Tower Defense

A 3D hybrid tower defense for mobile and desktop browsers, built with Three.js (r160, ES modules straight from the CDN, no build step).

**Play:** https://stepanvcelak11.github.io/mobile-action-td/

## How to play
- **Main menu:** pick a map in the Campaign tab (maps unlock one after another), or spend Tech points in the Armory.
- **Top-down (strategic) view:** tap a glowing pad to open the build card and pick a turret type. Tap a built turret to **control**, **upgrade** (up to Lv 3) or **sell** it. Tap **START WAVE** when ready. ❚❚ pauses, 1×/2× changes game speed.
- **First-person turret mode:**
  - **Left half:** drag anywhere to aim. A quick **tap on another turret** jumps into it, and a tap on an **empty pad** opens the build card, so you can build without leaving the turret.
  - **Right half / FIRE:** tap or hold to fire. Watch the barrel heat gauge.
  - **Corner buttons:** MAP (back to top-down), NEXT (next turret), WAVE (start the next wave), ⬆ (upgrade this turret).
  - Controlling a turret yourself is about 1.7–2× stronger than letting it fire on its own. Glowing **weak points** take ×1.75 damage.
- **Desktop:** click to lock the mouse, click / hold (or Space) to fire, Tab = next turret, U = upgrade, E = exit, Enter = next wave, P = pause.

## Turrets
| Turret | Role |
|---|---|
| Twin Cannon | Balanced twin shells (starter) |
| Gatling | Very fast fire at short range |
| Rocket Pod | Long-range homing rockets with splash damage |
| Tesla Coil | Chain lightning that also slows enemies |
| Railgun | Pierces every enemy in a line, zoom scope in first-person mode |

## Maps and progression
- **Green Valley** (8 waves), **Dune Sea** (10), **Frostbite Pass** (12, two roads), **Magma Core** (15, spiral). Clearing a map unlocks the next one plus its **Endless** mode.
- 1–3 stars per map, depending on base HP left. Kills and waves give **XP**. Every commander level gives 1 Tech point, and every new star gives 2.
- **Armory:** unlock turrets and buy permanent upgrades (starting gold, base armor, manual damage, heat sinks, auto fire rate, kill bounty). Progress is saved in the browser.

## Tech
| File | Contents |
|---|---|
| `index.html` | Viewport, import map for Three.js, HUD markup |
| `style.css` | HUD, FPV overlay, build sheet; portrait and landscape layouts |
| `src/main.js` | Renderer, state machine (`IDLE`, `WAVE_IN_PROGRESS`, `VICTORY`, `GAME_OVER`), camera transitions, input, turret AI and weapons, waves, economy, menu flow |
| `src/config.js` | Turret types, maps, themes, perks, upgrade rules |
| `src/progress.js` | Saved progression: XP and levels, Tech points, unlocks, stars |
| `src/ui.js` | Main menu, armory, turret icons, map thumbnails |
| `src/world.js` | Waypoint S-road (arc-length path), ground, build plots, portal, base, instanced decor |
| `src/entities.js` | Procedural low-poly turret (hex base, yaw torso, pitch twin barrels) and enemies with billboard health bars and weak points |
| `src/effects.js` | Pooled `THREE.Points` particle bursts and tracer projectiles with trails |
| `src/audio.js` | Synthesized WebAudio sound effects (no asset files) |

Run it locally with any static server, e.g. `python -m http.server 3000`, then open http://localhost:3000.
