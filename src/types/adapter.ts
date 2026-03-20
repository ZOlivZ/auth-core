import { BaseUser } from './user';

// ---------------------------------------------------------------------------
// UserAdapter — bridges auth-core to the app's Prisma model
// ---------------------------------------------------------------------------

export interface UserAdapter<TUser extends BaseUser = BaseUser> {
  findByEmail(email: string): Promise<TUser | null>;
  findByExternalId(externalId: string): Promise<TUser | null>;
  create(data: CreateUserData): Promise<TUser>;
  update(id: string, data: UpdateUserData): Promise<TUser>;
  deactivate(id: string): Promise<void>;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  externalId?: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  externalId?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}

// ---------------------------------------------------------------------------
// RefreshTokenAdapter — bridges to the app's refresh token storage
// ---------------------------------------------------------------------------

export interface RefreshTokenAdapter {
  create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<{ id: string }>;

  findByHash(
    tokenHash: string,
  ): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
  } | null>;

  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// TokenBlacklistAdapter — bridges to Redis or in-memory blacklist
// ---------------------------------------------------------------------------

export interface TokenBlacklistAdapter {
  add(accessToken: string, ttlSeconds: number): Promise<void>;
  isBlacklisted(accessToken: string): Promise<boolean>;
}
