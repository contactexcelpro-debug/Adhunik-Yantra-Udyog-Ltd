import { JsonStore } from './json-store.js';
import { PgStore } from './pg-store.js';
import { MysqlStore } from './mysql-store.js';
import type { Store } from './types.js';

export * from './types.js';
export { JsonStore } from './json-store.js';
export { PgStore } from './pg-store.js';
export { MysqlStore } from './mysql-store.js';

/**
 * Storage selection.
 *
 * MYSQL_URL set      -> MySQL 8, schema.mysql.sql applied idempotently at boot.
 * DATABASE_URL set   -> PostgreSQL, schema.sql applied idempotently at boot.
 * otherwise          -> file-backed JSON store, so the app runs with no infrastructure.
 */
export async function createStore(): Promise<Store> {
  const mysqlUrl = process.env.MYSQL_URL;
  const pgUrl = process.env.DATABASE_URL;
  let store: Store;
  if (mysqlUrl) {
    store = new MysqlStore(mysqlUrl);
  } else if (pgUrl) {
    store = new PgStore(pgUrl, process.env.PGSSL === 'true');
  } else {
    store = new JsonStore(process.env.DATA_FILE ?? 'data/meltek.json');
  }
  await store.init();
  return store;
}
