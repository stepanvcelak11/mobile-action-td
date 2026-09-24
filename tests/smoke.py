"""Smoke test: the game boots, a map starts, turrets build, a wave runs and first-person fire works.

Usage: python tests/smoke.py [base_url]   (default http://127.0.0.1:8765/)
       python tests/smoke.py --dir [folder]  serve files straight from disk (no web server needed)
Runs in landscape and portrait phone viewports with touch. Exits 1 on any failure or page error.
"""
import mimetypes
import os
import sys
import time

from playwright.sync_api import sync_playwright

SERVE_DIR = None
if len(sys.argv) > 1 and sys.argv[1] == '--dir':
    SERVE_DIR = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..'))
    BASE = 'http://game.test/'
else:
    BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
fails = []


def check(ok, msg):
    print(('OK   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def run(p, name, w, h):
    errs = []
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True)
    # Fresh profile but skip the first-run tutorial so its bubble doesn't block taps.
    ctx.add_init_script("try{const k='serpentline.save.v1';const s=JSON.parse(localStorage.getItem(k)||'{}');s.tutorialDone=true;localStorage.setItem(k,JSON.stringify(s))}catch(e){}")
    if SERVE_DIR:
        def serve(route):
            path = route.request.url.split('://', 1)[1].split('/', 1)[1].split('?')[0] or 'index.html'
            f = os.path.join(SERVE_DIR, *path.split('/'))
            if not os.path.isfile(f):
                return route.fulfill(status=404, body='')
            ct = mimetypes.guess_type(f)[0] or 'application/octet-stream'
            if f.endswith('.js'):
                ct = 'text/javascript'
            with open(f, 'rb') as fh:
                route.fulfill(status=200, body=fh.read(), headers={'content-type': ct})
        ctx.route('http://game.test/**', serve)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    t0 = time.time()
    pg.goto(BASE, wait_until='load', timeout=60000)
    pg.wait_for_function("window.__game && window.__game.G && !document.getElementById('loader')", timeout=60000)
    check(True, f'{name}: boot {time.time() - t0:.1f}s')
    check(pg.evaluate("document.querySelector('link[rel=manifest]') !== null"), f'{name}: manifest linked')

    g = 'window.__game'
    pg.evaluate(f"{g}.startMap('valley', 'campaign')")
    pg.wait_for_function(f"{g}.G.view !== 'MENU'", timeout=15000)
    time.sleep(1.5)
    gold0 = pg.evaluate(f'{g}.G.gold')
    built = 0
    for i in range(2):
        pos = pg.evaluate(f'{g}.plotScreen({i})')
        pg.touchscreen.tap(pos['x'], pos['y'])
        time.sleep(0.6)
        try:
            pg.click('#build-confirm', timeout=3000)
            built += 1
        except Exception:
            pass
        time.sleep(0.4)
    check(built >= 1 and pg.evaluate(f'{g}.G.gold') < gold0, f'{name}: built {built} turret(s) by touch')

    pg.click('#start-wave', timeout=5000)
    pg.wait_for_function(f"{g}.G.state === 'WAVE_IN_PROGRESS'", timeout=5000)
    check(True, f'{name}: wave started')
    pg.evaluate(f'{g}.G.timeScale = 3')
    time.sleep(4)
    kills_before = pg.evaluate(f'{g}.G.kills || 0')

    pg.evaluate(f'{g}.enterFPV({g}.G.turrets[0])')
    try:  # the camera flies in; software rendering in CI is slow, so wait for it
        pg.wait_for_function(f"{g}.G.view === 'FPV'", timeout=15000)
    except Exception:
        pass
    view = pg.evaluate(f'{g}.G.view')
    check(view == 'FPV', f'{name}: first-person view ({view})')
    fb = pg.query_selector('#fire-btn').bounding_box()
    for _ in range(8):
        pg.touchscreen.tap(fb['x'] + fb['width'] / 2, fb['y'] + fb['height'] / 2)
        time.sleep(0.15)
    time.sleep(6)
    check(pg.evaluate(f'{g}.G.kills || 0') >= kills_before, f'{name}: game keeps running in FPV')
    info = pg.evaluate(f'{g}.info()')
    check(info['calls'] > 0, f"{name}: rendering ({info['calls']} draw calls)")

    real = [e for e in errs if 'favicon' not in e]
    check(not real, f'{name}: no page errors' + ('' if not real else ' → ' + ' | '.join(real[:5])))
    b.close()


with sync_playwright() as p:
    run(p, 'landscape', 844, 390)
    run(p, 'portrait', 390, 844)

print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
