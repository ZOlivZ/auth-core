import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_KEY_AUTH_KEY } from '../decorators/api-key-auth';
import { ApiKeyUser } from '../decorators/current-user';

export const API_KEY_ADAPTER = 'API_KEY_ADAPTER';

export interface ApiKeyAdapter {
  validate(apiKey: string): Promise<{ establishmentId: string; label: string } | null>;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(API_KEY_ADAPTER)
    private readonly apiKeyAdapter: ApiKeyAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requireApiKey) return true;

    const request = context.switchToHttp().getRequest();
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
    return true;
  }
}
