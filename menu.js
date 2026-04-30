// menu.js — include on every page AFTER supabase.js and auth-guard.js
// Appends user email + logout button to .menu

(async () => {
  const user = await getUser();
  if (!user) return;

  const menu = document.querySelector('.menu');

  const userLi = document.createElement('li');
  userLi.innerHTML = `<span class="menu-user">${user.email}</span>`;

  const logoutLi = document.createElement('li');
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'menu-logout';
  logoutBtn.textContent = 'logout';
  logoutBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.href = '/auth/index.html';
  };
  logoutLi.appendChild(logoutBtn);

  menu.appendChild(userLi);
  menu.appendChild(logoutLi);
})();
