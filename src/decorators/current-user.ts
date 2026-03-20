import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  type: 'staff' | 'member';
  permissions: { scope: string; entityId?: string }[];
}

export interface ApiKeyUser {
  establishmentId: string;
  label: string;
  type: 'apikey';
}

export type CurrentUserType = AuthenticatedUser | ApiKeyUser;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
