// Voice lines (Z1): short radio calls spoken by the browser's speech synthesis — no audio files.
// Listens to sl:voice {line}; also calls out waves and low base HP. Off in Settings → Voice lines.
// At most one line every 2.5 s so it never chatters over the fight.
import { lang } from './i18n.js';

const LINES_EN = {
  move: ['Moving out!', 'On my way!', 'Roger that!'],
  tank: ['Tank crew ready!', 'Rolling out!'],
  air: ['Wheels up!', 'Gunship on station!'],
  reload: ['Reloading!', 'Changing mag!'],
  grenade: ['Frag out!', 'Grenade!'],
  para: ['Paratroopers away!', 'Troops on the ground!'],
  boss: ['Big one inbound!', 'Boss on the road — focus fire!'],
  wave: ['Here they come!', 'Contact!', 'Hostiles on the road!'],
  base: ['Base is taking hits!', 'We need backup at the base!'],
  win: ['Area secure!', 'Good work, commander!'],
  missile: ['Fox two!', 'Missiles away!'],
};
const LINES_CS = {
  move: ['Vyrážím!', 'Jsem na cestě!', 'Rozumím!'],
  tank: ['Posádka tanku připravena!', 'Jedeme!'],
  air: ['Startujeme!', 'Vrtulník na místě!'],
  reload: ['Přebíjím!', 'Měním zásobník!'],
  grenade: ['Granát!', 'Pozor, granát!'],
  para: ['Výsadek ven!', 'Vojáci na zemi!'],
  boss: ['Blíží se něco velkého!', 'Boss na cestě, soustřeďte palbu!'],
  wave: ['Už jdou!', 'Kontakt!', 'Nepřátelé na cestě!'],
  base: ['Základna dostává zásahy!', 'Potřebujeme posily u základny!'],
  win: ['Oblast zajištěna!', 'Dobrá práce, veliteli!'],
  missile: ['Rakety ven!', 'Odpaluji!'],
};
const LINES = lang === 'cs' ? LINES_CS : LINES_EN;
let last = 0;
let voiceObj = null;
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

function enabled() {
  const s = window.__game?.P?.settings;
  return !!synth && (s?.voice ?? true) && (s?.volume ?? 1) > 0.02;
}
function pickVoice() {
  if (voiceObj || !synth) return voiceObj;
  const vs = synth.getVoices().filter((v) => (lang === 'cs' ? /^cs/i : /^en/i).test(v.lang));
  voiceObj = vs.find((v) => /male|daniel|alex|fred|zdenek|google uk english male/i.test(v.name)) || vs[0] || null;
  return voiceObj;
}
export function say(line, force = false) {
  if (!enabled()) return;
  const now = performance.now();
  if (!force && now - last < 2500) return;
  const list = LINES[line];
  if (!list) return;
  last = now;
  const u = new SpeechSynthesisUtterance(list[(Math.random() * list.length) | 0]);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang || (lang === 'cs' ? 'cs-CZ' : 'en-US');
  u.rate = 1.12;
  u.pitch = 0.85;
  u.volume = Math.min(1, (window.__game?.P?.settings?.volume ?? 0.8) * 0.9);
  try { synth.cancel(); synth.speak(u); } catch { /* ignore */ }
}
synth?.addEventListener?.('voiceschanged', () => { voiceObj = null; });
window.addEventListener('sl:voice', (e) => say(e.detail?.line));
window.addEventListener('sl:match', (e) => { if (e.detail?.won) say('win', true); });
// low base HP: once per drop below 50 % and 25 %
let warned = 1;
setInterval(() => {
  const G = window.__game?.G;
  if (!G || G.view === 'MENU' || !G.maxHp) { warned = 1; return; }
  const f = G.baseHp / G.maxHp;
  if ((f < 0.5 && warned > 0.5) || (f < 0.25 && warned > 0.25)) { warned = f < 0.25 ? 0.25 : 0.5; say('base', true); }
  if (f >= 0.99) warned = 1;
}, 1000);
