import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  scope: string;
  entityId?: string;
}

export const RequirePermissions = (...permissions: (string | RequiredPermission)[]) =>
  SetMetadata(
    PERMISSIONS_KEY,
    permissions.map((p) => (typeof p === 'string' ? { scope: p } : p)),
  );
