import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // use service key server-side
);

const FLAGS = {
  tutorial: 'flag{h0w_d4r3_y0u_s01v3_1t}',
  level1:   'flag{jwt_c00k13_n3t}',
  level2:   'flag{h3ad3r_f0und}'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { level, flag } = req.body;

  if (!FLAGS[level]) return res.status(400).json({ error: 'unknown level' });
  if (FLAGS[level] !== flag) return res.json({ correct: false });

  // Get user from auth header
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'not logged in' });

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'invalid session' });

  // Save progress (ignore duplicate errors)
  await sb.from('ctf_progress').upsert(
    { player_id: user.id, level },
    { onConflict: 'player_id,level' }
  );

  return res.json({ correct: true });
}
