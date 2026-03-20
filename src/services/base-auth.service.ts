import {
  Injectable,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { BaseUser } from '../types/user';
import { UnifiedJwtPayload, Permission } from '../types/jwt';
import { AuthCoreConfig, FileUser } from '../types/config';
import { UserAdapter } from '../types/adapter';
import { TokenService } from './token.service';
import {
  SsoTokenVerifier,
  SsoUserInfo,
  createKeycloakVerifier,
  createAzureAdVerifier,
} from './jwks-factory';

// ---------------------------------------------------------------------------
// PortalTokenVerifier — optional dependency injected from @zolivz/auth-sdk
// ---------------------------------------------------------------------------

export interface PortalTokenVerifier {
  verify(token: string): Promise<{ sub: string; email: string; [key: string]: unknown }>;
}

// ---------------------------------------------------------------------------
// Login result
// ---------------------------------------------------------------------------

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// ---------------------------------------------------------------------------
// BaseAuthService — abstract class apps must extend
// ---------------------------------------------------------------------------

@Injectable()
export abstract class BaseAuthService<TUser extends BaseUser = BaseUser> {
  protected readonly logger = new Logger(this.constructor.name);

  private keycloakVerifier?: SsoTokenVerifier;
  private azureAdVerifier?: SsoTokenVerifier;

  constructor(
    protected readonly userAdapter: UserAdapter<TUser>,
    protected readonly tokenService: TokenService,
    protected readonly config: AuthCoreConfig,
    protected readonly portalTokenVerifier?: PortalTokenVerifier,
  ) {
    // Lazily initialize SSO verifiers based on config
    if (config.keycloak) {
      this.keycloakVerifier = createKeycloakVerifier(config.keycloak);
    }
    if (config.azureAd) {
      this.azureAdVerifier = createAzureAdVerifier(config.azureAd);
    }
  }

  // =======================================================================
  // Abstract methods — each app MUST implement
  // =======================================================================

  /**
   * Map IDP roles to the app-local role string.
   * Return null if the user should be denied access.
   */
  abstract deriveRole(idpRoles: string[]): string | null;

  /**
   * Build the permissions array for this user.
   */
  abstract buildPermissions(user: TUser): Permission[];

  /**
   * Build the full JWT payload for this user.
   * Typically calls deriveRole() + buildPermissions() internally.
   */
  abstract buildJwtPayload(user: TUser): UnifiedJwtPayload;

  // =======================================================================
  // File-based authentication (development only)
  // =======================================================================

  async validateFileAuth(
    email: string,
    password: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const fileConfig = this.config.fileAuth;
    if (!fileConfig?.enabled) {
      throw new ForbiddenException('File-based authentication is disabled');
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'File-based authentication is not allowed in production',
      );
    }

    const fileUsers = this.loadFileUsers(fileConfig.usersFile);
    const fileUser = fileUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (!fileUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // File users store bcrypt-hashed passwords
    const isValid = await bcrypt.compare(password, fileUser.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Find or create the user in the database
    const user = await this.findOrCreateFileUser(fileUser);
    return this.loginUser(user, userAgent);
  }

  // =======================================================================
  // SSO token validation (Keycloak)
  // =======================================================================

  async validateKeycloakToken(
    token: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!this.keycloakVerifier) {
      throw new ForbiddenException('Keycloak authentication is not configured');
    }
    return this.validateSsoToken(this.keycloakVerifier, token, userAgent);
  }

  // =======================================================================
  // SSO token validation (Azure AD)
  // =======================================================================

  async validateAzureAdToken(
    token: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!this.azureAdVerifier) {
      throw new ForbiddenException(
        'Azure AD authentication is not configured',
      );
    }
    return this.validateSsoToken(this.azureAdVerifier, token, userAgent);
  }

  // =======================================================================
  // Portal token validation (via optional PortalTokenVerifier)
  // =======================================================================

  async validatePortalToken(
    token: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!this.portalTokenVerifier) {
      throw new ForbiddenException(
        'Portal token verification is not configured',
      );
    }

    const claims = await this.portalTokenVerifier.verify(token);
    const user = await this.findExistingUser(claims.email);

    return this.loginUser(user, userAgent);
  }

  // =======================================================================
  // Refresh tokens
  // =======================================================================

  async refreshTokens(
    refreshToken: string,
    userId: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // We need the user to rebuild the JWT payload. Look up by the stored
    // userId from the refresh token record instead.
    // The caller provides userId from the decoded (possibly expired) access token.
    const existingUser = await this.findExistingUserById(userId);
    const payload = this.buildJwtPayload(existingUser);

    return this.tokenService.refreshTokensWithPayload(
      refreshToken,
      payload,
      { userId: existingUser.id, userAgent },
    );
  }

  // =======================================================================
  // Logout / revoke
  // =======================================================================

  async revokeTokens(accessToken: string, userId: string): Promise<void> {
    await this.tokenService.revokeTokens(accessToken, userId);
  }

  // =======================================================================
  // Protected helpers
  // =======================================================================

  /**
   * Find an existing user by email. Throws ForbiddenException if not found.
   */
  protected async findExistingUser(email: string): Promise<TUser> {
    const user = await this.userAdapter.findByEmail(email);
    if (!user) {
      throw new ForbiddenException(
        `No account found for ${email}. Contact your administrator.`,
      );
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }
    return user;
  }

  /**
   * Find an existing user by ID. Throws ForbiddenException if not found.
   * Default implementation searches by email (adapters typically have findById).
   * Apps can override this if their adapter supports findById.
   */
  protected async findExistingUserById(userId: string): Promise<TUser> {
    // This is a workaround — ideally the UserAdapter has findById.
    // Apps should override this method for efficiency.
    void userId;
    throw new ForbiddenException(
      'findExistingUserById must be overridden or userId lookup must be implemented in the adapter',
    );
  }

  /**
   * Find or create a user from file-based auth data (dev only).
   */
  protected async findOrCreateFileUser(fileUser: FileUser): Promise<TUser> {
    let user = await this.userAdapter.findByEmail(fileUser.email);

    if (!user) {
      this.logger.log(
        `Creating file-auth user: ${fileUser.email} (role: ${fileUser.role})`,
      );
      user = await this.userAdapter.create({
        email: fileUser.email,
        firstName: fileUser.firstName,
        lastName: fileUser.lastName,
        role: fileUser.role,
        passwordHash: fileUser.password, // already hashed
        isActive: true,
      });
    }

    return user;
  }

  /**
   * Generate a token pair for a user and update lastLoginAt.
   */
  protected async loginUser(
    user: TUser,
    userAgent?: string,
  ): Promise<LoginResult> {
    // Update last login timestamp
    await this.userAdapter.update(user.id, { lastLoginAt: new Date() });

    const payload = this.buildJwtPayload(user);
    return this.tokenService.generateTokenPair(payload, {
      userId: user.id,
      userAgent,
    });
  }

  // =======================================================================
  // Private helpers
  // =======================================================================

  /**
   * Common SSO validation flow shared by Keycloak and Azure AD.
   */
  private async validateSsoToken(
    verifier: SsoTokenVerifier,
    token: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // 1. Validate the token via JWKS
    let ssoInfo: SsoUserInfo;
    try {
      ssoInfo = await verifier(token);
    } catch (error) {
      this.logger.warn(`SSO token validation failed: ${error}`);
      throw new UnauthorizedException('Invalid SSO token');
    }

    // 2. Derive app-local role from IDP roles
    const role = this.deriveRole(ssoInfo.roles ?? []);
    if (!role) {
      throw new ForbiddenException(
        'No matching application role for your IDP roles',
      );
    }

    // 3. Find existing user — throws if not found
    const user = await this.findExistingUser(ssoInfo.email);

    // 4. Sync externalId if not set
    if (!user.externalId && ssoInfo.sub) {
      await this.userAdapter.update(user.id, { externalId: ssoInfo.sub });
    }

    // 5. Sync role if changed
    // We compare against the current user role via buildJwtPayload
    const currentPayload = this.buildJwtPayload(user);
    if (currentPayload.role !== role) {
      this.logger.log(
        `Role changed for ${ssoInfo.email}: ${currentPayload.role} -> ${role}`,
      );
      await this.userAdapter.update(user.id, { role });
    }

    // 6. Sync name if changed
    const nameUpdates: Record<string, string> = {};
    if (ssoInfo.firstName && ssoInfo.firstName !== user.firstName) {
      nameUpdates.firstName = ssoInfo.firstName;
    }
    if (ssoInfo.lastName && ssoInfo.lastName !== user.lastName) {
      nameUpdates.lastName = ssoInfo.lastName;
    }
    if (Object.keys(nameUpdates).length > 0) {
      await this.userAdapter.update(user.id, nameUpdates);
    }

    // 7. Login — generate tokens
    return this.loginUser(user, userAgent);
  }

  private loadFileUsers(filePath: string): FileUser[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as FileUser[];
    } catch (error) {
      this.logger.error(`Failed to load file users from ${filePath}: ${error}`);
      throw new ForbiddenException('File-based authentication is misconfigured');
    }
  }
}
