// Graphical upgrade tree: three branches fanning out of the turret, round icon nodes, info bar with BUY.
import { TREES, canBuy } from './trees.js';
import { fxIcon } from './icons.js';

// node positions in % of the graph box: one horizontal row per branch, tiers left → right
const ROWS = [18, 50, 82];
const COLS = [22, 38, 54, 70, 88];
const POS = ROWS.map((y) => COLS.map((x) => [x, y]));
const ROOT = [5, 50];

const mainFx = (node) => Object.keys(node.fx)[0];

/**
 * @param {HTMLElement} el container
 * @param {object} t turret (type, picks)
 * @param {object} o { gold, cost(branch), buy(branch), sel: {b, n}, onSelect(b, n) }
 */
export function renderTree(el, t, o) {
  const tree = TREES[t.type];
  const total = t.picks.reduce((a, b) => a + b, 0);
  let sel = o.sel;
  if (!sel) {
    // default: the cheapest next node that can be bought
    let best = null;
    tree.forEach((_, b) => { if (!canBuy(t.picks, b) && (!best || o.cost(b) < o.cost(best.b))) best = { b, n: t.picks[b] }; });
    sel = best || { b: 0, n: Math.min(4, t.picks[0]) };
  }
  const lines = tree.map((br, b) => {
    const pts = [ROOT, ...POS[b]];
    return pts.slice(1).map((p, i) => {
      const a = pts[i];
      const on = i < t.picks[b];
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${p[0]}" y2="${p[1]}" class="${on ? 'on' : ''}" style="--bc:${br.color}"/>`;
    }).join('');
  }).join('');
  const nodes = tree.map((br, b) => br.nodes.map((node, n) => {
    const owned = n < t.picks[b];
    const next = n === t.picks[b];
    const why = next ? canBuy(t.picks, b) : null;
    const buyable = next && !why;
    const cls = ['tnode', owned && 'owned', buyable && 'next', buyable && o.gold < o.cost(b) && 'poor', n === 4 && 'ult', sel.b === b && sel.n === n && 'sel'].filter(Boolean).join(' ');
    const [x, y] = POS[b][n];
    return `<button class="${cls}" style="left:${x}%;top:${y}%;--bc:${br.color}" data-b="${b}" data-n="${n}" aria-label="${node.name}">${fxIcon(mainFx(node))}${n === 4 ? '<i class="star">★</i>' : `<i>${n + 1}</i>`}</button>`;
  }).join('')).join('');
  const labels = tree.map((br, b) => `<span class="tlabel l${b}" style="--bc:${br.color}">${br.name}</span>`).join('');

  const node = tree[sel.b].nodes[sel.n];
  const owned = sel.n < t.picks[sel.b];
  const next = sel.n === t.picks[sel.b];
  const why = next ? canBuy(t.picks, sel.b) : sel.n > t.picks[sel.b] ? `Buy tier ${t.picks[sel.b] + 1} first` : null;
  const cost = next && !why ? o.cost(sel.b) : 0;
  const action = owned ? '<span class="tstate ok">OWNED</span>'
    : why ? `<span class="tstate">${why}</span>`
    : `<button class="btn primary tbuy" ${o.gold < cost ? 'disabled' : ''}>BUY · <span class="ico gold sm"></span>${cost}</button>`;

  el.innerHTML = `
    <div class="tgraph">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="troot">${o.rootIcon || ''}</div>
      ${labels}${nodes}
      <div class="tcount">${total}/10</div>
    </div>
    <div class="tinfo" style="--bc:${tree[sel.b].color}">
      <div class="tinfo-ico">${fxIcon(mainFx(node))}</div>
      <div class="tinfo-txt"><b>${node.name}${sel.n === 4 ? ' ★' : ''}</b><span>${node.desc}</span><small>${tree[sel.b].name} · tier ${sel.n + 1}</small></div>
      ${action}
    </div>`;
  el.querySelectorAll('.tnode').forEach((btn) => btn.addEventListener('click', () => {
    o.onSelect({ b: +btn.dataset.b, n: +btn.dataset.n });
  }));
  el.querySelector('.tbuy')?.addEventListener('click', () => o.buy(sel.b));
  return sel;
}
