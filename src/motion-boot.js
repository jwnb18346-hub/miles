/* 在模块加载前统一 CSS 与 JS 的动效偏好；不发送设备或错误数据。 */
(function () {
  var root = document.documentElement;
  var valid = function (v) { return v === 'full' || v === 'reduce' || v === 'system'; };
  var pref = 'system';
  try {
    var saved = localStorage.getItem('miles-motion');
    if (valid(saved)) pref = saved;
  } catch (e) {}
  var found = /(?:^|[?&])motion=(full|reduce|system)(?:&|$)/.exec(location.search);
  if (found) {
    pref = found[1];
    try { localStorage.setItem('miles-motion', pref); } catch (e) {}
  }
  var systemReduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.setAttribute('data-motion-preference', pref);
  root.setAttribute('data-system-reduced', String(systemReduced));
  root.setAttribute('data-motion', pref === 'reduce' || (pref === 'system' && systemReduced) ? 'reduce' : 'full');
})();
