// iPhone Safari can't hide its toolbars from a web page; only a home-screen app runs truly full
// screen. Once per day (in Safari, not already installed) show how to add the game to the home screen.
const KEY = 'serpentline.installhint';
const ua = navigator.userAgent;
const iPhone = /iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && screen.width < 820);
const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
const inSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

function show() {
  if (document.getElementById('ios-install')) return;
  if (document.body.classList.contains('ingame')) { setTimeout(show, 4000); return; }
  const el = document.createElement('div');
  el.id = 'ios-install';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>For <b>full screen</b>: tap <svg class="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Share"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg> Share, then <b>Add to Home Screen</b> and play from the icon.</span><button type="button">OK</button>`;
  el.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); el.remove(); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

if (iPhone && inSafari && !standalone && !navigator.webdriver) {
  let last = 0;
  try { last = +localStorage.getItem(KEY) || 0; } catch { /* private mode */ }
  if (Date.now() - last > 86400000) {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setTimeout(show, 2500);
  }
}
