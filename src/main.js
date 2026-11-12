import {startBus, reduced, siteReady} from './core.js';
import {initLang} from './lang.js';
import {initWords} from './words.js';
import {initMarquees, initReveal, initCursor, initNavPaint, initTransitions, initLoader} from './ui.js';
import {initHero, initIntro, initFeatures} from './home.js';
import {initWork, initMedia, initStudio} from './pages.js';
import {mountRibbon} from './ribbon.js';
import {initMotionControls} from './motion.js';

function initRig() {
  const host = document.querySelector('[data-rig]');
  if (!host) return;
  const useRibbon = () => {
    if (host.dataset.mode === 'ribbon') return;
    host.dataset.mode = 'ribbon';
    host.querySelectorAll('canvas').forEach(c => c.remove());
    window.__milesDebug = Object.assign(window.__milesDebug || {}, {rigMode: 'ribbon'});
    mountRibbon(host);
  };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (coarse || !hasGL || reduced || new URLSearchParams(location.search).has('nowebgl')) return useRibbon();
  host.dataset.mode = 'webgl';
  window.__milesDebug = Object.assign(window.__milesDebug || {}, {rigMode: 'webgl'});
  import('./lanyard.js').then(m => m.mountLanyard(host, {onGiveUp: useRibbon})).catch(err => { console.warn('[miles] lanyard failed', err.message); useRibbon(); });
}

initLang();
initMotionControls();
initWords();
startBus();
initMarquees();
initReveal();
initCursor();
initNavPaint();
initTransitions();
initLoader();
initHero();
initIntro();
initFeatures();
initWork();
initMedia();
initStudio();
initRig();
if (document.fonts?.ready) document.fonts.ready.then(() => window.dispatchEvent(new Event('resize')));
window.__milesDebug = Object.assign(window.__milesDebug || {}, {ready: () => siteReady});
