import { DynamicModule, Module } from '@nestjs/common';
import { ScimController } from './scim.controller';
import { ScimService } from './scim.service';
import { ScimBearerGuard, SCIM_BEARER_TOKEN } from './scim-bearer.guard';

@Module({})
export class ScimModule {
  /**
   * Register the SCIM module with the required bearer token for authentication.
   *
   * The consuming application must also provide the SCIM_USER_ADAPTER injection token
   * that implements the ScimUserAdapter interface to bridge SCIM operations to its
   * own user persistence layer (e.g., Prisma model).
   *
   * Usage:
   * ```typescript
   * @Module({
   *   imports: [ScimModule.register({ bearerToken: process.env.SCIM_BEARER_TOKEN })],
   *   providers: [
   *     { provide: SCIM_USER_ADAPTER, useClass: MyScimUserAdapter },
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static register(options: { bearerToken: string }): DynamicModule {
    return {
      module: ScimModule,
      controllers: [ScimController],
      providers: [
        ScimService,
        { provide: SCIM_BEARER_TOKEN, useValue: options.bearerToken },
        ScimBearerGuard,
      ],
      // Note: SCIM_USER_ADAPTER must be provided by the consuming app
    };
  }
}
