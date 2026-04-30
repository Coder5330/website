export default function handler(req, res) {
  const key = req.headers['x-key'];

  if (key === 'k3y_f0und') {
    res.json({ secret: 'ZmxhZ3toM2FkM3JfZjB1bmR9' }); // flag{h3ad3r_f0und}
  } else {
    res.status(403).json({ error: 'wrong key' });
  }
}
