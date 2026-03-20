import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from '../services/token.service';
import { ScimModule } from '../scim/scim.module';
import { UnifiedAuthGuard } from '../guards/unified-auth.guard';
import { TOKEN_BLACKLIST_ADAPTER } from '../guards/jwt-auth.guard';
import { API_KEY_ADAPTER } from '../guards/api-key.guard';
import { ADMIN_ROLES } from '../guards/permissions.guard';

export interface AuthCoreModuleOptions {
  jwt: {
    secret: string;
    accessExpiration?: string;
    refreshExpiration?: string;
  };
  scim?: {
    enabled: boolean;
    bearerToken: string;
  };
  adminRoles?: string[];
}

@Module({})
export class AuthCoreModule {
  static register(options: AuthCoreModuleOptions): DynamicModule {
    const providers: Provider[] = [
      TokenService,
      UnifiedAuthGuard,
      {
        provide: 'AUTH_CORE_OPTIONS',
        useValue: options,
      },
      {
        provide: ADMIN_ROLES,
        useValue: options.adminRoles ?? ['ADMIN'],
      },
    ];

    const imports: DynamicModule[] = [
      JwtModule.register({
        secret: options.jwt.secret,
        signOptions: { expiresIn: options.jwt.accessExpiration ?? '15m' },
      }),
    ];

    if (options.scim?.enabled) {
      imports.push(
        ScimModule.register({ bearerToken: options.scim.bearerToken }),
      );
    }

    return {
      module: AuthCoreModule,
      global: true,
      imports,
      providers,
      exports: [
        TokenService,
        UnifiedAuthGuard,
        JwtModule,
        ADMIN_ROLES,
        'AUTH_CORE_OPTIONS',
      ],
    };
  }
}

/**
 * Injection tokens that consuming apps must provide:
 *
 * - TOKEN_BLACKLIST_ADAPTER  — Redis-based access token blacklist
 * - API_KEY_ADAPTER          — API key validation (optional)
 * - SCIM_USER_ADAPTER        — SCIM user operations (if SCIM enabled)
 *
 * These are re-exported from their respective modules for convenience.
 */
export { TOKEN_BLACKLIST_ADAPTER, API_KEY_ADAPTER, ADMIN_ROLES };
