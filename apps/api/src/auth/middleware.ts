import type { NextFunction, Request, Response } from 'express';
import { can, type Permission } from '@meltek/schema';
import type { Store, User } from '../store/index.js';
import {
  SESSION_COOKIE, SESSION_REFRESH_AFTER_MS, SESSION_TTL_MS, clearSessionCookie,
  hashToken, setSessionCookie,
} from './sessions.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** The signed-in account, set by attachUser. Absent when the request is anonymous. */
    user?: User;
    sessionToken?: string;
  }
}

const store_ = (req: Request): Store => (req.app.locals.store as Store);

/**
 * Resolve the session cookie to an account, if there is one.
 *
 * Runs on every request and never rejects — the gate is `requireAuth`. A session whose
 * account has been deleted or disabled is dropped here, so disabling an account takes
 * effect on the holder's next request rather than at their next sign-in.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) return next();

    const store = store_(req);
    const tokenHash = hashToken(token);
    const session = await store.getSession(tokenHash);
    if (!session) {
      clearSessionCookie(res);
      return next();
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await store.deleteSession(tokenHash);
      clearSessionCookie(res);
      return next();
    }

    const account = await store.getUser(session.userId);
    if (!account || !account.isActive) {
      await store.deleteSession(tokenHash);
      clearSessionCookie(res);
      return next();
    }

    // Rolling expiry, written only once a day so an active session is not a write per request.
    const age = SESSION_TTL_MS - (new Date(session.expiresAt).getTime() - Date.now());
    if (age > SESSION_REFRESH_AFTER_MS) {
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await store.touchSession(tokenHash, expiresAt.toISOString());
      setSessionCookie(res, token, expiresAt);
    }

    const { passwordHash: _passwordHash, ...user } = account;
    req.user = user;
    req.sessionToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in to continue.', code: 'UNAUTHENTICATED' });
    return;
  }
  next();
}

/**
 * Gate a route on a permission from the shared role matrix.
 *
 * The message names the role that would allow it, so the operator knows who to ask
 * instead of being told only that they cannot.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.', code: 'UNAUTHENTICATED' });
      return;
    }
    if (!can(req.user.role, permission)) {
      const article = /^[aeiou]/i.test(req.user.role) ? 'an' : 'a';
      res.status(403).json({
        error: `Your account is ${article} ${req.user.role} and cannot do this. Ask an administrator if you need the change.`,
        code: 'FORBIDDEN',
        permission,
      });
      return;
    }
    next();
  };
}
