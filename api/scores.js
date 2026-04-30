import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET  /api/scores?game=clicker   → load scores
// POST /api/scores                → save scores
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'not logged in' });

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'invalid session' });

  if (req.method === 'GET') {
    const game = req.query.game;
    const { data } = await sb.from('scores')
      .select('*')
      .eq('player_id', user.id)
      .eq('game', game)
      .single();
    return res.json({ data: data || null });
  }

  if (req.method === 'POST') {
    const { game, payload } = req.body;
    // payload is a JSON object, e.g. { score, gpc, gps } for clicker
    await sb.from('scores').upsert(
      { player_id: user.id, game, payload },
      { onConflict: 'player_id,game' }
    );
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
