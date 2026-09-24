// Campaign as a journey: a world map with chapters, short radio talk before and after each map,
// and a Hard version of every map unlocked by 3 stars.
//
//   import { campaign } from './campaign.js';
//   campaign.openMap({ state: (id) => ({ unlocked, stars }), onPlay: (id, hard) => … });  // full-screen world map
//   await campaign.talk(mapId, 'before' | 'after' | 'boss');   // radio dialogue, resolves when closed
//   campaign.hard(mapId)            // → difficulty multipliers for Hard: { hp, speed, count, gold, extraWaves }
//   campaign.hardDone(mapId) / campaign.markHard(mapId)

const KEY = 'serpentline.campaign.v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
const S = { seen: {}, hard: {}, ...load() };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }

export const CHAPTERS = [
  { name: 'Chapter 1 · The Green Frontier', maps: ['valley', 'dunes'] },
  { name: 'Chapter 2 · Cold Steel', maps: ['frost', 'canyon'] },
  { name: 'Chapter 3 · The Serpent\'s Nest', maps: ['swamp', 'magma', 'neon'] },
];
// Node positions on the world map (0–100 × 0–60 units).
const NODES = {
  valley: [12, 44], dunes: [28, 30], frost: [44, 14], canyon: [56, 36], swamp: [70, 50], magma: [82, 28], neon: [92, 10],
};
const NAMES = { valley: 'Green Valley', dunes: 'Dune Sea', frost: 'Frostbite Pass', canyon: 'Red Canyon', swamp: 'Toxic Swamp', magma: 'Magma Core', neon: 'Neon Ruins' };

// Two voices: HQ (your side) and VIPER (the enemy commander).
const TALK = {
  valley: {
    before: [['HQ', 'Commander, the Serpent swarm is crossing the valley. One road, one base. Hold it.'], ['HQ', 'Build on the pads, then climb into a turret. Nobody aims like you do.']],
    after: [['VIPER', 'A lucky valley. The desert will not be so kind.'], ['HQ', 'That\'s their commander, Viper. We follow the swarm south.']],
  },
  dunes: {
    before: [['HQ', 'The Dune Sea. Long road, no cover — they\'ll come in waves of armour.'], ['VIPER', 'Your guns will choke on sand.']],
    after: [['HQ', 'Tracks in the sand lead north, into the mountains.']],
  },
  frost: {
    before: [['HQ', 'Two roads meet before the base. Split your fire.'], ['VIPER', 'Let\'s see how you aim with frozen fingers.']],
    after: [['HQ', 'Viper pulled back into the canyon. Tight turns — perfect for an ambush.']],
  },
  canyon: {
    before: [['VIPER', 'My Guardians carry shields now. Your little shells will bounce.'], ['HQ', 'Shoot the generators on their backs, Commander.']],
    after: [['HQ', 'We found the source: a nest in the swamp. Chapter three.']],
  },
  swamp: {
    before: [['HQ', 'Phantoms in the fog. Auto turrets won\'t see them — you will.'], ['VIPER', 'You can\'t shoot what you can\'t see.']],
    after: [['VIPER', 'Come to the volcano, then. Come and burn.']],
  },
  magma: {
    before: [['HQ', 'A spiral into the core. Bosses everywhere. This is it.'], ['VIPER', 'Every Behemoth I own is waiting for you.']],
    after: [['HQ', 'The core is quiet. But the signal comes from the old city...']],
  },
  neon: {
    before: [['VIPER', 'Three gates. One base. Night. Welcome to my home.'], ['HQ', 'Last stand, Commander. Make every shot count.']],
    after: [['HQ', 'Viper is down. The Serpent Line is broken. Outstanding work, Commander.'], ['HQ', 'Hard mode is open on every map with 3 stars. The swarm always comes back.']],
  },
};
const BOSS_LINES = [['VIPER', 'Behemoth, crush them!'], ['VIPER', 'Your base looks tired, Commander.'], ['VIPER', 'Here comes the big one.']];

/* ------------------------------------------------------------------- CSS */
let css = false;
function ensureCss() {
  if (css) return;
  css = true;
  const s = document.createElement('style');
  s.textContent = `
  #cp-map{position:fixed;inset:0;z-index:55;background:radial-gradient(120% 90% at 30% 20%,#1d2a22,#0b0f14 70%);color:var(--text,#eee);display:flex;flex-direction:column;
    padding:calc(var(--sat,0px) + 10px) calc(var(--sar,0px) + 12px) calc(var(--sab,0px) + 10px) calc(var(--sal,0px) + 12px)}
  #cp-map header{display:flex;align-items:center;justify-content:space-between;gap:10px}
  #cp-map header b{font-weight:900;letter-spacing:.12em;font-size:14px;color:var(--accent-2,#ffcf5a)}
  #cp-map header button{border:1px solid var(--panel-border,#333);background:var(--panel,#0008);color:inherit;border-radius:10px;padding:6px 12px;font-weight:800;cursor:pointer}
  #cp-map .cp-wrap{flex:1;min-height:0;display:grid;place-items:center}
  #cp-map svg{width:100%;height:100%;max-height:100%}
  #cp-map .cp-node{cursor:pointer}
  #cp-map .cp-node:focus-visible circle.ring{stroke:#fff;stroke-width:1}
  #cp-map .cp-sheet{margin:0 auto;width:min(520px,100%);padding:12px 14px;border-radius:14px;background:var(--panel-solid,#12171f);border:1px solid var(--panel-border,#333);display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  #cp-map .cp-sheet small{display:block;color:var(--muted,#9aa);font-weight:700;font-size:11px;letter-spacing:.08em}
  #cp-map .cp-sheet b{font-size:17px}
  #cp-map .cp-sheet .btns{display:flex;gap:8px}
  #cp-map .cp-sheet button{border:0;border-radius:11px;padding:9px 16px;font-weight:900;letter-spacing:.05em;cursor:pointer}
  #cp-map .go{background:linear-gradient(180deg,#ffb04a,#f07f12);color:#1c1206}
  #cp-map .hard{background:linear-gradient(180deg,#ff6a6a,#b8202a);color:#fff}
  #cp-map .hard[disabled]{opacity:.4;cursor:default}
  #cp-talk{position:fixed;left:50%;top:calc(var(--sat,0px) + 150px);transform:translateX(-50%);z-index:58;width:min(560px,calc(100% - 24px));display:flex;gap:12px;align-items:flex-start;
    padding:12px 14px;border-radius:16px;background:var(--panel-solid,#12171f);border:1px solid var(--panel-border,#333);box-shadow:var(--shadow);pointer-events:none;animation:cpIn .3s ease-out both}
  #cp-talk .who{flex:none;width:46px;height:46px;border-radius:12px;display:grid;place-items:center;font-weight:900;font-size:12px;letter-spacing:.06em}
  #cp-talk .who.HQ{background:linear-gradient(160deg,#4ab0ff,#1f5fa8);color:#fff}
  #cp-talk .who.VIPER{background:linear-gradient(160deg,#ff6a6a,#8a1020);color:#fff}
  #cp-talk p{margin:2px 52px 0 0;font-size:14px;line-height:1.4;font-weight:600}
  #cp-talk small{display:block;font-size:11px;color:var(--muted,#9aa);font-weight:800;letter-spacing:.1em}
  #cp-talk .tap{position:absolute;right:6px;top:6px;pointer-events:auto;border:0;background:var(--panel-2,#fff1);color:var(--muted,#9aa);font-weight:800;font-size:12px;border-radius:9px;padding:6px 10px;cursor:pointer}
  @media (orientation:landscape){#cp-talk{top:calc(var(--sat,0px) + 70px)}}
  #result.show ~ #cp-talk,#cp-talk.on-result{top:calc(var(--sat,0px) + 12px)}
  @keyframes cpIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`;
  document.head.appendChild(s);
}

const star = (on, x, y) => `<path d="M${x} ${y - 1.6}l.47 1.1 1.2.1-.9.8.28 1.17-1.05-.63-1.05.63.28-1.17-.9-.8 1.2-.1z" fill="${on ? '#ffcf5a' : '#3a4452'}"/>`;

export const campaign = {
  CHAPTERS,
  /** Hard mode multipliers. */
  hard: () => ({ hp: 1.6, speed: 1.12, count: 1.25, gold: 1.1, extraWaves: 2 }),
  hardDone: (id) => !!S.hard[id],
  markHard(id) { S.hard[id] = true; save(); },

  /** Full-screen world map. state(id) → { unlocked, stars }. */
  openMap({ state, onPlay, onClose } = {}) {
    ensureCss();
    document.getElementById('cp-map')?.remove();
    const ids = Object.keys(NODES);
    let sel = ids.filter((id) => state(id).unlocked).pop() || 'valley';
    const ov = document.createElement('div');
    ov.id = 'cp-map';
    // On a tall screen the journey runs bottom → top instead of left → right.
    const tall = () => window.innerHeight > window.innerWidth * 1.15;
    const pos = (id) => (tall() ? [8 + NODES[id][1] * 0.8, 100 - NODES[id][0]] : NODES[id]);
    const draw = () => {
      const road = ids.map((id, i) => `${i ? 'L' : 'M'}${pos(id)[0]} ${pos(id)[1]}`).join(' ');
      const nodes = ids.map((id) => {
        const st = state(id);
        const [x, y] = pos(id);
        const col = !st.unlocked ? '#3a4452' : S.hard[id] ? '#ff6a6a' : st.stars >= 3 ? '#ffcf5a' : '#4ab0ff';
        return `<g class="cp-node" data-id="${id}" tabindex="0" role="button" aria-label="${NAMES[id]}">
          ${id === sel ? `<circle cx="${x}" cy="${y}" r="5.4" fill="none" stroke="${col}" stroke-width=".5" opacity=".7"><animate attributeName="r" values="4.6;6;4.6" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
          <circle class="ring" cx="${x}" cy="${y}" r="3.6" fill="#0b0f14" stroke="${col}" stroke-width=".8"/>
          <text x="${x}" y="${y + 1.1}" text-anchor="middle" font-size="3" font-weight="900" fill="${st.unlocked ? '#fff' : '#6a7482'}">${st.unlocked ? ids.indexOf(id) + 1 : '–'}</text>
          ${st.unlocked ? star(st.stars >= 1, x - 2.4, y + 6.5) + star(st.stars >= 2, x, y + 6.5) + star(st.stars >= 3, x + 2.4, y + 6.5) : ''}
          <text x="${x}" y="${y - 5.2}" text-anchor="middle" font-size="2.4" font-weight="800" stroke="#0b0f14" stroke-width=".9" paint-order="stroke" fill="${st.unlocked ? '#dfe6ee' : '#6a7482'}">${NAMES[id]}</text></g>`;
      }).join('');
      const labels = '';
      const st = state(sel);
      const three = st.stars >= 3;
      ov.innerHTML = `<header><b>WORLD MAP</b><button type="button" class="close">CLOSE</button></header>
        <div class="cp-wrap"><svg viewBox="${tall() ? '0 -4 64 112' : '0 0 104 64'}" preserveAspectRatio="xMidYMid meet">
          <path d="${road}" fill="none" stroke="#2a3a30" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${road}" fill="none" stroke="#c9a46a" stroke-width=".6" stroke-dasharray="1.4 1.4" stroke-linecap="round"/>
          ${labels}${nodes}</svg></div>
        <div class="cp-sheet"><div><small>${CHAPTERS.find((c) => c.maps.includes(sel)).name.toUpperCase()}</small><b>${NAMES[sel]}</b></div>
          <div class="btns"><button type="button" class="go" ${st.unlocked ? '' : 'disabled'}>PLAY</button>
          <button type="button" class="hard" ${three ? '' : 'disabled'} title="${three ? 'Tougher enemies, 2 more waves' : 'Needs 3 stars'}">HARD${S.hard[sel] ? ' ✓' : ''}</button></div></div>`;
    };
    draw();
    const close = () => { ov.remove(); onClose?.(); };
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    ov.addEventListener('click', (e) => {
      e.stopPropagation();
      const n = e.target.closest('.cp-node');
      if (n) { sel = n.dataset.id; draw(); return; }
      if (e.target.closest('.close')) close();
      else if (e.target.closest('.go') && state(sel).unlocked) { ov.remove(); onPlay?.(sel, false); }
      else if (e.target.closest('.hard') && state(sel).stars >= 3) { ov.remove(); onPlay?.(sel, true); }
    });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      const n = e.target.closest?.('.cp-node');
      if (n && (e.key === 'Enter' || e.key === ' ')) { sel = n.dataset.id; draw(); }
    });
    document.body.appendChild(ov);
  },

  /** Radio talk. 'before' plays once per map (unless force), 'after' after each first win, 'boss' a single line. */
  talk(mapId, when = 'before', { force = false } = {}) {
    const lines = when === 'boss' ? [BOSS_LINES[(Math.random() * BOSS_LINES.length) | 0]] : TALK[mapId]?.[when];
    const seenKey = mapId + ':' + when;
    if (!lines || (!force && when !== 'boss' && S.seen[seenKey])) return Promise.resolve();
    if (when !== 'boss') { S.seen[seenKey] = true; save(); }
    ensureCss();
    return new Promise((resolve) => {
      let i = 0;
      const box = document.createElement('div');
      box.id = 'cp-talk';
      box.setAttribute('role', 'status');
      const show = () => {
        const [who, text] = lines[i];
        box.innerHTML = `<div class="who ${who}">${who}</div><div><small>${who === 'HQ' ? 'HEADQUARTERS' : 'ENEMY COMMANDER'}</small><p>${text}</p></div><button type="button" class="tap" aria-label="${i < lines.length - 1 ? 'Next' : 'Close'}">${i < lines.length - 1 ? 'NEXT ›' : '✕'}</button>`;
      };
      let timer = 0;
      const next = () => {
        clearTimeout(timer);
        i++;
        if (i >= lines.length) { box.remove(); resolve(); return; }
        show();
        timer = setTimeout(next, 5500);
      };
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      box.addEventListener('click', (e) => { if (!e.target.closest('.tap')) return; e.stopPropagation(); next(); });
      document.getElementById('cp-talk')?.remove();
      document.body.appendChild(box);
      show();
      timer = setTimeout(next, when === 'boss' ? 3000 : 5500);
    });
  },
};
