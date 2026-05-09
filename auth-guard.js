// auth-guard.js — include this on every game page AFTER supabase.js

// Extract Supabase's own session_id from the JWT — no localStorage needed
function _getSessionId(session) {
  try {
    const b64 = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).session_id ?? null;
  } catch { return null; }
}

let _mySessionId = null;

async function _checkBlacklist(email) {
  const { data } = await sb.from('blacklist').select('email').eq('email', email).maybeSingle();
  if (data) {
    await sb.auth.signOut();
    window.location.href = '/auth/index.html?banned=1';
  }
}

// Call this instead of sb.auth.signOut() to also clear session token
async function signOutClean() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return; // nothing to sign out of
  await sb.from('users').update({ session_token: null }).eq('id', session.user.id);
  await sb.auth.signOut();
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '/auth/index.html';
    return;
  }

  // Block unconfirmed accounts from accessing any protected page
  if (!session.user.email_confirmed_at) {
    await sb.auth.signOut();
    window.location.href = '/auth/index.html?confirm=1';
    return;
  }

  const email = session.user.email;
  const uid = session.user.id;
  _mySessionId = _getSessionId(session);

  await _checkBlacklist(email);

  // Heartbeat — keep last_seen current so online count is accurate
  const _ping = () => sb.from('users').update({ last_seen: new Date().toISOString() }).eq('id', uid);
  _ping();
  setInterval(_ping, 30_000);

  // Verify session token matches — kick if someone else logged in
  const { data: userData } = await sb.from('users').select('session_token').eq('id', uid).single();
  if (userData?.session_token && _mySessionId !== userData.session_token) {
    await sb.auth.signOut();
    window.location.href = '/auth/index.html?kicked=1';
    return;
  }

  // Realtime: instant kick if session token changes (new login on another device)
  sb.channel('session-watch')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}`
    }, payload => {
      if (payload.new.session_token !== _mySessionId) {
        sb.auth.signOut().then(() => {
          window.location.href = '/auth/index.html?kicked=1';
        });
      }
    })
    .subscribe();

  // Realtime: instant logout if blacklisted
  sb.channel('blacklist-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blacklist' }, payload => {
      if (payload.new.email === email) {
        sb.auth.signOut().then(() => {
          window.location.href = '/auth/index.html?banned=1';
        });
      }
    })
    .subscribe();
})();

async function getUser() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.user ?? null;
}
