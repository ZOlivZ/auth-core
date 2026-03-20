import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ScimController } from './scim.controller';
import { ScimService, SCIM_USER_ADAPTER } from './scim.service';
import { ScimBearerGuard, SCIM_BEARER_TOKEN } from './scim-bearer.guard';
import type { ScimUserAdapter } from './scim-user.adapter';

export interface ScimModuleOptions {
  bearerToken: string;
  /** The adapter class or an existing provider to use as SCIM_USER_ADAPTER */
  adapter?: Type<ScimUserAdapter> | Provider;
}

@Module({})
export class ScimModule {
  /**
   * Register the SCIM module.
   *
   * Pass the adapter directly to avoid cross-module injection issues:
   * ```typescript
   * ScimModule.register({
   *   bearerToken: process.env.SCIM_BEARER_TOKEN,
   *   adapter: MyScimUserAdapter,
   * })
   * ```
   *
   * Or provide SCIM_USER_ADAPTER separately if the adapter has dependencies
   * from the parent module — in that case, use `registerAsync()` or provide
   * the adapter in the same module and pass it as a provider object:
   * ```typescript
   * ScimModule.register({
   *   bearerToken: process.env.SCIM_BEARER_TOKEN,
   *   adapter: { provide: SCIM_USER_ADAPTER, useExisting: MyScimUserAdapter },
   * })
   * ```
   */
  static register(options: ScimModuleOptions): DynamicModule {
    const providers: Provider[] = [
      ScimService,
      { provide: SCIM_BEARER_TOKEN, useValue: options.bearerToken },
      ScimBearerGuard,
    ];

    const imports: any[] = [];

    if (options.adapter) {
      if (typeof options.adapter === 'function') {
        // Class provider
        providers.push(options.adapter as Type<ScimUserAdapter>);
        providers.push({
          provide: SCIM_USER_ADAPTER,
          useExisting: options.adapter as Type<ScimUserAdapter>,
        });
      } else {
        // Custom provider object
        providers.push(options.adapter as Provider);
      }
    }

    return {
      module: ScimModule,
      imports,
      controllers: [ScimController],
      providers,
      exports: [SCIM_USER_ADAPTER, ScimService],
    };
  }
}
