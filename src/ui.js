// 走马灯、.reveal、自定义光标、导航反色、页面转场、loader。
import {clamp, range, eio, subscribe, PH, state, reduced, markReady} from './core.js';

/* ---------- 走马灯 ---------- */
export function initMarquees() {
  document.querySelectorAll('[data-marquee]').forEach(root => {
    const outer = root.querySelector('.mq-parallax'), skew = root.querySelector('.mq-skew'), track = root.querySelector('.mq-track');
    const first = track.firstElementChild;
    const fill = () => {
      [...track.children].slice(1).forEach(c => c.remove());
      const w = first.getBoundingClientRect().width;
      if (w < 1) return;
      const n = 2 * (Math.ceil(root.clientWidth / w) + 1);
      for (let i = 1; i < n; i++) { const c = first.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); }
    };
    fill();
    document.fonts?.ready.then(fill);
    new ResizeObserver(fill).observe(root);
    window.addEventListener('miles:lang', fill);
    if (reduced) return;
    const flush = root.hasAttribute('data-flush');
    const zoom = parseFloat(root.dataset.zoom || '1');
    const zoomEl = root.querySelector('.mq-zoom');
    subscribe(({velocity}) => {
      const r = root.getBoundingClientRect();
      const vh = innerHeight;
      if (r.bottom < -80 || r.top > vh + 80) return;
      const cy = r.top + r.height / 2;
      if (!flush) outer.style.transform = `translate3d(0,${clamp(-.06 * (cy - vh / 2), -24, 24).toFixed(1)}px,0)`;
      skew.style.transform = `skewX(${clamp(8 * velocity, -6, 6).toFixed(2)}deg)`;
      if (zoom !== 1 && zoomEl) zoomEl.style.transform = `scale(${(zoom + (1 - zoom) * eio(range(vh - cy, -.1 * vh, .55 * vh))).toFixed(4)})`;
    }, PH.CONSUMER);
  });
}

/* ---------- .reveal ---------- */
export function initReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-visible');
    io.unobserve(e.target);
  }), {rootMargin: '0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach((el, i, list) => {
    const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.transitionDelay = `${Math.min(240, siblings.indexOf(el) * 60)}ms`;
    io.observe(el);
  });
}

/* ---------- 光标 ---------- */
export function initCursor() {
  if (matchMedia('(pointer: coarse)').matches || reduced) return;
  const dot = document.querySelector('.cursor-dot');
  if (!dot) return;
  document.body.classList.add('custom-cursor-on');
  let active = false, x = 0, y = 0;
  const apply = () => { dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)${active ? ' rotate(45deg) scale(1.3)' : ''}`; };
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY; apply();
    dot.classList.toggle('is-drag', !!e.target.closest?.('[data-cursor="drag"]') || document.body.dataset.cursorDrag === '1');
  }, {passive: true});
  addEventListener('pointerdown', () => { active = true; dot.classList.add('is-active'); apply(); }, {passive: true});
  addEventListener('pointerup', () => { active = false; dot.classList.remove('is-active'); apply(); }, {passive: true});
}

/* ---------- 导航反色 ---------- */
const lumaCache = new WeakMap();
function sampleLuma(el) {
  if (lumaCache.has(el)) return lumaCache.get(el);
  const w = el.naturalWidth || el.videoWidth;
  if (!w) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  try {
    const g = c.getContext('2d', {willReadFrequently: true});
    g.drawImage(el, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data, out = new Float32Array(64);
    for (let i = 0; i < 64; i++) out[i] = (.2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]) / 255;
    if (el.tagName === 'IMG') lumaCache.set(el, out);
    return out;
  } catch { return null; }
}
function lumaAt(el, x, y) {
  const map = sampleLuma(el);
  if (!map) return .1;
  const r = el.getBoundingClientRect();
  const iw = el.naturalWidth || el.videoWidth, ih = el.naturalHeight || el.videoHeight;
  const s = Math.max(r.width / iw, r.height / ih);
  const ox = (r.width - iw * s) / 2, oy = (r.height - ih * s) / 2;
  const u = clamp((x - r.left - ox) / (iw * s), 0, .999), v = clamp((y - r.top - oy) / (ih * s), 0, .999);
  return map[Math.floor(v * 8) * 8 + Math.floor(u * 8)];
}
function isLightBehind(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest('[data-nav-bar]') || el.classList.contains('cursor-dot')) continue;
    if (el.closest('[data-light-surface]')) return true;
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO') return lumaAt(el, x, y) > .58;
    if (el.tagName === 'CANVAS') continue;
    const bg = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (bg && (bg.length < 4 || +bg[3] > .85)) return (.2126 * bg[0] + .7152 * bg[1] + .0722 * bg[2]) / 255 > .58;
  }
  return false;
}
export function initNavPaint() {
  const items = [...document.querySelectorAll('[data-nav-item]')];
  let last = 0;
  const paint = () => {
    for (const it of items) {
      const r = it.getBoundingClientRect();
      if (!r.width) continue;
      const light = isLightBehind(r.left + r.width / 2, r.top + r.height / 2);
      it.style.color = light ? '#0a0a0a' : it.dataset.navColor;
    }
  };
  subscribe(({now}) => { if (now - last >= 90) { last = now; paint(); } }, PH.OVERLAY);
}

/* ---------- 页面转场（多页站：离开时盖上，到达时揭开） ---------- */
const CASE = /^work\/[^/]+\/?$/;
const EASE = 'cubic-bezier(0.7, 0, 0.3, 1)';
export function initTransitions() {
  const root = document.documentElement, wipe = document.querySelector('.page-wipe'), main = document.querySelector('main');
  const basePath = new URL(document.baseURI).pathname;
  const rel = p => p.startsWith(basePath) ? p.slice(basePath.length) : p;
  const arriving = root.dataset.arrive;
  delete root.dataset.arrive;
  try { sessionStorage.removeItem('miles-arrive'); } catch {}
  if (arriving === 'wipe' && !reduced) {
    root.style.overflowY = 'clip';
    wipe.animate([{transform: 'translate3d(0,0,0)'}, {transform: 'translate3d(0,-100%,0)'}], {duration: 720, easing: EASE, fill: 'forwards'});
    main.animate([{transform: `translate3d(0,${.26 * innerHeight}px,0)`}, {transform: 'translate3d(0,0,0)'}], {duration: 940, easing: 'cubic-bezier(0.33, 0, 0.15, 1)'}).finished.finally(() => {
      root.style.overflowY = '';
      wipe.getAnimations().forEach(a => a.cancel());
      root.classList.remove('wipe-in');
    });
  } else {
    root.classList.remove('wipe-in');
    if (arriving === 'fade' && !reduced) main.animate([{opacity: 0, filter: 'blur(12px)'}, {opacity: 1, filter: 'blur(0px)'}], {duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)'});
  }
  addEventListener('pageshow', e => { if (e.persisted) { wipe.getAnimations().forEach(a => a.cancel()); main.getAnimations().forEach(a => a.cancel()); root.classList.remove('wipe-in'); busy = false; } });
  let busy = false;
  if (reduced) return;
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(basePath)) return;
    if (/\.(pdf|mp4|jpg|png)$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;
    if (busy) { e.preventDefault(); return; }
    const to = rel(url.pathname), from = rel(location.pathname);
    if (!CASE.test(to) && !CASE.test(from)) { try { sessionStorage.setItem('miles-arrive', 'fade'); } catch {} return; }
    e.preventDefault();
    busy = true;
    try { sessionStorage.setItem('miles-arrive', 'wipe'); } catch {}
    wipe.style.pointerEvents = 'auto';
    main.animate([{transform: 'translate3d(0,0,0)'}, {transform: `translate3d(0,${-.09 * innerHeight}px,0)`}], {duration: 540, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards'});
    wipe.animate([{transform: 'translate3d(0,100%,0)'}, {transform: 'translate3d(0,0,0)'}], {duration: 540, easing: EASE, fill: 'forwards'}).finished.finally(() => { location.href = url.href; });
  }, true);
}

/* ---------- loader ---------- */
const MIN_MS = 2000, MAX_MS = 6500, OUT_MS = 900;
export function initLoader() {
  const el = document.querySelector('.site-loader');
  if (!el || document.documentElement.dataset.skipLoader || reduced) { el?.remove(); markReady(); return; }
  try { sessionStorage.setItem('miles-loading', '1'); } catch {}
  const t0 = performance.now();
  let done = false;
  const leave = () => {
    if (done) return;
    done = true;
    markReady();
    el.style.opacity = 0;
    el.style.filter = 'blur(18px)';
    el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), OUT_MS);
  };
  const onLoad = () => setTimeout(leave, Math.max(0, MIN_MS - (performance.now() - t0)));
  if (document.readyState === 'complete') onLoad(); else addEventListener('load', onLoad, {once: true});
  setTimeout(leave, MAX_MS);
}
