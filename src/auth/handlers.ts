import { eq, isNull, and } from 'drizzle-orm';
import { users, usersPrivate, refreshTokens } from '@/db/schema/index.ts';
import { AUTH_CONFIG, TOKEN_TYPES } from './config.ts';
import type { Database } from '@/db/index.ts';

export async function hashRefreshToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Buffer.from(hashBuffer).toString('hex');
}

async function generateAndStoreRefreshToken(db: Database, jwt: JwtSigner, userId: string) {
  const rawToken = await jwt.sign({
    sub: userId,
    tt: TOKEN_TYPES.refresh,
    exp: `${AUTH_CONFIG.refreshTokenTTL}s`,
    jti: crypto.randomUUID(),
  });
  const tokenHash = await hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.refreshTokenTTL * 1000);

  await db.insert(refreshTokens).values({
    tokenHash,
    expiresAt,
    userId,
  });

  return rawToken;
}

type JwtSigner = { sign(payload: Record<string, unknown>): Promise<string> };

export async function signUp(
  db: Database,
  jwt: JwtSigner,
  body: { email: string; password: string; username: string },
) {
  const { email, password, username } = body;
  const passwordHash = await Bun.password.hash(password, 'argon2id');

  let newUserId: string;
  try {
    newUserId = await db.transaction(async (tx) => {
      const existingEmail = await tx
        .select({ userId: usersPrivate.userId })
        .from(usersPrivate)
        .where(eq(usersPrivate.email, email.toLowerCase()))
        .limit(1);

      if (existingEmail.length > 0) {
        throw new ConflictError('Email already taken');
      }

      const existingUsername = await tx
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUsername.length > 0) {
        throw new ConflictError('Username already taken');
      }

      const [newUser] = await tx.insert(users).values({ username }).returning();
      await tx.insert(usersPrivate).values({
        userId: newUser!.userId,
        email: email.toLowerCase(),
        passwordHash,
      });

      return newUser!.userId;
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return { status: 409 as const, data: { error: err.message } };
    }
    if (isUniqueViolation(err)) {
      const message = String(err).includes('email') ? 'Email already taken' : 'Username already taken';
      return { status: 409 as const, data: { error: message } };
    }
    throw err;
  }

  const authToken = await jwt.sign({ sub: newUserId, username, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
  const refreshToken = await generateAndStoreRefreshToken(db, jwt, newUserId);

  return {
    status: 201 as const,
    data: {
      authToken,
      refreshToken,
      user: { userId: newUserId, username },
    },
  };
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
}

export async function signIn(
  db: Database,
  jwt: JwtSigner,
  body: { email: string; password: string },
) {
  const { email, password } = body;

  const result = await db
    .select({
      userId: users.userId,
      username: users.username,
      passwordHash: usersPrivate.passwordHash,
      deletedAt: users.deletedAt,
    })
    .from(usersPrivate)
    .innerJoin(users, eq(users.userId, usersPrivate.userId))
    .where(eq(usersPrivate.email, email.toLowerCase()))
    .limit(1);

  const user = result[0];

  if (!user || user.deletedAt !== null) {
    return { status: 401 as const, data: { error: 'Invalid credentials' } };
  }

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    return { status: 401 as const, data: { error: 'Invalid credentials' } };
  }

  const authToken = await jwt.sign({ sub: user.userId, username: user.username, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
  const refreshToken = await generateAndStoreRefreshToken(db, jwt, user.userId);

  return {
    status: 200 as const,
    data: {
      authToken,
      refreshToken,
      user: { userId: user.userId, username: user.username },
    },
  };
}

export async function signOut(
  db: Database,
  body: { refreshToken: string },
) {
  const tokenHash = await hashRefreshToken(body.refreshToken);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  return { status: 200 as const, data: { success: true } };
}

type JwtVerifier = { verify(token: string): Promise<Record<string, unknown> | false> };

export async function refresh(
  db: Database,
  jwt: JwtSigner,
  jwtVerify: JwtVerifier,
  body: { refreshToken: string },
) {
  const refreshPayload = await jwtVerify.verify(body.refreshToken);
  if (!refreshPayload || refreshPayload.tt !== TOKEN_TYPES.refresh) {
    return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
  }

  const tokenHash = await hashRefreshToken(body.refreshToken);

  const result = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  const stored = result[0];

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    }
    return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
  }

  const userResult = await db
    .select({ userId: users.userId, username: users.username })
    .from(users)
    .where(and(eq(users.userId, stored.userId), isNull(users.deletedAt)))
    .limit(1);

  const user = userResult[0];
  if (!user) {
    return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
  }

  const authToken = await jwt.sign({ sub: user.userId, username: user.username, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
  const remainingSeconds = (stored.expiresAt.getTime() - Date.now()) / 1000;

  if (remainingSeconds < AUTH_CONFIG.refreshRenewThreshold) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    const newRefreshToken = await generateAndStoreRefreshToken(db, jwt, user.userId);
    return { status: 200 as const, data: { authToken, refreshToken: newRefreshToken } };
  }

  return { status: 200 as const, data: { authToken, refreshToken: body.refreshToken } };
}
