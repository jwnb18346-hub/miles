// 语言切换：EN / 中。文字保存在 data-en / data-zh，富文本保存在 data-en-html / data-zh-html。
import {lang} from './core.js';
import {splitWords} from './words.js';

const KEY = 'miles-lang';
export function applyLang(next, persist = true) {
  const root = document.documentElement;
  root.dataset.lang = next;
  root.lang = next === 'zh' ? 'zh-CN' : 'en';
  if (persist) { try { localStorage.setItem(KEY, next); } catch {} }
  document.querySelectorAll('[data-zh]').forEach(el => { el.textContent = el.getAttribute(`data-${next}`); });
  document.querySelectorAll('[data-zh-html]').forEach(el => { el.innerHTML = el.getAttribute(`data-${next}-html`); });
  document.querySelectorAll('[data-lang-attr]').forEach(el => {
    for (const a of el.dataset.langAttr.split(',')) el.setAttribute(a, el.getAttribute(`data-${next}-${a}`));
  });
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    const on = b.dataset.langBtn === next;
    b.setAttribute('aria-pressed', on);
    b.style.opacity = on ? 1 : .4;
  });
  document.querySelectorAll('[data-words]').forEach(splitWords);
  window.dispatchEvent(new CustomEvent('miles:lang', {detail: next}));
}
export function initLang() {
  document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.langBtn)));
  applyLang(lang(), false);
}
