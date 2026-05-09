// Character counter
const input = document.getElementById('fb-input');
const counter = document.getElementById('fb-count');
input.addEventListener('input', () => { counter.textContent = input.value.length; });

async function submitFeedback() {
  const msg = input.value.trim();
  const statusEl = document.getElementById('fb-msg');
  const btn = document.getElementById('fb-btn');

  statusEl.className = 'fb-msg';
  statusEl.textContent = '';

  if (!msg) { statusEl.textContent = 'Please write something first.'; return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/auth/index.html'; return; }

  const { data: userRow } = await sb.from('users').select('display_name, email').eq('id', session.user.id).single();
  const displayName = userRow?.display_name || userRow?.email || session.user.email;

  const { error } = await sb.from('feedback').insert({
    user_id:      session.user.id,
    user_email:   session.user.email,
    display_name: displayName,
    message:      msg,
  });

  if (error) {
    statusEl.textContent = 'Something went wrong — try again.';
    btn.textContent = 'Send feedback';
    btn.disabled = false;
    return;
  }

  statusEl.className = 'fb-msg ok';
  statusEl.textContent = '✓ Sent! Thanks for the feedback.';
  input.value = '';
  counter.textContent = '0';
  btn.textContent = 'Send feedback';
  btn.disabled = false;
}

// Ctrl/Cmd+Enter to submit
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitFeedback();
});
