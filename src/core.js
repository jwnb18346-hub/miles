// 滚动总线：全站共用一个 rAF，按阶段分发；Lenis 只在桌面滚轮上平滑。
import Lenis from 'lenis';

const LENIS = {lerp: .085, smoothWheel: true, wheelMultiplier: 1, syncTouch: false, overscroll: false};
const VELOCITY_DIVISOR = 60, VELOCITY_SMOOTH = .18, VELOCITY_EPS = .0005;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const range = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
export const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const reduced = document.documentElement.dataset.motion
  ? document.documentElement.dataset.motion === 'reduce'
  : matchMedia('(prefers-reduced-motion: reduce)').matches;
export const PH = {DRIVER: 0, SCENE: 10, CONSUMER: 20, OVERLAY: 30};

export function panelStage(rect, vh) {
  const span = vh + rect.height;
  const t = clamp((vh - rect.top) / span, 0, 1);
  const dock = vh / span;
  return {t, dock, enter: clamp(t / dock, 0, 1), exit: clamp((t - dock) / (1 - dock), 0, 1)};
}

const subs = [];
export const state = {y: 0, velocity: 0, dt: 0, now: 0};
export function subscribe(fn, phase = PH.CONSUMER) {
  const item = {fn, phase};
  subs.push(item);
  subs.sort((a, b) => a.phase - b.phase);
  return () => subs.splice(subs.indexOf(item), 1);
}

export let lenis = null;
export function startBus() {
  if (!reduced) lenis = new Lenis({...LENIS, autoRaf: false});
  let lastY = window.scrollY, last = performance.now();
  const loop = now => {
    state.dt = Math.min(.1, (now - last) / 1000);
    last = now;
    state.now = now;
    lenis?.raf(now);
    const y = window.scrollY;
    const target = clamp((y - lastY) / VELOCITY_DIVISOR, -1, 1);
    lastY = y;
    state.y = y;
    state.velocity += (target - state.velocity) * VELOCITY_SMOOTH;
    if (Math.abs(state.velocity) < VELOCITY_EPS) state.velocity = 0;
    for (const s of subs.slice()) s.fn(state);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// 站点就绪（loader 结束）
let readyResolve;
export const siteReady = new Promise(r => { readyResolve = r; });
export const markReady = () => readyResolve();

export function assetText(el, key) { return el.getAttribute(`data-${key}`); }
export const lang = () => document.documentElement.dataset.lang || 'en';
