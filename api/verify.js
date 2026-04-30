export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['authorization'];

  if (!token) return res.status(401).json({ error: 'no token' });

  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    if (payload.role === 'admin') {
      res.json({ secret: 'ZmxhZ3tqd3RfYzAwazEzX24zdH0=' }); // base64 flag
    } else {
      res.status(403).json({ error: 'access denied' });
    }
  } catch {
    res.status(400).json({ error: 'invalid token' });
  }
}
