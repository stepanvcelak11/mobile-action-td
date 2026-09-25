// Czech translation layer (C1). The game is written in English; this module translates what reaches
// the screen, so no other file needs to change:
//   • DOM text nodes and placeholder / aria-label / title attributes (MutationObserver),
//   • canvas text (bunker signs, status board, map table, mini map) by wrapping fillText/strokeText.
// Lookup order: exact text → the same text with its numbers as '#' → piece by piece around
// separators (·, —, →, :, numbers…), so templated strings like "WAVE 3" or "Twin Cannon → LEVEL 4" work.
// Language: Settings → Language (cs / en), stored in the save; default Czech on Czech/Slovak phones.
import CS from './lang-cs.js';

function savedLang() {
  try {
    const key = localStorage.getItem('serpentline.mode') === 'sandbox' ? 'serpentline.sandbox.v1' : 'serpentline.save.v1';
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    if (s?.settings?.lang) return s.settings.lang;
  } catch { /* ignore */ }
  return /^(cs|sk)\b/i.test(navigator.language || '') ? 'cs' : 'en';
}
export const lang = savedLang();
document.documentElement.lang = lang;

const NUM = /\d+(?:[.,]\d+)?/g;
const SEP = /(\s*(?:·|—|–|→|←|∞|:|\||\/|\(|\)|\[|\]|•|!|\?|\+?-?\d+(?:[.,]\d+)?[%.]?|×\s*\d*|\d+\s*[sm]\b)\s*)/;
const cache = new Map();

let lower = null;
function lookup(core) {
  const hit = CS.exact[core];
  if (hit !== undefined) return hit;
  // SHOUTED names ("ROCKET POD") use the normal entry, shouted back
  if (core === core.toUpperCase() && /[A-Z]/.test(core)) {
    if (!lower) { lower = new Map(); for (const k in CS.exact) lower.set(k.toLowerCase(), CS.exact[k]); }
    const l = lower.get(core.toLowerCase());
    if (l !== undefined) return l.toUpperCase();
  }
  if (/\d/.test(core)) {
    const nums = core.match(NUM);
    const pat = CS.pat[core.replace(NUM, '#')];
    if (pat !== undefined) { let i = 0; return pat.replace(/#/g, () => nums[i++] ?? '#'); }
  }
  return null;
}

/** Translate one string (returns it unchanged when English is on or nothing matches). */
export function tr(s) {
  if (lang !== 'cs' || typeof s !== 'string' || !/[A-Za-z]{2}/.test(s)) return s;
  const c = cache.get(s);
  if (c !== undefined) return c;
  const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
  const core = s.trim();
  let out = lookup(core);
  if (out === null) {
    // piece by piece around separators and numbers
    const parts = core.split(SEP);
    let changed = false;
    out = parts.map((p, i) => {
      if (i % 2 || !/[A-Za-z]{2}/.test(p)) return p;
      const t = lookup(p.trim());
      if (t === null) return p;
      changed = true;
      return p.replace(p.trim(), t);
    }).join('');
    if (!changed) { out = core; if (window.__i18nMiss && /[A-Za-z]{3}/.test(core)) window.__i18nMiss.add(core); }
  }
  const res = lead + out + tail;
  if (cache.size > 5000) cache.clear();
  cache.set(s, res);
  return res;
}
window.__t = tr;

if (lang === 'cs') {
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const skip = (n) => { const p = n.parentElement; return !p || p.closest('script,style,textarea,[data-noi18n]'); };
  const doText = (n) => {
    if (skip(n)) return;
    const t = tr(n.data);
    if (t !== n.data) n.data = t;
  };
  const doEl = (el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute?.(a);
      if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
    }
  };
  const walk = (root) => {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || root.closest?.('script,style,[data-noi18n]')) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else doEl(n); }
  };
  const start = () => {
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  // canvas text: signs, boards, map table, mini map, portraits
  const P = CanvasRenderingContext2D.prototype;
  for (const f of ['fillText', 'strokeText', 'measureText']) {
    const orig = P[f];
    P[f] = function (text, ...rest) { return orig.call(this, tr(String(text)), ...rest); };
  }
  // page title
  document.title = tr(document.title);
}
