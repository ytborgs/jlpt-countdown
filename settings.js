(() => {
  const key = 'jlpt-n3-name';
  const readName = () => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const showName = () => {
    const label = document.getElementById('profile-name');
    if (label) label.textContent = readName() || 'Tên hiển thị trên trang countdown';
  };
  showName();
  window.addEventListener('pageshow', showName);
  const form = document.getElementById('profile-form');
  if (!form) return;
  const input = document.getElementById('username');
  const error = document.getElementById('profile-error');
  input.value = readName();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ').slice(0, 40);
    try { if (name) localStorage.setItem(key, name); else localStorage.removeItem(key); }
    catch { error.textContent = 'Không lưu được tên trên thiết bị này. Hãy thử lại.'; error.hidden = false; return; }
    window.location.assign('./settings.html');
  });
})();
