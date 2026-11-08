// 桌面挂绳：three.js 渲染 + Rapier 真物理 + MeshLine 绳带。卡片和贴图全部由代码生成。
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {MeshLineGeometry, MeshLineMaterial} from 'meshline';
import {subscribe, PH, siteReady} from './core.js';

const CFG = {
  camera: [0, 0, 26], fov: 20, gravity: -40, anchorY: 5.6,
  rope: {mobile: 2.2, desktop: 2}, cardScale: {mobile: 1.95, desktop: 2.25}, lineWidth: 1.1,
  damping: 4, ballR: .1, collider: [.8, 1.125, .01], jointOnCard: 1.5, maxLost: 3, rebuildMs: 300,
  card: {w: 1.6, h: 2.25, r: .11, y: -.075},
};
const RED = '#ea4530';
const ROPE_BG = '#272727', ROPE_INK = '#3a3a3a';  // 绳带底色和压印字色（按对标站截图取色）

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function normalizeUV(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
  uv.needsUpdate = true;
}
function loadSvg(tpl) {
  return new Promise(res => {
    const svg = tpl?.content?.querySelector('svg');
    if (!svg) return res(null);
    const src = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
}
const fontsReady = () => Promise.all([
  document.fonts.load('400 200px Anton').catch(() => {}),
  document.fonts.load('700 40px "Hanken Grotesk"').catch(() => {}),
]);
function faceCanvas(art) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1440;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 1024, 1440);
  bg.addColorStop(0, '#5cb8e4'); bg.addColorStop(.45, '#3aa1d8'); bg.addColorStop(1, '#2c85b8');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 1440);
  g.fillStyle = '#10202c'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '400 320px Anton, Impact, sans-serif'; g.fillText('miles', 512, 460);
  if (art) g.drawImage(art, 512 - 340, 500, 680, 631);
  g.font = '700 60px "Hanken Grotesk", sans-serif'; g.fillText('AI VIDEO / CREATOR', 512, 1320);
  return c;
}
function backCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1440;
  const g = c.getContext('2d');
  g.fillStyle = RED; g.fillRect(0, 0, 1024, 1440);
  g.fillStyle = '#0a0a0a'; g.textAlign = 'center';
  g.font = '400 300px Anton, Impact, sans-serif'; g.fillText('MILES', 512, 780);
  g.font = '700 54px "Hanken Grotesk", sans-serif'; g.fillText('MADE WITH CURIOSITY.', 512, 880);
  return c;
}
function ropeCanvas(logo) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = ROPE_BG; g.fillRect(0, 0, 512, 128);
  g.fillStyle = ROPE_INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 64px "Hanken Grotesk", sans-serif'; g.fillText('miles', 170, 66);
  return c;
}
function makeEnv(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0);
  const P = Math.PI;
  [[2, [0, -1, 5], [0, 0, P / 3], [100, .1, 1]], [3, [-1, -1, 1], [0, 0, P / 3], [100, .1, 1]], [3, [1, 1, 1], [0, 0, P / 3], [100, .1, 1]], [10, [-10, 0, 14], [0, P / 2, P / 3], [100, 10, 1]]].forEach(([i, p, r, s]) => {
    const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(i, i, i), side: THREE.DoubleSide, toneMapped: false});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
    scene.add(m);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, .04, .1, 100);
  pm.dispose();
  return rt;
}

export async function mountLanyard(host, {onGiveUp} = {}) {
  await RAPIER.init();
  const [art, logo] = await Promise.all([loadSvg(document.getElementById('pass-mascot')), loadSvg(document.getElementById('site-mark')), fontsReady()]);
  let lost = 0, current = null, dead = false, unlocked = false;
  siteReady.then(() => { unlocked = true; current?.unlock(); });

  function build() {
    const isMobile = matchMedia('(max-width: 767px)').matches;
    const ropeLen = isMobile ? CFG.rope.mobile : CFG.rope.desktop;
    const cardScale = isMobile ? CFG.cardScale.mobile : CFG.cardScale.desktop;
    const STEP = isMobile ? 1 / 30 : 1 / 60;
    const canvas = document.createElement('canvas');
    canvas.className = 'lanyard-canvas';
    host.append(canvas);
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(isMobile ? 1 : Math.min(2, devicePixelRatio || 1));
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const env = makeEnv(renderer);
    scene.environment = env.texture;
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
    const camera = new THREE.PerspectiveCamera(CFG.fov, 1, .1, 100);
    camera.position.set(...CFG.camera);

    const resolution = new THREE.Vector2(1000, isMobile ? 2000 : 1000);
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const world = new RAPIER.World({x: 0, y: CFG.gravity, z: 0});
    world.timestep = STEP;
    const Y = CFG.anchorY;
    const makeBall = (x, fixed) => {
      const desc = fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
      desc.setTranslation(x, Y, 0).setLinearDamping(CFG.damping).setAngularDamping(CFG.damping).setCanSleep(true);
      const b = world.createRigidBody(desc);
      world.createCollider(RAPIER.ColliderDesc.ball(CFG.ballR), b);
      return b;
    };
    const fixed = makeBall(0, true), j1 = makeBall(.5, true), j2 = makeBall(1, true), j3 = makeBall(1.5, true);
    const cardBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2, Y, 0).setLinearDamping(CFG.damping).setAngularDamping(CFG.damping).setCanSleep(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(...CFG.collider), cardBody);
    const v0 = {x: 0, y: 0, z: 0};
    const rope = (a, b) => world.createImpulseJoint(RAPIER.JointData.rope(ropeLen, v0, v0), a, b, true);
    rope(fixed, j1); rope(j1, j2); rope(j2, j3);
    world.createImpulseJoint(RAPIER.JointData.spherical(v0, {x: 0, y: CFG.jointOnCard, z: 0}), j3, cardBody, true);
    const unlock = () => {
      [j1, j2, j3, cardBody].forEach(b => { b.setBodyType(RAPIER.RigidBodyType.Dynamic, true); });
    };
    if (unlocked) unlock();

    /* ---------- 卡片模型（圆角板 + 金属夹） ---------- */
    const aniso = isMobile ? 4 : 16;
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
    const faceT = tex(faceCanvas(art)), backT = tex(backCanvas());
    const faceProps = {anisotropy: aniso, clearcoat: isMobile ? 0 : 1, clearcoatRoughness: .15, roughness: .9, metalness: .8};
    const {w, h, r} = CFG.card, shape = roundedShape(w, h, r);
    const card = new THREE.Group();
    card.scale.setScalar(cardScale / 2.25);
    const inner = new THREE.Group(); inner.position.set(0, CFG.card.y, -.05 + .05); card.add(inner);
    const frontG = new THREE.ShapeGeometry(shape, 8); normalizeUV(frontG, w, h);
    const backG = new THREE.ShapeGeometry(shape, 8); normalizeUV(backG, w, h);
    const front = new THREE.Mesh(frontG, new THREE.MeshPhysicalMaterial({map: faceT, ...faceProps})); front.position.z = .018;
    const back = new THREE.Mesh(backG, new THREE.MeshPhysicalMaterial({map: backT, ...faceProps})); back.rotation.y = Math.PI; back.position.z = -.018;
    const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: .024, bevelEnabled: false, curveSegments: 8}), new THREE.MeshStandardMaterial({color: 0x10171d, roughness: .5, metalness: .4}));
    edge.position.z = -.012;
    inner.add(edge, front, back);
    const metal = new THREE.MeshStandardMaterial({color: '#585858', roughness: .3, metalness: .9});
    const clip = new THREE.Mesh(new THREE.BoxGeometry(.26, .2, .05), metal); clip.position.set(0, 1.22 - CFG.card.y - CFG.card.y, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.11, .022, 12, 32), metal); ring.position.set(0, 1.42 - 2 * CFG.card.y, 0);
    inner.add(clip, ring);
    scene.add(card);
    const pickable = [front, back, edge, clip, ring];

    /* ---------- 绳带 ---------- */
    const ropeT = new THREE.CanvasTexture(ropeCanvas(logo));
    ropeT.colorSpace = THREE.SRGBColorSpace; ropeT.wrapS = ropeT.wrapT = THREE.RepeatWrapping;
    const lineGeo = new MeshLineGeometry();
    const lineMat = new MeshLineMaterial({color: new THREE.Color('white'), depthTest: false, resolution, useMap: 1, map: ropeT, repeat: new THREE.Vector2(-4, 1), lineWidth: CFG.lineWidth});
    const band = new THREE.Mesh(lineGeo, lineMat);
    band.frustumCulled = false;
    scene.add(band);

    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    curve.curveType = 'chordal';
    const lerpJ1 = new THREE.Vector3().copy(j1.translation()), lerpJ2 = new THREE.Vector3().copy(j2.translation());
    const tmp = new THREE.Vector3(), dragVec = new THREE.Vector3(), dir = new THREE.Vector3();
    const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
    let dragged = null, hover = false, inView = true, acc = 0, disposed = false;

    const toNdc = e => {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const hit = () => { ray.setFromCamera(ndc, camera); return ray.intersectObjects(pickable, false)[0]; };
    const down = e => {
      if (!unlocked) return;
      toNdc(e);
      const h = hit();
      if (!h) return;
      canvas.setPointerCapture(e.pointerId);
      const t = cardBody.translation();
      dragged = h.point.clone().sub(tmp.set(t.x, t.y, t.z));
      cardBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      document.body.dataset.cursorDrag = '1';
    };
    const move = e => {
      toNdc(e);
      if (dragged) return;
      const on = !!hit();
      if (on !== hover) { hover = on; document.body.dataset.cursorDrag = on ? '1' : ''; canvas.style.cursor = on ? 'grab' : ''; }
    };
    const up = e => {
      if (!dragged) return;
      dragged = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      cardBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      document.body.dataset.cursorDrag = '';
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; });
    io.observe(host);

    const prevP = new THREE.Vector3().copy(cardBody.translation()), curP = prevP.clone();
    const prevQ = new THREE.Quaternion().copy(cardBody.rotation()), curQ = prevQ.clone();
    const off = subscribe(({dt}) => {
      if (!inView || disposed) return;
      if (dragged) {
        dragVec.set(ndc.x, ndc.y, .5).unproject(camera);
        dir.copy(dragVec).sub(camera.position).normalize();
        dragVec.add(dir.multiplyScalar(camera.position.length()));
        [cardBody, j1, j2, j3, fixed].forEach(b => b.wakeUp());
        cardBody.setNextKinematicTranslation({x: dragVec.x - dragged.x, y: dragVec.y - dragged.y, z: dragVec.z - dragged.z});
      }
      acc += Math.min(.1, dt);
      let n = 0;
      while (acc >= STEP && n++ < 6) {
        prevP.copy(curP); prevQ.copy(curQ);
        const a = cardBody.angvel(), q = cardBody.rotation();
        cardBody.setAngvel({x: a.x, y: a.y - .25 * q.y, z: a.z}, false);
        world.step();
        curP.copy(cardBody.translation()); curQ.copy(cardBody.rotation());
        acc -= STEP;
      }
      const alpha = acc / STEP;
      card.position.lerpVectors(prevP, curP, alpha);
      card.quaternion.slerpQuaternions(prevQ, curQ, alpha);
      [[j1, lerpJ1], [j2, lerpJ2]].forEach(([b, l]) => {
        tmp.copy(b.translation());
        const d = Math.max(.1, Math.min(1, l.distanceTo(tmp)));
        l.lerp(tmp, Math.min(1, dt * d * 50));
      });
      curve.points[0].copy(j3.translation());
      curve.points[1].copy(lerpJ2);
      curve.points[2].copy(lerpJ1);
      curve.points[3].copy(fixed.translation());
      lineGeo.setPoints(curve.getPoints(isMobile ? 16 : 32));
      renderer.render(scene, camera);
    }, PH.SCENE);

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      off(); ro.disconnect(); io.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost, true);
      lineGeo.dispose(); lineMat.dispose(); ropeT.dispose(); faceT.dispose(); backT.dispose(); env.dispose();
      scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } });
      renderer.dispose();
      world.free();
      canvas.remove();
    };
    const onLost = e => {
      e.preventDefault();
      lost++;
      dispose();
      if (dead) return;
      if (lost >= CFG.maxLost) { dead = true; onGiveUp?.(); return; }
      setTimeout(() => { if (!dead) start(); }, CFG.rebuildMs);
    };
    canvas.addEventListener('webglcontextlost', onLost, true);
    return {
      dispose, unlock,
      debug: () => ({mode: 'webgl', lost, card: {...cardBody.translation()}, j3: {...j3.translation()}, dragging: !!dragged, sleeping: cardBody.isSleeping()}),
      loseContext: () => renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext(),
      project: () => { const v = new THREE.Vector3().copy(card.position).project(camera), r = canvas.getBoundingClientRect(); return {x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height}; },
    };
  }
  function start() {
    try { current = build(); }
    catch (err) { dead = true; console.warn('[miles] WebGL lanyard unavailable', err.message); onGiveUp?.(); }
  }
  start();
  window.__milesDebug = Object.assign(window.__milesDebug || {}, {lanyard: {state: () => current?.debug?.(), lose: () => current?.loseContext?.(), project: () => current?.project?.()}});
  return () => { dead = true; current?.dispose(); };
}
