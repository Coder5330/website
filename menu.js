// menu.js — include on every page AFTER supabase.js and auth-guard.js

function _initials(user) {
  const name = user.user_metadata?.display_name;
  if (name) return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return user.email[0].toUpperCase();
}

function _avatarColor(id) {
  let h = 0;
  for (const c of id) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 60%, 42%)`;
}

(async () => {
  const user = await getUser();
  if (!user) return;

  const menu = document.querySelector('.menu');

  const right = document.createElement('div');
  right.className = 'menu-right';

  const avatar = document.createElement('button');
  avatar.className = 'menu-avatar';
  avatar.style.background = _avatarColor(user.id);
  avatar.textContent = _initials(user);

  const dropdown = document.createElement('div');
  dropdown.className = 'menu-dropdown';
  dropdown.innerHTML = `
    <div class="dd-item" data-a="profile">Profile</div>
    <div class="dd-item" data-a="settings">Settings</div>
    <div class="dd-sep"></div>
    <div class="dd-item" data-a="signout">Sign out</div>
    <div class="dd-item dd-danger" data-a="delete">Delete account</div>`;

  right.appendChild(avatar);
  menu.appendChild(right);
  document.body.appendChild(dropdown);

  let dropOpen = false;

  avatar.onclick = e => {
    e.stopPropagation();
    dropOpen = !dropOpen;
    if (dropOpen) {
      const rect = avatar.getBoundingClientRect();
      dropdown.style.top   = (rect.bottom + 8) + 'px';
      dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    }
    dropdown.classList.toggle('dd-open', dropOpen);
  };

  document.addEventListener('click', () => {
    dropOpen = false;
    dropdown.classList.remove('dd-open');
  });

  dropdown.addEventListener('click', async e => {
    const action = e.target.closest('[data-a]')?.dataset.a;
    if (!action) return;
    dropOpen = false;
    dropdown.classList.remove('dd-open');
    if (action === 'profile')  window.location.href = '/account/index.html';
    if (action === 'settings') window.location.href = '/account/index.html#settings';
    if (action === 'signout')  { await sb.auth.signOut(); window.location.href = '/auth/index.html'; }
    if (action === 'delete')   window.location.href = '/account/index.html#delete';
  });
})();
