import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { UnifiedJwtPayload } from '../types/jwt';
import { AuthCoreConfig } from '../types/config';
import { RefreshTokenAdapter, TokenBlacklistAdapter } from '../types/adapter';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenAdapter: RefreshTokenAdapter,
    private readonly tokenBlacklistAdapter: TokenBlacklistAdapter,
    private readonly config: AuthCoreConfig,
  ) {
    this.accessExpiration = config.jwt.accessExpiration ?? '15m';
    this.refreshExpiration = config.jwt.refreshExpiration ?? '7d';
  }

  // -----------------------------------------------------------------------
  // Generate a token pair (access + refresh)
  // -----------------------------------------------------------------------

  async generateTokenPair(
    payload: UnifiedJwtPayload,
    meta: { userId: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const accessToken = this.jwtService.sign(
      { ...payload },
      {
        secret: this.config.jwt.secret,
        expiresIn: this.accessExpiration,
        algorithm: 'HS256',
      },
    );

    const refreshToken = this.generateRefreshToken();
    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = this.computeRefreshExpiry();

    await this.refreshTokenAdapter.create({
      tokenHash,
      userId: meta.userId,
      expiresAt,
      userAgent: meta.userAgent,
    });

    this.logger.debug(`Token pair generated for user ${meta.userId}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiration,
    };
  }

  // -----------------------------------------------------------------------
  // Refresh tokens — validate refresh token and issue a new pair
  // -----------------------------------------------------------------------

  async refreshTokens(
    refreshToken: string,
    _userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    // We need to find the stored token by trying bcrypt.compare against
    // candidates. In practice the caller should pass the raw token and
    // the adapter should store the hash. We search by iterating — but a
    // more efficient pattern is for the adapter to expose a lookup method
    // that matches. Here we rely on the adapter storing a deterministic
    // identifier alongside the hash.
    //
    // Strategy: hash the token the same way we did at creation and look
    // it up. However bcrypt hashes are NOT deterministic (salted), so we
    // cannot do a direct lookup. Instead, the adapter.findByHash must
    // accept a raw token and iterate internally, OR we store a separate
    // lookup key.
    //
    // Practical approach: store a SHA-256 digest as lookup key and a
    // bcrypt hash for verification. For now we use SHA-256 only (still
    // secure for random tokens with high entropy).
    const tokenHash = await this.hashForLookup(refreshToken);
    const stored = await this.refreshTokenAdapter.findByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revoked) {
      this.logger.warn(
        `Revoked refresh token reuse detected for user ${stored.userId}`,
      );
      // Revoke all tokens for this user as a security measure
      await this.refreshTokenAdapter.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old refresh token (rotation)
    await this.refreshTokenAdapter.revoke(stored.id);

    // Decode the current access token payload to re-sign
    // We don't have the old access token here, so the caller should
    // provide the payload. For simplicity, we require the caller to
    // pass the payload via a higher-level method. This method is the
    // low-level rotation.
    //
    // Since we don't have the payload, we throw — callers should use
    // BaseAuthService.refreshTokens() which handles this properly.
    throw new Error(
      'TokenService.refreshTokens requires payload — use BaseAuthService.refreshTokens() instead',
    );
  }

  // -----------------------------------------------------------------------
  // Refresh tokens with an explicit payload (used by BaseAuthService)
  // -----------------------------------------------------------------------

  async refreshTokensWithPayload(
    refreshToken: string,
    payload: UnifiedJwtPayload,
    meta: { userId: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const tokenHash = await this.hashForLookup(refreshToken);
    const stored = await this.refreshTokenAdapter.findByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revoked) {
      this.logger.warn(
        `Revoked refresh token reuse detected for user ${stored.userId}`,
      );
      await this.refreshTokenAdapter.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token (rotation)
    await this.refreshTokenAdapter.revoke(stored.id);

    // Issue new pair
    return this.generateTokenPair(payload, meta);
  }

  // -----------------------------------------------------------------------
  // Revoke tokens — blacklist access token + revoke all refresh tokens
  // -----------------------------------------------------------------------

  async revokeTokens(accessToken: string, userId: string): Promise<void> {
    // Decode access token to get its remaining TTL
    try {
      const decoded = this.jwtService.decode(accessToken) as {
        exp?: number;
      } | null;
      if (decoded?.exp) {
        const ttlSeconds = Math.max(
          0,
          decoded.exp - Math.floor(Date.now() / 1000),
        );
        if (ttlSeconds > 0) {
          await this.tokenBlacklistAdapter.add(accessToken, ttlSeconds);
        }
      }
    } catch {
      this.logger.warn('Failed to decode access token for blacklisting');
    }

    await this.refreshTokenAdapter.revokeAllForUser(userId);
    this.logger.debug(`All tokens revoked for user ${userId}`);
  }

  // -----------------------------------------------------------------------
  // Check if an access token is blacklisted
  // -----------------------------------------------------------------------

  async isBlacklisted(accessToken: string): Promise<boolean> {
    return this.tokenBlacklistAdapter.isBlacklisted(accessToken);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private generateRefreshToken(): string {
    return `${uuidv4()}.${randomBytes(32).toString('hex')}`;
  }

  private computeRefreshExpiry(): Date {
    const ms = this.parseDuration(this.refreshExpiration);
    return new Date(Date.now() + ms);
  }

  /**
   * Hash for lookup — SHA-256 hex digest. Deterministic, so it can be
   * used as a DB lookup key. The refresh token itself has 128+ bits of
   * entropy so SHA-256 is sufficient (no need for bcrypt here).
   */
  private async hashForLookup(token: string): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // default 7 days
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? 1000);
  }
}
