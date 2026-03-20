import {
  DynamicModule,
  Module,
  Provider,
  Type,
} from '@nestjs/common';
import { ScimController } from './scim.controller';
import { ScimService, SCIM_USER_ADAPTER } from './scim.service';
import { ScimBearerGuard, SCIM_BEARER_TOKEN } from './scim-bearer.guard';
import type { ScimUserAdapter } from './scim-user.adapter';

export interface ScimModuleOptions {
  bearerToken: string;
  /** The adapter class or an existing provider to use as SCIM_USER_ADAPTER */
  adapter?: Type<ScimUserAdapter> | Provider;
}

/**
 * SCIM 2.0 module — self-contained, no configuration needed in main.ts.
 *
 * What it handles automatically:
 * - Body parsing for `application/scim+json` content type
 * - Bearer token authentication via ScimBearerGuard
 * - The controller uses @Public() so global auth guards skip SCIM routes
 *
 * Usage:
 * ```typescript
 * ScimModule.register({
 *   bearerToken: process.env.SCIM_BEARER_TOKEN,
 *   adapter: MyScimUserAdapter,
 * })
 * ```
 */
@Module({})
export class ScimModule {
  static register(options: ScimModuleOptions): DynamicModule {
    const providers: Provider[] = [
      ScimService,
      { provide: SCIM_BEARER_TOKEN, useValue: options.bearerToken },
      ScimBearerGuard,
    ];

    if (options.adapter) {
      if (typeof options.adapter === 'function') {
        providers.push(options.adapter as Type<ScimUserAdapter>);
        providers.push({
          provide: SCIM_USER_ADAPTER,
          useExisting: options.adapter as Type<ScimUserAdapter>,
        });
      } else {
        providers.push(options.adapter as Provider);
      }
    }

    return {
      module: ScimModule,
      controllers: [ScimController],
      providers,
      exports: [SCIM_USER_ADAPTER, ScimService],
    };
  }
}
