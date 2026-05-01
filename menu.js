// menu.js — include on every page AFTER supabase.js and auth-guard.js
// Appends user email + logout button to .menu

(async () => {
  const user = await getUser();
  if (!user) return;

  const menu = document.querySelector('.menu');

  const right = document.createElement('div');
  right.className = 'menu-right';
  right.innerHTML = `<span class="menu-user">${user.email}</span>`;

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'menu-logout';
  logoutBtn.textContent = 'logout';
  logoutBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.href = '/auth/index.html';
  };
  right.appendChild(logoutBtn);
  menu.appendChild(right);
})();
