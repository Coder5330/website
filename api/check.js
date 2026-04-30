export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { level, flag } = req.body;

  const FLAGS = {
    tutorial: 'flag{h0w_d4r3_y0u_s01v3_1t}',
    level1: 'flag{jwt_c00k13_n3t}',
    level2: 'flag{h3ad3r_f0und}'
  };

  if (!FLAGS[level]) return res.status(400).json({ error: 'unknown level' });

  res.json({ correct: FLAGS[level] === flag });
}
