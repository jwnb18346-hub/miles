// 跟随系统是默认值；用户可明确选择开启动效或减少动态。
export function initMotionControls() {
  const root = document.documentElement;
  const preference = root.dataset.motionPreference || 'system';
  document.querySelectorAll('[data-motion-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.motionChoice === preference));
    button.addEventListener('click', () => {
      const next = button.dataset.motionChoice;
      const url = new URL(location.href);
      url.searchParams.set('motion', next);
      // 选择写入由页面启动代码负责；禁用存储时也能通过 URL 应用。
      location.replace(url.href);
    });
  });
}
