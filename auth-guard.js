// auth-guard.js — include this on every game page AFTER supabase.js
// Redirects to /auth/ if not logged in

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '/auth/index.html';
  }
})();

// Returns current user (call after guard has run)
async function getUser() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.user ?? null;
}
