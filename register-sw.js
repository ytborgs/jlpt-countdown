(() => {
  if (!('serviceWorker' in navigator)) return;

  const RELOAD_GUARD = 'jlpt-sw-reload-once';
  let updateBanner;
  let refreshing = false;

  const ensureBanner = () => {
    if (updateBanner) return updateBanner;
    updateBanner = document.createElement('div');
    updateBanner.id = 'jlpt-sw-update';
    updateBanner.setAttribute('role', 'status');
    updateBanner.hidden = true;
    updateBanner.innerHTML =
      '<span>Đã có phiên bản mới.</span> ' +
      '<button type="button" id="jlpt-sw-update-btn">Cập nhật</button>';
    const style = document.createElement('style');
    style.textContent =
      '#jlpt-sw-update{position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 14px;border-radius:12px;border:1px solid #304662;background:#13243c;color:#f5f2e9;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px #0006}' +
      '#jlpt-sw-update[hidden]{display:none!important}' +
      '#jlpt-sw-update-btn{font:inherit;font-weight:650;padding:8px 12px;border-radius:8px;border:0;background:#eabb76;color:#11223a;cursor:pointer}';
    document.documentElement.append(style);
    document.documentElement.append(updateBanner);
    updateBanner.querySelector('#jlpt-sw-update-btn').addEventListener('click', () => {
      navigator.serviceWorker.getRegistration('./').then(reg => {
        const worker = reg && reg.waiting;
        if (!worker) {
          location.reload();
          return;
        }
        try { sessionStorage.setItem(RELOAD_GUARD, '1'); } catch { /* ignore */ }
        worker.postMessage({ type: 'SKIP_WAITING' });
      });
    });
    return updateBanner;
  };

  const showUpdate = () => {
    ensureBanner().hidden = false;
  };

  const trackWaiting = reg => {
    if (!reg) return;
    if (reg.waiting) showUpdate();
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
      });
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    let shouldReload = false;
    try { shouldReload = sessionStorage.getItem(RELOAD_GUARD) === '1'; } catch { /* ignore */ }
    if (!shouldReload) return;
    refreshing = true;
    try { sessionStorage.removeItem(RELOAD_GUARD); } catch { /* ignore */ }
    const hash = location.hash || '';
    location.reload();
    // Keep hash; browsers preserve it on reload.
    void hash;
  });

  const register = () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        trackWaiting(reg);
        // Periodic check while the tab stays open — does not force activate.
        setInterval(() => { try { reg.update(); } catch { /* ignore */ } }, 60 * 60 * 1000);
      })
      .catch(err => {
        console.warn('[sw]', 'register failed', err && err.message);
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();
