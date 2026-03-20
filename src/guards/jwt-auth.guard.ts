import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { AuthenticatedUser } from '../decorators/current-user';
import { UnifiedJwtPayload } from '../types/jwt';

export const TOKEN_BLACKLIST_ADAPTER = 'TOKEN_BLACKLIST_ADAPTER';

export interface TokenBlacklistAdapter {
  isBlacklisted(token: string): Promise<boolean>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(TOKEN_BLACKLIST_ADAPTER)
    private readonly tokenBlacklist: TokenBlacklistAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
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
    return true;
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const authorization = request.headers['authorization'];
    if (!authorization) return null;
    const [scheme, token] = authorization.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
