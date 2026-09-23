# Serpent Line — Mobile Action Tower Defense

A 3D hybrid tower defense for mobile and desktop browsers, built with Three.js (r160, ES modules straight from the CDN, no build step).

**Play:** https://stepanvcelak11.github.io/mobile-action-td/

## How to play
- **Top-down (strategic) view** — tap a glowing pad to open the build card (100 gold), tap **START WAVE** when ready.
- **Tap any built turret** to fly the camera into it (first-person turret mode).
  - **Left half:** drag to aim (360° yaw, pitch −15°…+45°).
  - **Right half / FIRE button:** tap or hold to spray. Watch the barrel heat gauge.
  - Manual shots deal **2× damage**, and hitting a glowing **weak point** multiplies it again.
  - **EXIT TO TOP-DOWN** flies back to the map.
- **Desktop:** click to lock the mouse, move to aim, click / hold (or Space) to fire, `E` to exit, `Enter` starts the next wave.

Survive 8 waves. Scouts are fast (+15 gold), heavy tanks are armored (+40), and bosses arrive on waves 5 and 8.

## Tech
| File | Contents |
|---|---|
| `index.html` | Viewport, import map for Three.js, HUD markup |
| `style.css` | HUD, FPV overlay, build sheet; portrait and landscape layouts |
| `src/main.js` | Renderer, state machine (`IDLE`, `WAVE_IN_PROGRESS`, `VICTORY`, `GAME_OVER`), camera transitions, input, turret AI, waves, economy |
| `src/world.js` | Waypoint S-road (arc-length path), ground, build plots, portal, base, instanced decor |
| `src/entities.js` | Procedural low-poly turret (hex base, yaw torso, pitch twin barrels) and enemies with billboard health bars and weak points |
| `src/effects.js` | Pooled `THREE.Points` particle bursts and tracer projectiles with trails |
| `src/audio.js` | Synthesized WebAudio sound effects (no asset files) |

Run it locally with any static server, e.g. `python -m http.server 3000`, then open http://localhost:3000.
