import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src/store/schema.sql');
const dest = resolve(here, '../dist/store/schema.sql');
await mkdir(dirname(dest), { recursive: true });
await cp(src, dest);
console.log('copied schema.sql');

const srcMysql = resolve(here, '../src/store/schema.mysql.sql');
const destMysql = resolve(here, '../dist/store/schema.mysql.sql');
await cp(srcMysql, destMysql);
console.log('copied schema.mysql.sql');
