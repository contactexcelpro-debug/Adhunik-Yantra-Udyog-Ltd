import { createServer } from '../apps/api/dist/server.js';

let handler = null;

export default async function (req, res) {
  if (!handler) {
    const { app } = await createServer();
    handler = app;
  }
  return handler(req, res);
}
