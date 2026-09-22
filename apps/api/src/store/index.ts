import { JsonStore } from './json-store.js';
import { PgStore } from './pg-store.js';
import type { Store } from './types.js';

export * from './types.js';
export { JsonStore } from './json-store.js';
export { PgStore } from './pg-store.js';

/**
 * Storage selection.
 *
 * DATABASE_URL set  -> PostgreSQL, schema.sql applied idempotently at boot (§7).
 * otherwise         -> file-backed JSON store, so the app runs with no infrastructure.
 */
export async function createStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  const store: Store = url
    ? new PgStore(url, process.env.PGSSL === 'true')
    : new JsonStore(process.env.DATA_FILE ?? 'data/meltek.json');
  await store.init();
  return store;
}
