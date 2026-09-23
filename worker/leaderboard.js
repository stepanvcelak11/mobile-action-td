// Serpent Line leaderboard (Cloudflare Worker + D1).
//   POST /daily        { day, pid, nick, score, wave }  → { rank }   (first score per player and day wins)
//   GET  /daily/:day                                     → { top: [{ nick, score, wave, pid }] }
//   GET  /health                                         → { ok: true }
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, pid TEXT NOT NULL, nick TEXT NOT NULL, score INTEGER NOT NULL, wave INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (day, pid))').run();
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/health') return json({ ok: true });
      await ensureTable(env.DB);
      if (req.method === 'POST' && url.pathname === '/daily') {
        const b = await req.json();
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (!DAY.test(b.day) || (b.day !== today && b.day !== yesterday)) return json({ error: 'day' }, 400);
        if (!/^[0-9a-f]{16}$/.test(b.pid || '')) return json({ error: 'pid' }, 400);
        const score = Math.round(Number(b.score));
        const wave = Math.round(Number(b.wave));
        // Plausibility: a wave scores at most 110 points.
        if (!(score >= 0 && wave >= 0 && wave <= 500 && score <= wave * 110 + 110)) return json({ error: 'score' }, 400);
        const nick = String(b.nick || 'Commander').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16) || 'Commander';
        await env.DB.prepare('INSERT OR IGNORE INTO daily (day, pid, nick, score, wave, at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(b.day, b.pid, nick, score, wave, Date.now()).run();
        const mine = await env.DB.prepare('SELECT score FROM daily WHERE day = ? AND pid = ?').bind(b.day, b.pid).first();
        const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM daily WHERE day = ? AND score > ?').bind(b.day, mine.score).first();
        return json({ rank: r.n + 1 });
      }
      const m = url.pathname.match(/^\/daily\/(\d{4}-\d{2}-\d{2})$/);
      if (req.method === 'GET' && m) {
        const { results } = await env.DB.prepare('SELECT nick, score, wave, pid FROM daily WHERE day = ? ORDER BY score DESC, at ASC LIMIT 50').bind(m[1]).all();
        return json({ top: results });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  },
};
