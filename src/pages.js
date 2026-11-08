// 作品筛选、案例页播放/对比/灯箱、工作室页挂载、环境视频。
import {clamp, reduced, subscribe} from './core.js';

export function initWork() {
  const grid = document.querySelector('[data-work-grid]');
  if (!grid) return;
  const items = [...grid.querySelectorAll('[data-category]')];
  const search = document.getElementById('search'), toggle = document.querySelector('.filter-toggle'), panel = document.getElementById('filters');
  const count = document.querySelector('.result-count'), empty = document.querySelector('.empty');
  let filter = 'all';
  const apply = () => {
    const q = (search.value || '').trim().toLowerCase();
    let shown = 0;
    items.forEach(el => {
      const ok = (filter === 'all' || el.dataset.category === filter) && (!q || el.dataset.search.includes(q));
      el.hidden = !ok;
      if (ok) { shown++; el.classList.add('is-visible'); }
    });
    count.textContent = `${shown} / ${items.length}`;
    empty.hidden = shown !== 0;
  };
  search.addEventListener('input', apply);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    panel.hidden = !open;
    toggle.querySelector('[data-sign]').textContent = open ? '−' : '+';
  });
  panel.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    panel.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b));
    apply();
  }));
}

export function initMedia() {
  // 案例页主视觉 sticky 不动，标题块随滚动上移，滚过 78% 后淡出。
  const hero = document.querySelector('[data-hero-preso]'), heroTitle = hero?.querySelector('.case-title');
  if (hero && heroTitle && !reduced) subscribe(({y}) => {
    const h = hero.offsetHeight;
    if (h <= 0) return;
    const o = clamp(y - (hero.parentElement?.offsetTop ?? 0), 0, h);
    heroTitle.style.transform = `translate3d(0,${(-o).toFixed(1)}px,0)`;
    heroTitle.style.opacity = clamp(1 - (o / h - .78) / .22, 0, 1).toFixed(3);
  });
  document.querySelectorAll('video[data-ambient]').forEach(v => {
    if (reduced) return;
    new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, {threshold: .1}).observe(v);
  });
  document.querySelectorAll('video[controls]').forEach(v => {
    const note = v.parentElement.querySelector('.media-error');
    const fail = () => { if (note) note.hidden = false; };
    v.addEventListener('error', fail);
    v.querySelector('source')?.addEventListener('error', fail);
  });
  const cmp = document.querySelector('.comparison');
  if (cmp) {
    const input = cmp.querySelector('input');
    input.addEventListener('input', () => cmp.style.setProperty('--position', `${input.value}%`));
  }
  const box = document.getElementById('lightbox');
  if (box) {
    const img = box.querySelector('img'), cap = box.querySelector('figcaption');
    document.querySelectorAll('.zoom-image').forEach(b => b.addEventListener('click', () => {
      img.src = b.dataset.image; img.alt = b.dataset.caption; cap.textContent = b.dataset.caption;
      box.showModal();
    }));
    box.querySelector('.lightbox-close').addEventListener('click', () => box.close());
    box.addEventListener('click', e => { if (e.target === box) box.close(); });
  }
}

export function initStudio() {
  const stage = document.querySelector('[data-book]');
  if (!stage) return;
  const reveal = document.querySelector('[data-book-reveal]');
  requestAnimationFrame(() => reveal.classList.add('open'));
  setTimeout(() => reveal.classList.add('settled'), 750);
  const canvasHost = stage.querySelector('[data-book-canvas]');
  const data = JSON.parse(document.getElementById('book-data').textContent);
  const fallback = () => document.documentElement.classList.add('no-webgl-book');
  const hintL = document.querySelector('.book-hint-left');
  let hintTimer = 0;
  const status = document.getElementById('book-count');
  const prev = document.getElementById('book-prev'), next = document.getElementById('book-next');
  let api = null, page = 0;
  canvasHost.addEventListener('book:page', e => {
    page = e.detail.page;
    status.textContent = `${page} / ${e.detail.total}`;
    prev.disabled = page === 0; next.disabled = page === e.detail.total;
    document.querySelector('.book-hint-right').classList.toggle('off', page !== 0);
    clearTimeout(hintTimer);
    hintL.classList.remove('on');
    if (page > 0 && page < e.detail.total) hintTimer = setTimeout(() => hintL.classList.add('on'), 5000);
  });
  prev.addEventListener('click', () => api?.go(page - 1));
  next.addEventListener('click', () => api?.go(page + 1));
  if (reduced || new URLSearchParams(location.search).has('nowebgl')) { fallback(); return; }
  import('./book.js').then(m => m.mountBook(canvasHost, {data, onGiveUp: fallback})).then(a => { api = a; }).catch(err => { console.warn('[miles] book failed', err.message); fallback(); });
}
