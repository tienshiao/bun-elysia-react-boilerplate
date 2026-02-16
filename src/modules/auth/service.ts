import { eq, isNull, and } from 'drizzle-orm';
import { users, usersPrivate, refreshTokens, roles, userRoles } from '@/db/schema/index.ts';
import { AUTH_CONFIG, TOKEN_TYPES } from './config.ts';
import type { Database } from '@/db/index.ts';
import { isUniqueViolation } from '@/db/errors.ts';
import type { Jwt } from './jwt.ts';

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class AuthService {
  constructor(private db: Database, private jwt: Jwt) {}

  static async hashRefreshToken(token: string): Promise<string> {
    const encoded = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Buffer.from(hashBuffer).toString('hex');
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const result = await this.db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.roleId, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    return result.map((r) => r.name);
  }

  private async generateAndStoreRefreshToken(userId: string) {
    const rawToken = await this.jwt.sign({
      sub: userId,
      tt: TOKEN_TYPES.refresh,
      exp: `${AUTH_CONFIG.refreshTokenTTL}s`,
      jti: crypto.randomUUID(),
    });
    const tokenHash = await AuthService.hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.refreshTokenTTL * 1000);

    await this.db.insert(refreshTokens).values({
      tokenHash,
      expiresAt,
      userId,
    });

    return rawToken;
  }

  async signUp(body: { email: string; password: string; username: string }) {
    const { email, password, username } = body;
    const passwordHash = await Bun.password.hash(password, 'argon2id');

    let newUserId: string;
    try {
      newUserId = await this.db.transaction(async (tx) => {
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

    const userRoles = await this.getUserRoles(newUserId);
    const authToken = await this.jwt.sign({ sub: newUserId, username, roles: userRoles, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
    const refreshToken = await this.generateAndStoreRefreshToken(newUserId);

    return {
      status: 201 as const,
      data: {
        authToken,
        refreshToken,
        user: { userId: newUserId, username },
      },
    };
  }

  async signIn(body: { email: string; password: string }) {
    const { email, password } = body;

    const result = await this.db
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

    const userRoles = await this.getUserRoles(user.userId);
    const authToken = await this.jwt.sign({ sub: user.userId, username: user.username, roles: userRoles, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
    const refreshToken = await this.generateAndStoreRefreshToken(user.userId);

    return {
      status: 200 as const,
      data: {
        authToken,
        refreshToken,
        user: { userId: user.userId, username: user.username },
      },
    };
  }

  async signOut(body: { refreshToken: string }) {
    const tokenHash = await AuthService.hashRefreshToken(body.refreshToken);
    await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    return { status: 200 as const, data: { success: true } };
  }

  async refresh(body: { refreshToken: string }) {
    const refreshPayload = await this.jwt.verify(body.refreshToken);
    if (!refreshPayload || refreshPayload.tt !== TOKEN_TYPES.refresh) {
      return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
    }

    const tokenHash = await AuthService.hashRefreshToken(body.refreshToken);

    const result = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    const stored = result[0];

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      }
      return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
    }

    const userResult = await this.db
      .select({ userId: users.userId, username: users.username })
      .from(users)
      .where(and(eq(users.userId, stored.userId), isNull(users.deletedAt)))
      .limit(1);

    const user = userResult[0];
    if (!user) {
      return { status: 401 as const, data: { error: 'Invalid or expired refresh token' } };
    }

    const userRoles = await this.getUserRoles(user.userId);
    const authToken = await this.jwt.sign({ sub: user.userId, username: user.username, roles: userRoles, tt: TOKEN_TYPES.auth, exp: `${AUTH_CONFIG.authTokenTTL}s` });
    const remainingSeconds = (stored.expiresAt.getTime() - Date.now()) / 1000;

    if (remainingSeconds < AUTH_CONFIG.refreshRenewThreshold) {
      await this.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      const newRefreshToken = await this.generateAndStoreRefreshToken(user.userId);
      return { status: 200 as const, data: { authToken, refreshToken: newRefreshToken } };
    }

    return { status: 200 as const, data: { authToken, refreshToken: body.refreshToken } };
  }
}
