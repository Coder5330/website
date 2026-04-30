export default function handler(req, res) {
  res.setHeader('X-Debug-Key', 'k3y_f0und');
  res.setHeader('Access-Control-Expose-Headers', 'X-Debug-Key');
  res.json({ status: 'ok' });
}
