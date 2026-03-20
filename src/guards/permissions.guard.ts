import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions';

export const ADMIN_ROLES = 'ADMIN_ROLES';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(ADMIN_ROLES)
    private readonly adminRoles: string[] = ['ADMIN'],
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // Admin role bypass
    if (user.role && this.adminRoles.includes(user.role)) return true;

    // API key users have no permissions
    if (user.type === 'apikey') return false;

    const userPermissions: { scope: string; entityId?: string }[] = user.permissions ?? [];

    return requiredPermissions.every((required) =>
      userPermissions.some(
        (userPerm) =>
          userPerm.scope === required.scope &&
          (!required.entityId || userPerm.entityId === required.entityId),
      ),
    );
  }
}
