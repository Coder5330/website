const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'text/plain'
]);

const FILE_ICONS = {
  'application/pdf': '📄',
  'application/msword': '📝', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-powerpoint': '📊', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'application/vnd.ms-excel': '📈', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📈',
  'image/png': '🖼️', 'image/jpeg': '🖼️', 'text/plain': '📃'
};

let meId = null, meRow = null;

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _size(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/1024/1024).toFixed(1) + ' MB';
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  meId = session.user.id;
  const { data } = await sb.from('users').select('role, display_name, email').eq('id', meId).single();
  meRow = data;

  await loadFiles();

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('over'); handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); fileInput.value = ''; });
})();

async function loadFiles() {
  const el = document.getElementById('hw-list');
  const { data, error } = await sb.from('homework_files').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<p class="muted">Error: ${_esc(error.message)}</p>`; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="muted">No files uploaded yet.</p>'; return; }

  const isOwner = meRow?.role === 'owner';
  el.innerHTML = data.map(f => {
    const icon = FILE_ICONS[f.file_type] || '📁';
    const canDel = f.uploader_id === meId || isOwner;
    return `<div class="hw-file" id="hw-${f.id}">
      <div class="hw-icon">${icon}</div>
      <div class="hw-info">
        <div class="hw-name">${_esc(f.filename)}</div>
        <div class="hw-meta">${_esc(f.uploader_name)} · ${_size(f.file_size)} · ${new Date(f.created_at).toLocaleDateString()}</div>
      </div>
      <div class="hw-actions">
        <button class="hw-btn" onclick="downloadFile('${f.storage_path}','${_esc(f.filename)}')">Download</button>
        ${canDel ? `<button class="hw-btn-del" onclick="deleteFile('${f.id}','${f.storage_path}',this)">del</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function handleFile(file) {
  const st = document.getElementById('upload-st');
  if (!file) return;
  if (!ALLOWED_TYPES.has(file.type)) { st.textContent = 'File type not allowed.'; st.className = 'field-status'; return; }
  if (file.size > MAX_SIZE) { st.textContent = 'File too large (max 10MB).'; st.className = 'field-status'; return; }

  st.textContent = ''; st.className = 'field-status';
  document.getElementById('drop-zone').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'block';

  const path = `${meId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error: upErr } = await sb.storage.from('homework').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });

  document.getElementById('progress-bar').style.width = '100%';

  if (upErr) {
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('upload-progress').style.display = 'none';
    st.textContent = 'Upload failed: ' + upErr.message; st.className = 'field-status';
    return;
  }

  const { error: dbErr } = await sb.from('homework_files').insert({
    uploader_id: meId,
    uploader_name: meRow?.display_name || meRow?.email,
    filename: file.name,
    file_size: file.size,
    file_type: file.type,
    storage_path: path
  });

  document.getElementById('drop-zone').style.display = 'block';
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('progress-bar').style.width = '0%';

  if (dbErr) { st.textContent = 'DB error: ' + dbErr.message; st.className = 'field-status'; return; }

  st.textContent = 'Uploaded!'; st.className = 'field-status ok';
  setTimeout(() => { st.textContent = ''; }, 3000);
  await loadFiles();
}

async function downloadFile(path, filename) {
  const { data, error } = await sb.storage.from('homework').createSignedUrl(path, 60);
  if (error) { alert('Download failed: ' + error.message); return; }
  const a = document.createElement('a');
  a.href = data.signedUrl; a.download = filename; a.click();
}

async function deleteFile(id, path, btn) {
  if (!confirm('Delete this file?')) return;
  btn.disabled = true;
  await sb.storage.from('homework').remove([path]);
  await sb.from('homework_files').delete().eq('id', id);
  document.getElementById('hw-' + id)?.remove();
}
