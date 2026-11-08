// 逐词显现：按词上屏时模糊消退。data-words="scroll" 跟随视口，"driven" 由区块进度驱动。
import {clamp, subscribe, PH, reduced} from './core.js';

const BLUR = 10, RISE = 12, LINE_STAGGER = 20, DISTANCE = 380, TRIGGER = .88;
const CJK = /[㐀-鿿　-ヿ]/;
const blocks = new Set();

function pieces(text) {
  if (!CJK.test(text)) return text.split(/(\s+)/).filter(Boolean);
  if (globalThis.Intl?.Segmenter) return [...new Intl.Segmenter('zh', {granularity: 'word'}).segment(text)].map(s => s.segment);
  return [...text];
}
function wrapText(node, out) {
  const frag = document.createDocumentFragment();
  for (const part of pieces(node.nodeValue)) {
    if (/^\s+$/.test(part)) { frag.append(' '); continue; }
    const w = document.createElement('span');
    w.className = 'w';
    w.textContent = part;
    frag.append(w);
    out.push(w);
  }
  node.replaceWith(frag);
}
function walk(root, out) {
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 3) wrapText(n, out);
    else if (n.nodeType === 1) {
      if (n.classList.contains('pill-red')) { n.classList.add('w'); out.push(n); }
      else walk(n, out);
    }
  }
}
export function paint(el, t) {
  if (t >= .999) { el.style.opacity = 1; el.style.filter = 'none'; el.style.transform = 'none'; return; }
  el.style.opacity = t.toFixed(3);
  el.style.filter = `blur(${(BLUR * (1 - t)).toFixed(2)}px)`;
  el.style.transform = `translate3d(0,${(RISE * (1 - t)).toFixed(2)}px,0)`;
}
export function splitWords(el) {
  const words = [];
  walk(el, words);
  let block = [...blocks].find(b => b.el === el);
  if (!block) { block = {el}; blocks.add(block); }
  block.words = words;
  block.dirty = true;
  if (reduced) words.forEach(w => paint(w, 1));
  else words.forEach(w => paint(w, 0));
}
function measure(block) {
  let line = -1, lastTop = -Infinity;
  const sy = window.scrollY;
  block.geo = block.words.map(w => {
    const top = w.getBoundingClientRect().top + sy;
    if (top - lastTop > 4) { line++; lastTop = top; }
    return {top, line};
  });
  block.dirty = false;
}
export function drive(el, p) {
  const b = [...blocks].find(x => x.el === el);
  if (!b || reduced) return;
  const n = b.words.length;
  b.words.forEach((w, i) => paint(w, clamp((p - (n > 1 ? i / (n - 1) * .55 : 0)) / .45, 0, 1)));
}
export function initWords() {
  window.addEventListener('resize', () => blocks.forEach(b => { b.dirty = true; }));
  document.fonts?.ready.then(() => blocks.forEach(b => { b.dirty = true; }));
  if (reduced) return;
  subscribe(({y}) => {
    const vh = innerHeight;
    const atEnd = y + vh >= document.documentElement.scrollHeight - 2;
    for (const b of blocks) {
      if (b.el.dataset.words !== 'scroll') continue;
      if (b.dirty) measure(b);
      b.words.forEach((w, i) => {
        const g = b.geo[i];
        const t = atEnd ? 1 : clamp((vh * TRIGGER - (g.top - y) - g.line * Math.max(0, LINE_STAGGER)) / DISTANCE, 0, 1);
        if (w._t !== t) { w._t = t; paint(w, t); }
      });
    }
  }, PH.CONSUMER);
}
