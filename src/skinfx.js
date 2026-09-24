// First-person look of rare skins: when you jump into a turret, epic skins tint the view edges in
// the skin's colour and legendary skins add a glowing, pulsing frame with scanlines.
// Listens to sl:fpv from main.js; styling only (no game logic).
import { SKINS } from './config.js';
import { skinOf } from './meta.js';

const css = document.createElement('style');
css.textContent = `
#skin-frame{position:fixed;inset:0;z-index:7;pointer-events:none;display:none}
body.fpv #skin-frame.on{display:block}
#skin-frame.epic{box-shadow:inset 0 0 90px 18px color-mix(in srgb,var(--sg) 55%,transparent)}
#skin-frame.legendary{box-shadow:inset 0 0 110px 26px color-mix(in srgb,var(--sg) 60%,transparent),inset 0 0 0 3px color-mix(in srgb,var(--sg) 85%,transparent);
  animation:skinPulse 2.4s ease-in-out infinite}
#skin-frame.legendary::after{content:"";position:absolute;inset:0;opacity:.10;
  background:repeating-linear-gradient(0deg,var(--sg) 0 1px,transparent 1px 4px)}
#skin-frame .sk-tag{position:absolute;left:50%;top:calc(var(--sat,0px) + 58px);transform:translateX(-50%);font:900 9px/1 system-ui,sans-serif;letter-spacing:.2em;
  color:var(--sg);text-shadow:0 0 6px var(--sg);opacity:.85}
@keyframes skinPulse{50%{box-shadow:inset 0 0 130px 34px color-mix(in srgb,var(--sg) 70%,transparent),inset 0 0 0 3px var(--sg)}}
@media (prefers-reduced-motion:reduce){#skin-frame.legendary{animation:none}}`;
document.head.appendChild(css);
const el = document.createElement('div');
el.id = 'skin-frame';
el.innerHTML = '<span class="sk-tag"></span>';
document.body.appendChild(el);

window.addEventListener('sl:fpv', (e) => {
  const type = e.detail?.type;
  const id = type ? skinOf(type) : 'factory';
  const s = SKINS[id];
  const rar = s?.rarity || 'common';
  el.className = rar === 'epic' || rar === 'legendary' ? `on ${rar}` : '';
  el.style.setProperty('--sg', s?.glow || s?.band || s?.fx?.trail || '#ffcf5a');
  el.querySelector('.sk-tag').textContent = rar === 'legendary' ? `${s.name.toUpperCase()} · LEGENDARY` : '';
});
