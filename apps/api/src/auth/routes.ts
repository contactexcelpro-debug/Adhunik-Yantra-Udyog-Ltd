import { Router, type NextFunction, type Request, type Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  changePasswordSchema, loginSchema, setupSchema, userCreateSchema, userUpdateSchema,
  ROLE_PERMISSIONS,
} from '@meltek/schema';
import type { AuditEntry, Store, UserWithSecret } from '../store/index.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { requireAuth, requirePermission } from './middleware.js';
import {
  SESSION_TTL_MS, clearFailures, clearSessionCookie, hashToken, isThrottled,
  newSessionToken, recordFailure, setSessionCookie, throttleKey,
} from './sessions.js';

const store_ = (req: Request): Store => (req.app.locals.store as Store);

const audit = (
  store: Store, entityId: string, action: string, actor: string, before: unknown, after: unknown,
): Promise<void> => {
  const entry: AuditEntry = {
    id: randomUUID(), entity: 'user', entityId, action, actor,
    before, after, at: new Date().toISOString(),
  };
  return store.audit(entry);
};

/** Never log or return the hash, and never echo a password back. */
const publicUser = (u: UserWithSecret) => {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
};

export function buildAuthRouter(): Router {
  const r = Router();
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

  /**
   * Whether the system has been set up yet, and who is signed in.
   * Deliberately anonymous: the sign-in screen needs it before there is a session.
   */
  r.get('/auth/session', wrap(async (req, res) => {
    const store = store_(req);
    const userCount = await store.countUsers();
    res.json({
      needsSetup: userCount === 0,
      user: req.user ?? null,
      permissions: req.user ? ROLE_PERMISSIONS[req.user.role] : [],
    });
  }));

  /**
   * First-run setup. Creates the first administrator and signs them in.
   * Only works while no accounts exist, so it cannot be used to add one later.
   */
  r.post('/auth/setup', wrap(async (req, res) => {
    const store = store_(req);
    if ((await store.countUsers()) > 0) {
      return res.status(409).json({
        error: 'This system is already set up. Sign in, or ask an administrator for an account.',
      });
    }

    const body = setupSchema.parse(req.body);
    const now = new Date().toISOString();
    const user: UserWithSecret = {
      id: randomUUID(),
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: 'admin',
      isActive: true,
      isProtected: false,
      createdAt: now,
      updatedAt: now,
      lastSignInAt: now,
    };
    await store.createUser(user);
    await audit(store, user.id, 'setup', body.email, null, { email: body.email, role: 'admin' });

    await startSession(store, req, res, user);
    return res.status(201).json({ user: publicUser(user), permissions: ROLE_PERMISSIONS.admin });
  }));

  r.post('/auth/login', wrap(async (req, res) => {
    const store = store_(req);
    const body = loginSchema.parse(req.body);
    const key = throttleKey(body.email, req.ip);

    const blockedFor = isThrottled(key);
    if (blockedFor > 0) {
      return res.status(429).json({
        error: `Too many sign-in attempts. Try again in ${Math.ceil(blockedFor / 60)} minutes.`,
        code: 'THROTTLED',
      });
    }

    const account = await store.getUserByEmail(body.email);
    // Verify even when there is no such account, so the response time does not reveal
    // which addresses exist. The message is identical either way.
    const ok = account
      ? await verifyPassword(body.password, account.passwordHash)
      : await verifyPassword(body.password, 'scrypt$16384$8$1$AAAA$AAAA');

    if (!account || !ok) {
      recordFailure(key);
      req.log.warn({ email: body.email, ip: req.ip }, 'failed sign-in');
      return res.status(401).json({ error: 'That email and password do not match.' });
    }

    if (!account.isActive) {
      recordFailure(key);
      return res.status(403).json({
        error: 'This account has been disabled. Ask an administrator to re-enable it.',
      });
    }

    clearFailures(key);
    account.lastSignInAt = new Date().toISOString();
    await store.updateUser(account);
    await startSession(store, req, res, account);

    return res.json({ user: publicUser(account), permissions: ROLE_PERMISSIONS[account.role] });
  }));

  r.post('/auth/logout', wrap(async (req, res) => {
    const store = store_(req);
    if (req.sessionToken) await store.deleteSession(hashToken(req.sessionToken));
    clearSessionCookie(res);
    res.status(204).end();
  }));

  /** Change your own password. Signs out every other session on success. */
  r.post('/auth/password', requireAuth, wrap(async (req, res) => {
    const store = store_(req);
    const body = changePasswordSchema.parse(req.body);
    const account = await store.getUser(req.user!.id);
    if (!account) return res.status(404).json({ error: 'That account no longer exists.' });

    if (!(await verifyPassword(body.currentPassword, account.passwordHash))) {
      req.log.warn({ userId: account.id }, 'failed password change');
      return res.status(403).json({ error: 'Your current password is not correct.' });
    }

    account.passwordHash = await hashPassword(body.newPassword);
    account.updatedAt = new Date().toISOString();
    await store.updateUser(account);

    // Everything else signs out, then this session is issued fresh.
    await store.deleteSessionsForUser(account.id);
    await startSession(store, req, res, account);
    await audit(store, account.id, 'change password', account.email, null, null);

    return res.json({ ok: true });
  }));

  /* ─────────── user administration ─────────── */

  r.get('/users', requirePermission('users.manage'), wrap(async (req, res) => {
    res.json(await store_(req).listUsers());
  }));

  r.post('/users', requirePermission('users.manage'), wrap(async (req, res) => {
    const store = store_(req);
    const body = userCreateSchema.parse(req.body);

    if (await store.getUserByEmail(body.email)) {
      return res.status(409).json({ error: `An account already exists for ${body.email}.` });
    }

    const now = new Date().toISOString();
    const user: UserWithSecret = {
      id: randomUUID(),
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: body.role,
      isActive: true,
      isProtected: false,
      createdAt: now,
      updatedAt: now,
      lastSignInAt: null,
    };
    const created = await store.createUser(user);
    await audit(store, user.id, 'create user', req.user!.email, null, { email: user.email, role: user.role });
    return res.status(201).json(created);
  }));

  r.patch('/users/:id', requirePermission('users.manage'), wrap(async (req, res) => {
    const store = store_(req);
    const id = String((req.params as Record<string, unknown>).id ?? '');
    const account = await store.getUser(id);
    if (!account) return res.status(404).json({ error: 'No account with that id.' });

    const body = userUpdateSchema.parse(req.body);
    const before = publicUser(account);

    // The built-in administrator exists so the works can always get back in. Its name,
    // email and password are all changeable - what is fixed is that it stays an enabled
    // administrator.
    if (account.isProtected && body.role && body.role !== 'admin') {
      return res.status(409).json({
        error: 'The built-in administrator cannot be given another role. Create a separate account for that.',
        code: 'PROTECTED_ACCOUNT',
      });
    }
    if (account.isProtected && body.isActive === false) {
      return res.status(409).json({
        error: 'The built-in administrator cannot be disabled. It is the way back in if every other account is lost.',
        code: 'PROTECTED_ACCOUNT',
      });
    }

    // An administrator must not be able to lock the works out of its own system.
    const losingAdmin =
      account.role === 'admin' && ((body.role && body.role !== 'admin') || body.isActive === false);
    if (losingAdmin && (await lastActiveAdmin(store, account.id))) {
      return res.status(409).json({
        error: 'This is the last active administrator. Promote another account first.',
        code: 'LAST_ADMIN',
      });
    }

    if (body.email && body.email !== account.email) {
      const clash = await store.getUserByEmail(body.email);
      if (clash && clash.id !== account.id) {
        return res.status(409).json({ error: `An account already exists for ${body.email}.` });
      }
      account.email = body.email;
    }
    if (body.name) account.name = body.name;
    if (body.role) account.role = body.role;
    if (body.isActive !== undefined) account.isActive = body.isActive;
    if (body.password) account.passwordHash = await hashPassword(body.password);
    account.updatedAt = new Date().toISOString();

    const updated = await store.updateUser(account);

    // A changed password, a changed role or a disabled account ends existing sessions,
    // so the change takes effect immediately rather than at the next sign-in.
    if (body.password || body.role || body.isActive === false) {
      await store.deleteSessionsForUser(account.id);
    }

    await audit(store, account.id, 'update user', req.user!.email, before, publicUser(account));
    return res.json(updated);
  }));

  r.delete('/users/:id', requirePermission('users.manage'), wrap(async (req, res) => {
    const store = store_(req);
    const id = String((req.params as Record<string, unknown>).id ?? '');
    const account = await store.getUser(id);
    if (!account) return res.status(404).json({ error: 'No account with that id.' });

    if (account.isProtected) {
      return res.status(409).json({
        error: 'The built-in administrator cannot be deleted. It is recreated at startup if it ever goes missing.',
        code: 'PROTECTED_ACCOUNT',
      });
    }
    if (account.id === req.user!.id) {
      return res.status(409).json({ error: 'You cannot delete the account you are signed in with.' });
    }
    if (account.role === 'admin' && (await lastActiveAdmin(store, account.id))) {
      return res.status(409).json({
        error: 'This is the last active administrator. Promote another account first.',
        code: 'LAST_ADMIN',
      });
    }

    await store.deleteUser(account.id);
    await audit(store, account.id, 'delete user', req.user!.email, publicUser(account), null);
    return res.status(204).end();
  }));

  return r;
}

async function lastActiveAdmin(store: Store, exceptId: string): Promise<boolean> {
  const users = await store.listUsers();
  return !users.some((u) => u.role === 'admin' && u.isActive && u.id !== exceptId);
}

async function startSession(
  store: Store, req: Request, res: Response, user: UserWithSecret,
): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await store.createSession({
    tokenHash: hashToken(token),
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip ?? null,
  });
  setSessionCookie(res, token, expiresAt);
  // Opportunistic tidy-up; there is no scheduler in a single-process deployment.
  void store.purgeExpiredSessions().catch(() => undefined);
}

/**
 * The built-in administrator.
 *
 * Created at every startup if it is not already there, so the works can never be locked
 * out of its own system — delete the data file, lose every password, and the next boot
 * still has a way in.
 *
 * The password comes from MELTEK_ADMIN_PASSWORD. When that is not set, a strong one is
 * generated and written to the log **once**, at creation. It is deliberately not a fixed
 * default: an undeletable account with a password anyone could look up is a back door,
 * and this account is the one most worth protecting.
 */
export async function seedProtectedAdmin(
  store: Store,
  log: (msg: string) => void,
): Promise<void> {
  const email = (process.env.MELTEK_ADMIN_EMAIL ?? 'admin@meltek.local').trim().toLowerCase();

  // Already present, under this address or another: nothing to do. An existing account
  // is never re-passworded on boot, or a restart would undo a password change.
  const existingUsers = await store.listUsers();
  if (existingUsers.some((u) => u.isProtected)) return;

  const claimed = await store.getUserByEmail(email);
  if (claimed) {
    // Someone created an ordinary account at this address first. Promote it rather than
    // colliding on the unique email, and say so.
    const account = await store.getUser(claimed.id);
    if (!account) return;
    account.isProtected = true;
    account.role = 'admin';
    account.isActive = true;
    account.updatedAt = new Date().toISOString();
    await store.updateUser(account);
    log(`marked the existing account ${email} as the built-in administrator`);
    return;
  }

  const configured = process.env.MELTEK_ADMIN_PASSWORD;
  if (configured && configured.length < 12) {
    log('MELTEK_ADMIN_PASSWORD is shorter than 12 characters. Using a generated password instead.');
  }
  const usable = configured && configured.length >= 12 ? configured : null;
  const password = usable ?? randomBytes(18).toString('base64url');

  const now = new Date().toISOString();
  await store.createUser({
    id: randomUUID(),
    name: process.env.MELTEK_ADMIN_NAME ?? 'Administrator',
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    isActive: true,
    isProtected: true,
    createdAt: now,
    updatedAt: now,
    lastSignInAt: null,
  });

  if (usable) {
    log(`created the built-in administrator ${email} with the configured password`);
  } else {
    // The only time this value is ever printed.
    log(
      `created the built-in administrator\n` +
      `    email:    ${email}\n` +
      `    password: ${password}\n` +
      `    This is shown once. Sign in and change it, or set MELTEK_ADMIN_PASSWORD.`,
    );
  }
}
