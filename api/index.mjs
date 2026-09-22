import { createServer } from '../apps/api/dist/server.js';

let handler = null;
let initError = null;

export default async function (req, res) {
  if (initError) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server init failed', message: initError.message }));
    return;
  }
  if (!handler) {
    try {
      const { app } = await createServer();
      handler = app;
    } catch (err) {
      initError = err;
      console.error('createServer failed:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Server init failed', message: err.message }));
      return;
    }
  }
  return handler(req, res);
}
