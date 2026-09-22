import { createServer } from '../apps/api/dist/server.js';

let handler = null;

export default async function (req, res) {
  if (!handler) {
    try {
      const { app } = await createServer();
      handler = app;
    } catch (err) {
      console.error('createServer failed:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Server init failed', message: err.message }));
      return;
    }
  }
  return handler(req, res);
}
