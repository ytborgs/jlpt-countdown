/* Classic, blocking head script: resolve the palette before styles render. */
(() => {
  const KEY = 'jlpt-n3-theme-v1';
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'system';
  const read = () => {
    try { return normalize(localStorage.getItem(KEY)); }
    catch { return 'system'; }
  };
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = read();
  const apply = () => {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0b1729' : '#f5f0e6';
    for (const input of document.querySelectorAll('input[name="theme"]')) {
      input.checked = input.value === preference;
    }
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('change', event => {
    if (!event.target.matches('input[name="theme"]')) return;
    preference = normalize(event.target.value);
    apply();
    const error = document.getElementById('theme-error');
    try {
      localStorage.setItem(KEY, preference);
      if (error) error.hidden = true;
    } catch {
      if (error) {
        error.textContent = 'Đã đổi giao diện. Không lưu được lựa chọn trên thiết bị này.';
        error.hidden = false;
      }
    }
  });
  const onSystemChange = () => { if (preference === 'system') apply(); };
  if (system.addEventListener) system.addEventListener('change', onSystemChange);
  else system.addListener(onSystemChange);
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try { if (event.storageArea !== localStorage) return; }
    catch { return; }
    preference = read();
    apply();
  });
  // A page restored from the back/forward cache may have missed storage changes.
  window.addEventListener('pageshow', () => { preference = read(); apply(); });
})();
