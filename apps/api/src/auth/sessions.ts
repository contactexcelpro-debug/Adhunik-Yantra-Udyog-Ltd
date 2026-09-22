import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

/**
 * Session tokens.
 *
 * The token is random and never stored: the database holds only its SHA-256 digest, so a
 * dump of the session table cannot be replayed as a login. The cookie is httpOnly (script
 * cannot read it), sameSite=lax (not sent on cross-site posts, which is what makes CSRF
 * impractical here) and secure whenever the deployment is on https.
 */

export const SESSION_COOKIE = 'meltek_session';

/** Sessions last a working fortnight, and each use pushes the expiry out again. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Only rewrite the expiry when a meaningful slice has elapsed, to avoid a write per request. */
export const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time digest comparison, for lookups that compare in application code. */
export function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function secureCookies(): boolean {
  // Behind a TLS-terminating proxy the app itself speaks http, so this is explicit.
  return process.env.SECURE_COOKIES === 'true' || process.env.NODE_ENV === 'production';
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
  });
}

/**
 * Sign-in throttling, per email and per address.
 *
 * In-process and deliberately simple: it blunts online guessing without a dependency. A
 * multi-instance deployment should move this to the database or a shared cache — noted in
 * the README rather than pretended away.
 */
const attempts = new Map<string, { count: number; first: number; blockedUntil: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

export function throttleKey(email: string, ip: string | undefined): string {
  return `${email}|${ip ?? 'unknown'}`;
}

export function isThrottled(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.blockedUntil > now) return Math.ceil((entry.blockedUntil - now) / 1000);
  if (now - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return 0;
  }
  return 0;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = now + BLOCK_MS;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
