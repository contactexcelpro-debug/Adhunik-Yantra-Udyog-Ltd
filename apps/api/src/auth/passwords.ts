import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password storage.
 *
 * scrypt from node:crypto — memory-hard, in the standard library, no native build step.
 * Each password gets its own random salt and the parameters are stored alongside the
 * hash, so the cost can be raised later without invalidating existing accounts.
 *
 * Format: scrypt$N$r$p$<salt base64>$<hash base64>
 */

const KEYLEN = 64;
const SALT_BYTES = 16;
// ~100ms on a typical works machine. Raise N when hardware allows; old hashes keep working.
const PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/**
 * Constant-time verification. Returns false rather than throwing on a malformed record,
 * so a corrupted row cannot be told apart from a wrong password.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[4]!, 'base64');
    const expected = Buffer.from(parts[5]!, 'base64');
    const actual = await scrypt(password.normalize('NFKC'), salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
