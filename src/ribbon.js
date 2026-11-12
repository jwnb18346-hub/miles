// 手机和 WebGL 不可用时的吊牌：2D canvas 上的 Verlet 红绳 + 可翻转的 DOM 卡片。
import {subscribe, reduced} from './core.js';

const POINTS = 21, SEG = 19, WIDTH = 46, RED = '#ea4530', TEXT = 'miles';
const DAMP = .982, GRAVITY = 1600, MAX_DT = .032, SMOOTH = .2, ITER = 10, FIX = .485, PUSH_R = 190;

export function mountRibbon(host) {
  host.classList.add('ribbon-host');
  host.innerHTML = '<canvas></canvas><div class="tag"><div class="tag-back"></div><div class="tag-face"><i class="tag-shine"></i><i class="tag-strap"></i><i class="tag-hole"></i><div class="tag-art"></div></div></div>';
  const canvas = host.querySelector('canvas'), tag = host.querySelector('.tag'), strap = host.querySelector('.tag-strap'), hole = host.querySelector('.tag-hole'), art = host.querySelector('.tag-art');
  const tpl = document.getElementById('pass-art');
  if (tpl) art.append(tpl.content.cloneNode(true));
  const g = canvas.getContext('2d');
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif';
  let W = 0, H = 0, cx = 0, top = 0, seg = SEG, width = WIDTH, gap = WIDTH, tail = 0, halfText = 0, sized = -1, dpr = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); cx = W * .5;
    const a = Math.max(.44, Math.min(1, W / 900));
    width = WIDTH * a; seg = SEG * a; top = -5 * seg; tail = .5 * width; gap = width; sized = -1;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sw = Math.round(width), sh = Math.max(6, Math.round(.3 * width));
    strap.style.width = sw + 'px'; strap.style.height = sh + 'px';
    hole.style.width = Math.round(.55 * width) + 'px'; hole.style.height = Math.max(3, Math.round(.45 * sh)) + 'px'; hole.style.top = Math.round(.3 * sh) + 'px';
  };
  resize();
  new ResizeObserver(resize).observe(host);
  let P = Array.from({length: POINTS}, (_, i) => ({x: cx + (Math.random() - .5) * 2, y: top + i * seg * .55, px: cx, py: top + i * seg * .55, pin: i === 0}));
  const place = (x, y) => { tag.style.left = x + 'px'; tag.style.top = y + 'px'; tag.style.visibility = 'visible'; };
  if (reduced) {
    P = P.map((p, i) => ({...p, x: cx, y: top + i * seg}));
    const e = P[POINTS - 1];
    g.beginPath(); g.moveTo(P[0].x, P[0].y); P.forEach(p => g.lineTo(p.x, p.y)); g.lineTo(e.x, e.y + tail);
    g.lineWidth = width; g.strokeStyle = RED; g.stroke();
    place(e.x, e.y); tag.style.transform = 'translate(-50%,0)';
    return () => { host.innerHTML = ''; host.classList.remove('ribbon-host'); };
  }
  let drag = false, vx = 0, vy = 0, lastM = {x: 0, y: 0, t: 0}, flip = 0, spin = 0, push = 0, inView = true;
  let activePointer = null;
  const down = e => { if (activePointer !== null || e.button > 0) return; activePointer = e.pointerId; drag = true; vx = vy = 0; try { tag.setPointerCapture(e.pointerId); } catch {} tag.style.cursor = 'grabbing'; lastM = {x: e.clientX, y: e.clientY, t: performance.now()}; e.preventDefault(); };
  const move = e => {
    if (!drag || e.pointerId !== activePointer) return;
    const r = host.getBoundingClientRect(), end = P[POINTS - 1];
    end.x = e.clientX - r.left; end.y = e.clientY - r.top;
    const now = performance.now(), d = Math.max(8, now - lastM.t);
    vx = (e.clientX - lastM.x) / d * 16; vy = (e.clientY - lastM.y) / d * 16;
    lastM = {x: e.clientX, y: e.clientY, t: now};
  };
  const up = e => { if (!drag || e.pointerId !== activePointer) return; drag = false; activePointer = null; tag.style.cursor = 'grab'; const end = P[POINTS - 1]; end.px = end.x - vx / 16; end.py = end.y - vy / 16; try { tag.releasePointerCapture(e.pointerId); } catch {} };
  const near = e => {
    if (drag) return;
    const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, m = P[POINTS >> 1];
    const d = Math.hypot(x - m.x, y - m.y);
    if (d <= PUSH_R) push += Math.sign(x - m.x) * (1 - d / PUSH_R) * .7;
  };
  tag.addEventListener('pointerdown', down);
  addEventListener('pointermove', move, {passive: true});
  addEventListener('pointerup', up, {passive: true});
  addEventListener('pointercancel', up, {passive: true});
  addEventListener('pointermove', near, {passive: true});
  const off = subscribe(({velocity}) => { push += 5 * velocity; });
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; });
  io.observe(host);
  const step = dt => {
    if (Math.abs(push) > .01) { for (let i = 1; i < POINTS; i++) P[i].x += push * (i / POINTS) * .5; push *= .82; } else push = 0;
    for (let i = 0; i < POINTS; i++) {
      const p = P[i];
      if (p.pin || (drag && i === POINTS - 1)) continue;
      const dx = p.x - p.px, dy = p.y - p.py;
      p.px = p.x; p.py = p.y;
      p.x += DAMP * dx; p.y += DAMP * dy + GRAVITY * dt * dt;
    }
    for (let i = 1; i < POINTS - 1; i++) { const p = P[i], a = P[i - 1], b = P[i + 1]; p.x += ((a.x + b.x) / 2 - p.x) * SMOOTH; p.y += ((a.y + b.y) / 2 - p.y) * SMOOTH; }
    for (let k = 0; k < ITER; k++) {
      for (let i = 0; i < POINTS - 1; i++) {
        const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-4, f = (d - seg) / d * FIX, sx = dx * f, sy = dy * f;
        if (!a.pin) { a.x += sx; a.y += sy; }
        if (!(drag && i + 1 === POINTS - 1)) { b.x -= sx; b.y -= sy; }
      }
      P[0].x = cx; P[0].y = top;
    }
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < POINTS; i++) { const a = P[i - 1], b = P[i]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    const e = P[POINTS - 1], q = P[POINTS - 2];
    g.lineTo(e.x, e.y);
    const ex = e.x - q.x, ey = e.y - q.y, l = Math.hypot(ex, ey) || 1;
    g.lineTo(e.x + ex / l * tail, e.y + ey / l * tail);
    g.lineCap = 'butt'; g.lineJoin = 'round'; g.lineWidth = width; g.strokeStyle = RED; g.stroke();
    g.font = `700 ${Math.round(.34 * width)}px ${font}`; g.fillStyle = '#0a0a0a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (sized !== width) { halfText = g.measureText(TEXT).width / 2; gap = Math.max(width, halfText + .31 * width + .22 * width); sized = width; }
    let next = -top + halfText + .18 * width, walked = 0;
    for (let i = 1; i < POINTS; i++) {
      const a = P[i - 1], b = P[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= 0) continue;
      while (walked + d >= next) {
        const t = (next - walked) / d;
        g.save(); g.translate(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); g.rotate(Math.atan2(b.y - a.y, b.x - a.x)); g.fillText(TEXT, 0, 0); g.restore();
        next += gap;
      }
      walked += d;
    }
    const tilt = 180 * Math.atan2(e.x - q.x, e.y - q.y) / Math.PI;
    spin += .55 * (e.x - e.px); spin -= .012 * flip; spin *= .93;
    flip = Math.max(-150, Math.min(150, flip + spin));
    place(e.x, e.y);
    tag.style.transform = `translate(-50%,0) rotate(${tilt}deg) rotateY(${flip}deg)`;
    tag.style.zIndex = Math.abs(((flip % 360) + 360) % 360 - 180) < 90 ? '5' : '30';
    const c = Math.max(0, Math.cos(flip * Math.PI / 180));
    art.style.filter = `drop-shadow(0 ${(1 + 1.5 * c).toFixed(1)}px ${(2 + 3 * c).toFixed(1)}px rgba(0,0,0,${(.05 + .1 * c).toFixed(2)}))`;
  };
  let raf = 0, last = performance.now(), alive = true;
  const tick = now => {
    if (!alive) return;
    const ms = Math.min(32, now - last); last = now;
    if (inView) { step(Math.min(MAX_DT, ms / 1000)); draw(); }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(raf); off(); io.disconnect(); removeEventListener('pointermove', move); removeEventListener('pointermove', near); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); host.innerHTML = ''; host.classList.remove('ribbon-host'); };
}
