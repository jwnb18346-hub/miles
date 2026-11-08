// 首页：标题入场、括号物件轮换、介绍区、作品图带。
import {clamp, range, eio, panelStage, subscribe, PH, reduced, siteReady, state} from './core.js';
import {drive} from './words.js';

export function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  hero.querySelectorAll('[data-only]').forEach(g => g.querySelectorAll('.hero-word').forEach((w, i) => { w.style.animationDelay = `${90 * i}ms`; }));
  siteReady.then(() => hero.classList.add('hero-pronto'));
  const hint = hero.querySelector('.scroll-hint');
  subscribe(({y}) => { if (hint) hint.style.opacity = String(1 - clamp(y / 120, 0, 1)); }, PH.CONSUMER);
  if (reduced) return;
  hero.querySelectorAll('[data-swap]').forEach((slot, n) => {
    const kids = [...slot.children];
    if (kids.length < 2) return;
    let i = 0;
    setInterval(() => {
      kids[i].classList.remove('on');
      i = (i + 1) % kids.length;
      kids[i].classList.add('on');
    }, 1800 + n * 260);
  });
}

export function initIntro() {
  const sec = document.querySelector('[data-intro]');
  if (!sec) return;
  const text = sec.querySelector('.intro-text'), strip = sec.querySelector('.intro-strip');
  const target = text.querySelector('[data-words]');
  if (reduced) { return; }
  const logoBase = 1 + (1.2 - 1) * .45;
  subscribe(({velocity}) => {
    const {enter, exit} = panelStage(sec.getBoundingClientRect(), innerHeight);
    drive(target, range(enter, .1, .92));
    const s = eio(enter), o = eio(range(exit, .12, .9)), c = eio(range(exit, .18, .95));
    const m = clamp(3.4 * velocity, -2.2, 2.2);
    text.style.transform = `translate3d(0,${((1 - s) * 40 - 26 * o).toFixed(1)}px,0) scale(${(1.2 - .2 * s + .16 * o).toFixed(4)}) skewX(${m.toFixed(2)}deg)`;
    text.style.opacity = (1 - c).toFixed(3);
    const blur = c < .002 ? 0 : +(5 * c).toFixed(2);
    text.style.filter = blur ? `blur(${blur}px)` : 'none';
    if (strip) {
      strip.style.transform = `translate3d(0,${((1 - s) * 20 - 16 * o).toFixed(1)}px,0) scale(${(logoBase + (1 - logoBase) * s + .1 * o).toFixed(4)})`;
      strip.style.opacity = (1 - c).toFixed(3);
    }
  }, PH.CONSUMER);
}

export function initFeatures() {
  document.querySelectorAll('[data-feature]').forEach(sec => {
    const panel = sec.querySelector('.feature-sticky'), rail = sec.querySelector('.rail'), track = sec.querySelector('.rail-track'), copy = sec.querySelector('.feature-copy');
    if (reduced) { rail.style.transform = 'scale(1)'; rail.style.width = '100%'; rail.style.marginLeft = '0'; copy.style.opacity = 1; return; }
    let x = 0, enter = 0, exit = 0, t = 0, pin = 0, v = 0, scale = .88, period = 1, last = performance.now(), raf = 0, visible = true;
    const size = () => { const f = track.firstElementChild; if (f) period = Math.max(1, f.getBoundingClientRect().width / (track.getBoundingClientRect().width / track.offsetWidth || 1)); };
    size();
    new ResizeObserver(size).observe(track);
    let dragging = false, sx = 0, sy = 0, sTrack = 0, locked = false, pid = -1;
    const frame = now => {
      raf = 0;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      if (!dragging) x += (24 + 800 * Math.abs(v)) * dt + 24 * v;
      x = (x % period + period) % period;
      track.style.transform = `translate3d(${(-(x + 380 * t) % period).toFixed(2)}px,0,0)`;
      if (visible) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); kick(); } }, {rootMargin: '20% 0px 20% 0px'}).observe(sec);
    rail.addEventListener('pointerdown', e => {
      dragging = true; sx = e.clientX; sy = e.clientY; sTrack = x; pid = e.pointerId;
      locked = e.pointerType !== 'touch' && e.pointerType !== 'pen';
      try { rail.setPointerCapture(pid); } catch {}
      kick();
    });
    let moved = false;
    addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      if (!locked) {
        const ay = Math.abs(e.clientY - sy), ax = Math.abs(dx);
        if (ax < 6 && ay < 6) return;
        if (ay > ax) { dragging = false; try { rail.releasePointerCapture(pid); } catch {} return; }
        locked = true; sx = e.clientX; sTrack = x; return;
      }
      if (Math.abs(dx) > 4) moved = true;
      x = sTrack - dx / scale;
    }, {passive: true});
    const up = e => { if (!dragging) return; dragging = false; try { rail.releasePointerCapture(e.pointerId); } catch {} };
    addEventListener('pointerup', up, {passive: true});
    addEventListener('pointercancel', up, {passive: true});
    rail.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    subscribe(({velocity}) => {
      const vh = innerHeight;
      const st = panelStage(panel.getBoundingClientRect(), vh);
      enter = st.enter; exit = st.exit; t = st.t;
      const r = sec.getBoundingClientRect(), h = r.height - vh;
      pin = h > 0 ? clamp(-r.top / h, 0, 1) : 0;
      v = velocity;
      scale = .88 + .12 * eio(enter) + .07 * eio(pin) + .04 * exit;
      rail.style.transform = `scale(${scale.toFixed(4)})`;
      const e = eio(range(enter, .15, .78));
      copy.style.transform = e >= .999 ? 'none' : `translate3d(0,${((1 - e) * 26).toFixed(1)}px,0)`;
      copy.style.opacity = e.toFixed(3);
      kick();
    }, PH.CONSUMER);
  });
}
