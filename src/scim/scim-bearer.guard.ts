import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export const SCIM_BEARER_TOKEN = 'SCIM_BEARER_TOKEN';

@Injectable()
export class ScimBearerGuard implements CanActivate {
  constructor(
    @Inject(SCIM_BEARER_TOKEN) private readonly expectedToken: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid SCIM bearer token');
    }

    const token = auth.slice(7);
    if (token !== this.expectedToken) {
      throw new UnauthorizedException('Invalid SCIM bearer token');
    }

    return true;
  }
}
