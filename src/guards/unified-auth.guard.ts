import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { API_KEY_AUTH_KEY } from '../decorators/api-key-auth';
import { ROLES_KEY } from '../decorators/roles';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions';
import { AuthenticatedUser, ApiKeyUser } from '../decorators/current-user';
import { UnifiedJwtPayload } from '../types/jwt';
import { TOKEN_BLACKLIST_ADAPTER, TokenBlacklistAdapter } from './jwt-auth.guard';
import { API_KEY_ADAPTER, ApiKeyAdapter } from './api-key.guard';
import { ADMIN_ROLES } from './permissions.guard';

@Injectable()
export class UnifiedAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @Inject(TOKEN_BLACKLIST_ADAPTER)
    private readonly tokenBlacklist: TokenBlacklistAdapter,
    @Inject(API_KEY_ADAPTER)
    private readonly apiKeyAdapter: ApiKeyAdapter,
    @Optional()
    @Inject(ADMIN_ROLES)
    private readonly adminRoles: string[] = ['ADMIN'],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Check @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Check @ApiKeyAuth()
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireApiKey) {
      await this.authenticateApiKey(request);
    } else {
      await this.authenticateJwt(request);
    }

    // 3. Check @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const user = request.user;
      if (!user || !user.role || !requiredRoles.includes(user.role)) {
        throw new UnauthorizedException('Insufficient role');
      }
    }

    // 4. Check @RequirePermissions()
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermissions && requiredPermissions.length > 0) {
      this.checkPermissions(request.user, requiredPermissions);
    }

    return true;
  }

  private async authenticateApiKey(request: any): Promise<void> {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const result = await this.apiKeyAdapter.validate(apiKey);
    if (!result) {
      throw new UnauthorizedException('Invalid API key');
    }

    const user: ApiKeyUser = {
      establishmentId: result.establishmentId,
      label: result.label,
      type: 'apikey',
    };
    request.user = user;
  }

  private async authenticateJwt(request: any): Promise<void> {
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const isBlacklisted = await this.tokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    let payload: UnifiedJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<UnifiedJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      type: payload.type,
      permissions: payload.permissions ?? [],
    };
    request.user = user;
  }

  private checkPermissions(user: any, requiredPermissions: RequiredPermission[]): void {
    if (!user) throw new UnauthorizedException('Insufficient permissions');

    // Admin role bypass
    if (user.role && this.adminRoles.includes(user.role)) return;

    // API key users have no permissions
    if (user.type === 'apikey') {
      throw new UnauthorizedException('Insufficient permissions');
    }

    const userPermissions: { scope: string; entityId?: string }[] = user.permissions ?? [];
    const hasAll = requiredPermissions.every((required) =>
      userPermissions.some(
        (userPerm) =>
          userPerm.scope === required.scope &&
          (!required.entityId || userPerm.entityId === required.entityId),
      ),
    );

    if (!hasAll) {
      throw new UnauthorizedException('Insufficient permissions');
    }
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const authorization = request.headers['authorization'];
    if (!authorization) return null;
    const [scheme, token] = authorization.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
