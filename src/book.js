// 工作室翻书：three.js 骨骼蒙皮页面，每页 31 根骨骼；封面、内页、订口阴影全部画在 canvas 贴图上。
import * as THREE from 'three';
import {lang, siteReady} from './core.js';

const W = 1.28, H = 1.71, D = .003, SEGS = 30, BONES = 31, SEG_W = W / SEGS;
const FAR = 2;
const S = {inner: .18, outer: .05, turn: .09, turnMs: 400, stepZ: .004};
const FONT_UI = '"Hanken Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif';

const wrapAngle = a => { let r = (a + Math.PI) % (2 * Math.PI); if (r < 0) r += 2 * Math.PI; return r - Math.PI; };
function smoothDamp(state, cur, target, smooth, dt) {
  const omega = 2 / Math.max(1e-4, smooth), x = omega * dt, exp = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
  const change = cur - target, temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}
function dampAngle(obj, axis, target, smooth, dt) {
  const st = obj.userData[axis] ||= {v: 0}, cur = obj.rotation[axis];
  obj.rotation[axis] = smoothDamp(st, cur, cur + wrapAngle(target - cur), smooth, dt);
}
function dampValue(obj, key, target, smooth, dt) {
  const st = obj.userData[key] ||= {v: 0};
  obj.position[key] = smoothDamp(st, obj.position[key], target, smooth, dt);
}
const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  return imgCache.get(src);
}
function cover(g, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / s, sh = h / s;
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
function lines(g, text, max, limit) {
  const words = /[㐀-鿿]/.test(text) ? [...text] : text.split(' ');
  const sep = /[㐀-鿿]/.test(text) ? '' : ' ';
  const out = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + sep + w : w;
    if (g.measureText(t).width > max && line) { out.push(line); line = w; if (out.length === limit) break; } else line = t;
  }
  if (out.length < limit && line) out.push(line);
  return out;
}

function buildGeometry(depth = D) {
  const geo = new THREE.BoxGeometry(W, H, depth, SEGS, 2);
  geo.translate(W / 2, 0, 0);
  const pos = geo.attributes.position, idx = [], wts = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), n = Math.max(0, Math.floor(x / SEG_W)), w = (x % SEG_W) / SEG_W;
    idx.push(n, Math.min(BONES - 1, n + 1), 0, 0);
    wts.push(1 - w, w, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  return geo;
}

export async function mountBook(host, {data, onGiveUp}) {
  await Promise.all([document.fonts.load('700 40px "Hanken Grotesk"').catch(() => {}), document.fonts.load('400 120px Anton').catch(() => {})]);
  const faces = [{kind: 'cover'}, ...data.items.map(it => ({kind: 'item', ...it}))];
  if (faces.length % 2 === 0) faces.push({kind: 'blank'});
  faces.push({kind: 'back'});
  const pages = [];
  for (let i = 0; i < faces.length; i += 2) pages.push([faces[i], faces[i + 1]]);
  const TOTAL = pages.length;
  // 页数少时加厚每页，书脊的视觉厚度保持在 .09 左右（对标站约 24 页 × .004）。
  const STACK = Math.max(S.stepZ, .09 / TOTAL);
  let target = 0, shown = 0, stepTimer = 0, lost = 0, dead = false, inst = null;

  const announce = () => host.dispatchEvent(new CustomEvent('book:page', {detail: {page: target, total: TOTAL}}));
  const go = n => {
    target = Math.max(0, Math.min(TOTAL, n));
    announce();
    if (!stepTimer) stepper();
  };
  const stepper = () => {
    if (target === shown) { stepTimer = 0; return; }
    shown += Math.sign(target - shown);
    inst?.onShown();
    stepTimer = setTimeout(stepper, Math.abs(target - shown) > 2 ? 50 : 150);
  };

  function build() {
    const canvas = document.createElement('canvas');
    canvas.className = 'book-canvas';
    host.append(canvas);
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, premultipliedAlpha: false});
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.85));
    const sun = new THREE.DirectionalLight(0xffffff, .82);
    sun.position.set(1.5, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -1e-4;
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(36, 1, .05, 30);
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), n = 2 * Math.tan(THREE.MathUtils.degToRad(18));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(0, 0, Math.max(2.901015 / n, 2.6624 / (camera.aspect * n)));
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const blobC = document.createElement('canvas'); blobC.width = blobC.height = 256;
    const bg = blobC.getContext('2d'), grad = bg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(42,42,48,.9)'); grad.addColorStop(1, 'rgba(42,42,48,0)');
    bg.fillStyle = grad; bg.fillRect(0, 0, 256, 256);
    const blobT = new THREE.CanvasTexture(blobC); blobT.colorSpace = THREE.SRGBColorSpace;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), new THREE.MeshBasicMaterial({map: blobT, transparent: true, depthWrite: false, toneMapped: false}));
    blob.position.set(0, -.1, -1.15);
    scene.add(blob);

    const outer = new THREE.Group(); scene.add(outer);
    const tilt = new THREE.Group(); tilt.position.y = -.12; tilt.rotation.set(-.05, .1, 0); outer.add(tilt);
    const float = new THREE.Group(); tilt.add(float);
    const book = new THREE.Group(); book.rotation.y = -Math.PI / 2; float.add(book);

    /* ---------- 贴图 ---------- */
    const TEX_H = 1400, TEX_W = Math.round(W / H * TEX_H);
    const blank = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, 4, 4); return c; })());
    blank.colorSpace = THREE.SRGBColorSpace;
    const faceTex = new Map();
    async function paint(face, pageNo, side) {
      const c = face.canvas ||= Object.assign(document.createElement('canvas'), {width: TEX_W, height: TEX_H});
      const g = c.getContext('2d'), l = lang(), token = (face.token = (face.token || 0) + 1);
      const img = face.kind === 'cover' ? await loadImg(data.cover) : face.image ? await loadImg(face.image) : null;
      if (face.token !== token) return;
      g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, TEX_W, TEX_H);
      face.pill = null;
      if (face.kind === 'cover') {
        if (img) cover(g, img, 0, 0, TEX_W, TEX_H);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, TEX_W, TEX_H);
        g.fillStyle = '#f1eec0'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.font = `700 34px ${FONT_UI}`; g.fillText('VISUAL NOTES / 2026', TEX_W / 2, 120);
        g.font = '400 210px Anton, Impact, sans-serif'; g.fillText('MILES', TEX_W / 2, 790);
        g.font = `700 30px ${FONT_UI}`; g.fillText('CHARACTERS / PRODUCTS / PLACES', TEX_W / 2, 1290);
      } else if (face.kind === 'back') {
        g.fillStyle = '#ea4530'; g.fillRect(0, 0, TEX_W, TEX_H);
        g.fillStyle = '#0a0a0a'; g.textAlign = 'center';
        g.font = '400 128px Anton, Impact, sans-serif'; g.fillText('MILES', TEX_W / 2, 690);
        g.font = `700 38px ${FONT_UI}`; g.fillText('VISUAL ARCHIVE', TEX_W / 2, 760);
      } else if (face.kind === 'item') {
        const m = .05 * TEX_W, gutter = .055 * TEX_W, top = .062 * TEX_H, art = TEX_W - 2 * m - gutter;
        const x = side ? m : m + gutter;
        if (img) cover(g, img, x, top, art, art);
        let y = top + art + Math.round(.068 * TEX_H);
        const e = Math.round(.042 * TEX_H);
        const titleText = l === 'zh' ? face.title : face.enTitle || face.title;
        g.fillStyle = '#141414'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.letterSpacing = `${(-.02 * e).toFixed(2)}px`;
        g.font = `700 ${e}px ${FONT_UI}`;
        lines(g, titleText, art, 2).forEach((t, i) => g.fillText(t, x, y + i * e * 1.05));
        y += (lines(g, titleText, art, 2).length - 1) * e * 1.05 + e * .2;
        g.letterSpacing = `${(.01 * e * .46).toFixed(2)}px`;
        g.font = `700 ${Math.round(.46 * e)}px ${FONT_UI}`; g.fillStyle = '#ea4530'; y += 1.15 * e;
        g.fillText((l === 'zh' ? face.category : face.enCategory || face.category), x, y);
        g.letterSpacing = '0px';
        g.font = `400 ${Math.round(.37 * e)}px ${FONT_UI}`; g.fillStyle = 'rgba(20,20,20,.62)'; y += 1.1 * e;
        lines(g, face.caption, art, 3).forEach((t, i) => g.fillText(t, x, y + i * .37 * e * 1.4));
        const h = Math.round(.05 * TEX_H), fs = Math.round(.42 * h);
        const label = l === 'zh' ? '查看项目 ↗' : 'VIEW PROJECT ↗';
        g.font = `700 ${fs}px ${FONT_UI}`;
        const w = g.measureText(label).width + h, px = x, py = TEX_H - top - h;
        g.fillStyle = face.hover ? '#3aa1d8' : '#ea4530';
        g.beginPath(); g.roundRect(px, py, w, h, h / 2); g.fill();
        g.fillStyle = '#f1eec0'; g.textBaseline = 'middle'; g.fillText(label, px + h / 2, py + h / 2 + 1);
        face.pill = {x: px / TEX_W, y: py / TEX_H, w: w / TEX_W, h: h / TEX_H};
      }
      if (face.kind !== 'cover' && face.kind !== 'back') {
        const grd = side ? g.createLinearGradient(TEX_W, 0, TEX_W * .78, 0) : g.createLinearGradient(0, 0, TEX_W * .22, 0);
        grd.addColorStop(0, 'rgba(0,0,0,.26)'); grd.addColorStop(.4, 'rgba(0,0,0,.104)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        if (side) g.fillRect(TEX_W * .78, 0, TEX_W * .22, TEX_H); else g.fillRect(0, 0, TEX_W * .22, TEX_H);
      }
      let t = faceTex.get(face);
      if (!t) { t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); faceTex.set(face, t); }
      t.needsUpdate = true;
      return t;
    }
    /* ---------- 页面 ---------- */
    const geo = buildGeometry(STACK * .85);
    const paperMat = c => new THREE.MeshStandardMaterial({color: c, roughness: .9});
    const sides = [paperMat('#e8e5df'), paperMat('#ea4530'), paperMat('#e8e5df'), paperMat('#e8e5df')];
    const skinned = pages.map(([a, b], n) => {
      const bones = [];
      for (let i = 0; i < BONES; i++) {
        const bone = new THREE.Bone();
        bone.position.x = i ? SEG_W : 0;
        if (i) bones[i - 1].add(bone);
        bones.push(bone);
      }
      const mkMat = () => new THREE.MeshStandardMaterial({color: '#fff', map: blank, roughness: .82});
      const mesh = new THREE.SkinnedMesh(geo, [...sides, mkMat(), mkMat()]);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.add(bones[0]);
      mesh.bind(new THREE.Skeleton(bones));
      const group = new THREE.Group();
      group.add(mesh);
      book.add(group);
      mesh.userData.n = n;
      return {group, mesh, bones, n, faces: [a, b], lastOpen: false, t0: -1e9, loaded: false};
    });
    const loadNear = () => skinned.forEach(p => {
      if (Math.abs(p.n - shown) > FAR || p.loaded) return;
      p.loaded = true;
      p.faces.forEach((f, side) => paint(f, p.n, side).then(t => { if (t) { p.mesh.material[4 + side].map = t; p.mesh.material[4 + side].needsUpdate = true; } }));
    });
    const repaintAll = () => skinned.forEach(p => { if (p.loaded) p.faces.forEach((f, side) => paint(f, p.n, side).then(t => { if (t) { p.mesh.material[4 + side].map = t; p.mesh.material[4 + side].needsUpdate = true; } })); });
    loadNear();
    addEventListener('miles:lang', repaintAll);

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pointerHit = e => {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // 蒙皮网格的拾取必须在骨骼更新后的姿态下进行
      scene.updateMatrixWorld();
      return ray.intersectObjects(skinned.map(p => p.mesh), false)[0];
    };
    const pillHit = hit => {
      if (!hit || !hit.uv) return null;
      const idx = hit.face.materialIndex;
      if (idx !== 4 && idx !== 5) return null;
      const f = skinned[hit.object.userData.n].faces[idx - 4];
      const p = f.pill;
      if (!p) return null;
      const u = hit.uv.x, v = 1 - hit.uv.y;
      return u >= p.x && u <= p.x + p.w && v >= p.y && v <= p.y + p.h ? f : null;
    };
    let hoverFace = null;
    const setHover = f => {
      if (hoverFace === f) return;
      for (const h of [hoverFace, f]) if (h) { h.hover = h === f; }
      const prev = hoverFace; hoverFace = f;
      skinned.forEach(p => p.faces.forEach((x, side) => { if ((x === prev || x === f) && x) paint(x, p.n, side); }));
    };
    const move = e => {
      const h = pointerHit(e);
      canvas.style.cursor = h ? 'pointer' : '';
      setHover(pillHit(h));
    };
    let dn = null;
    const pdown = e => { dn = {x: e.clientX, y: e.clientY}; };
    const click = e => {
      if (!dn || Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 8) return;
      const h = pointerHit(e);
      if (!h) { go(0); return; }
      const f = pillHit(h);
      if (f) { location.href = `work/${f.slug}/`; return; }
      const p = skinned[h.object.userData.n];
      const isOpen = shown > p.n;
      go(isOpen ? p.n : p.n + 1);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('click', click);

    const clock = new THREE.Clock();
    let raf = 0, disposed = false, inView = true;
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && !raf) raf = requestAnimationFrame(loop); });
    io.observe(host);
    function loop() {
      raf = 0;
      if (disposed || !inView) return;
      const dt = Math.min(.05, clock.getDelta()), now = performance.now(), t = clock.elapsedTime;
      const yF = Math.sin(t / 4 * 1.2) / 10;
      float.position.y = yF * .14;
      const closedStart = shown === 0, closedEnd = shown === TOTAL;
      dampValue(outer, 'x', closedStart ? -.64 : closedEnd ? .64 : 0, .35, dt);
      dampAngle(outer, 'y', closedStart ? .68 : closedEnd ? -.68 : .1, .4, dt);
      for (const p of skinned) {
        const open = shown > p.n, closed = shown === 0 || shown === TOTAL;
        if (p.lastOpen !== open) { p.t0 = now; p.lastOpen = open; }
        const a = Math.sin(Math.min(S.turnMs, now - p.t0) / S.turnMs * Math.PI);
        let l = open ? -Math.PI / 2 : Math.PI / 2;
        if (!closed) l += THREE.MathUtils.degToRad(.8 * p.n);
        // 页面法线在 book 局部坐标里是 x 轴：沿 x 叠放才有前后层次，否则闭合时所有页共面产生深度冲突。
        p.group.position.x = -(open ? shown - 1 - p.n : p.n - shown) * STACK;
        p.group.position.z = (shown - p.n) * S.stepZ;
        for (let e = 0; e < BONES; e++) {
          const node = e === 0 ? p.group : p.bones[e];
          let n = S.inner * (e < 8 ? Math.sin(.2 * e + .25) : 0) * l - S.outer * (e >= 8 ? Math.cos(.3 * e + .09) : 0) * l + S.turn * (Math.sin(e * Math.PI / BONES) * a) * l;
          let u = THREE.MathUtils.degToRad(2 * Math.sign(l));
          if (closed) { n = e === 0 ? l : 0; u = 0; }
          dampAngle(node, 'y', n, .5, dt);
          const s = e > 8 ? Math.sin(e * Math.PI / BONES - .5) * a : 0;
          dampAngle(node, 'x', u * s, .3, dt);
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      removeEventListener('miles:lang', repaintAll);
      canvas.removeEventListener('webglcontextlost', onLost, true);
      faceTex.forEach(t => t.dispose()); blobT.dispose(); blank.dispose(); geo.dispose();
      scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => m.dispose()); });
      renderer.dispose();
      canvas.remove();
    };
    const onLost = e => {
      e.preventDefault();
      lost++;
      dispose();
      if (dead) return;
      if (lost >= 3) { dead = true; onGiveUp?.(); return; }
      setTimeout(() => { if (!dead) start(); }, 300);
    };
    canvas.addEventListener('webglcontextlost', onLost, true);
    return {onShown: loadNear, dispose, lose: () => renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext()};
  }
  function start() {
    try { inst = build(); }
    catch (err) { dead = true; console.warn('[miles] WebGL book unavailable', err.message); onGiveUp?.(); }
  }
  start();
  announce();
  window.__milesDebug = Object.assign(window.__milesDebug || {}, {book: {go, state: () => ({target, shown, total: TOTAL, lost}), lose: () => inst?.lose?.()}});
  return {go, total: TOTAL, dispose: () => { dead = true; inst?.dispose(); }};
}
