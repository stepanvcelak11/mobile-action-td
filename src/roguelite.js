// Endless as a roguelite run: every 5 waves pick 1 of 3 upgrade cards. Each run plays differently.
//
//   import { run } from './roguelite.js';
//   run.start();                              // new endless match
//   if (run.offerDue(waveJustCleared)) run.offer(onPicked);   // shows 3 cards (pause the game meanwhile)
//   run.mods                                  // current modifiers, read them in the damage / stats code:
//     dmg, rate, range (multipliers), crit (+chance), head (+headshot mult), gold (multiplier),
//     heat (multiplier), cd (ability cooldown multiplier), chain (+targets), pierce (+), splash (+radius),
//     slow (0..1 on every hit), burn (dps on every hit), interest (gold % per wave), manual (multiplier),
//     ammoOnHead (true: a headshot refunds heat), comboKeep (true: a miss halves the combo instead of resetting)
//   run.picked                                // list of picked card ids, for the result screen

const CARDS = [
  { id: 'calibre', name: 'Heavy Calibre', text: '+20% damage for every turret', rarity: 1, apply: (m) => { m.dmg *= 1.2; } },
  { id: 'servos', name: 'Overdriven Servos', text: '+18% fire rate', rarity: 1, apply: (m) => { m.rate *= 1.18; } },
  { id: 'optics', name: 'Long Optics', text: '+15% range', rarity: 1, apply: (m) => { m.range *= 1.15; } },
  { id: 'bounty', name: 'Bounty Contracts', text: '+30% gold from kills', rarity: 1, apply: (m) => { m.gold *= 1.3; } },
  { id: 'interest', name: 'War Bonds', text: 'After each wave, gain 8% of your gold', rarity: 1, apply: (m) => { m.interest += 0.08; } },
  { id: 'coolant', name: 'Cryo Coolant', text: '−30% barrel heat', rarity: 1, apply: (m) => { m.heat *= 0.7; } },
  { id: 'dispatch', name: 'Fast Dispatch', text: '−25% ability cooldowns', rarity: 1, apply: (m) => { m.cd *= 0.75; } },
  { id: 'gunner', name: 'Gunner\'s Instinct', text: '+35% manual damage', rarity: 2, apply: (m) => { m.manual *= 1.35; } },
  { id: 'headhunter', name: 'Headhunter', text: 'Headshots deal +1× more', rarity: 2, apply: (m) => { m.head += 1; } },
  { id: 'lucky', name: 'Lucky Rounds', text: '+12% crit chance (×2 damage)', rarity: 2, apply: (m) => { m.crit += 0.12; } },
  { id: 'arc', name: 'Arc Conductors', text: 'Every hit chains to 1 more enemy', rarity: 2, apply: (m) => { m.chain += 1; } },
  { id: 'piercing', name: 'Tungsten Cores', text: 'Shots pierce 1 more enemy', rarity: 2, apply: (m) => { m.pierce += 1; } },
  { id: 'napalm', name: 'Napalm Tips', text: 'Every hit burns for 6 damage per second', rarity: 2, apply: (m) => { m.burn += 6; } },
  { id: 'tar', name: 'Tar Rounds', text: 'Every hit slows by 15%', rarity: 2, apply: (m) => { m.slow = Math.min(0.5, m.slow + 0.15); } },
  { id: 'recycler', name: 'Recycler', text: 'Headshots cool your barrel', rarity: 3, apply: (m) => { m.ammoOnHead = true; } },
  { id: 'focus', name: 'Steady Focus', text: 'A miss only halves your combo', rarity: 3, apply: (m) => { m.comboKeep = true; } },
  { id: 'shrapnel', name: 'Shrapnel', text: 'Every hit splashes 1.5 m around the target', rarity: 3, apply: (m) => { m.splash += 1.5; } },
  { id: 'glass', name: 'Glass Cannon', text: '+60% damage, but the base loses 30% max HP', rarity: 3, apply: (m) => { m.dmg *= 1.6; m.baseHp *= 0.7; } },
];
const RARITY = { 1: { name: 'Common', w: 60, c: '#9aa7b4' }, 2: { name: 'Rare', w: 30, c: '#5aa9ff' }, 3: { name: 'Epic', w: 10, c: '#c07aff' } };

function freshMods() {
  return { dmg: 1, rate: 1, range: 1, crit: 0, head: 0, gold: 1, heat: 1, cd: 1, chain: 0, pierce: 0, splash: 0, slow: 0, burn: 0, interest: 0, manual: 1, baseHp: 1, ammoOnHead: false, comboKeep: false };
}

let mods = freshMods();
let picked = [];
let active = false;

function draw3() {
  const pool = CARDS.filter((c) => !(c.rarity === 3 && picked.includes(c.id)));
  const out = [];
  let guard = 0;
  while (out.length < 3 && guard++ < 200) {
    const roll = Math.random() * 100;
    const r = roll < RARITY[3].w ? 3 : roll < RARITY[3].w + RARITY[2].w ? 2 : 1;
    const opts = pool.filter((c) => c.rarity === r && !out.includes(c));
    if (opts.length) out.push(opts[(Math.random() * opts.length) | 0]);
  }
  return out;
}

let css = false;
function ensureCss() {
  if (css) return;
  css = true;
  const s = document.createElement('style');
  s.textContent = `
  #rl-ov{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(5,8,12,.72);backdrop-filter:blur(4px);padding:calc(var(--sat,0px) + 12px) 12px calc(var(--sab,0px) + 12px)}
  #rl-ov h2{margin:0 0 4px;text-align:center;font:900 22px/1.1 system-ui,sans-serif;letter-spacing:.08em;color:var(--accent-2,#ffcf5a)}
  #rl-ov p.sub{margin:0 0 14px;text-align:center;color:var(--muted,#9aa);font-weight:600;font-size:13px}
  .rl-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .rl-card{width:min(200px,28vw);min-width:150px;padding:14px 14px 16px;border-radius:16px;background:var(--panel-solid,#12171f);border:2px solid var(--rc);color:var(--text,#eee);text-align:left;cursor:pointer;
    box-shadow:0 0 0 0 var(--rc);transition:transform .15s, box-shadow .15s;animation:rlIn .4s cubic-bezier(.2,1.5,.4,1) both}
  .rl-card:nth-child(2){animation-delay:.07s}.rl-card:nth-child(3){animation-delay:.14s}
  .rl-card:hover,.rl-card:focus-visible{transform:translateY(-4px);box-shadow:0 0 22px -4px var(--rc);outline:none}
  .rl-card small{display:block;font-weight:800;font-size:10px;letter-spacing:.14em;color:var(--rc);text-transform:uppercase}
  .rl-card b{display:block;font-size:17px;margin:4px 0 6px}
  .rl-card span{font-size:13px;color:var(--muted,#9aa);line-height:1.35}
  .rl-have{margin-top:12px;text-align:center;font-size:12px;color:var(--muted,#9aa)}
  @keyframes rlIn{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:none}}
  @media (max-height:430px){.rl-card{padding:10px 12px}.rl-card b{font-size:15px}#rl-ov h2{font-size:18px}}`;
  document.head.appendChild(s);
}

export const run = {
  start() { mods = freshMods(); picked = []; active = true; },
  end() { active = false; },
  get active() { return active; },
  get mods() { return mods; },
  get picked() { return picked.slice(); },
  cardName: (id) => CARDS.find((c) => c.id === id)?.name || id,
  /** True after waves 5, 10, 15 … of an active run. */
  offerDue: (wave) => active && wave > 0 && wave % 5 === 0,
  /** Shows 3 cards; calls onPicked(card) after the player taps one. */
  offer(onPicked) {
    ensureCss();
    const cards = draw3();
    const ov = document.createElement('div');
    ov.id = 'rl-ov';
    ov.setAttribute('role', 'dialog');
    ov.innerHTML = `<div><h2>CHOOSE AN UPGRADE</h2><p class="sub">It lasts for the rest of this run</p><div class="rl-row">${cards.map((c, i) => `
      <button class="rl-card" data-i="${i}" style="--rc:${RARITY[c.rarity].c}"><small>${RARITY[c.rarity].name}</small><b>${c.name}</b><span>${c.text}</span></button>`).join('')}</div>
      ${picked.length ? `<div class="rl-have">This run: ${picked.map((id) => run.cardName(id)).join(' · ')}</div>` : ''}</div>`;
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    ov.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('.rl-card');
      if (!b) return;
      const c = cards[+b.dataset.i];
      c.apply(mods);
      picked.push(c.id);
      ov.remove();
      onPicked?.(c);
    });
    document.body.appendChild(ov);
    ov.querySelector('.rl-card')?.focus();
  },
};
