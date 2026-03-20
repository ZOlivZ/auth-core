// SCIM 2.0 Provisioning Module
// RFC 7643 (Schema) / RFC 7644 (Protocol)

// Adapter interface — implemented by each consuming app
export type {
  ScimUserAdapter,
  ScimUserRecord,
  ScimCreateUser,
  ScimUpdateUser,
  ScimPatchOp,
  ScimFilter,
} from './scim-user.adapter';

// Filter parser
export { parseScimFilter, mapScimAttribute } from './scim-filter.parser';

// DTOs and helper functions
export {
  SCIM_USER_SCHEMA,
  SCIM_LIST_SCHEMA,
  SCIM_PATCH_SCHEMA,
  SCIM_ERROR_SCHEMA,
  SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA,
  SCIM_CONTENT_TYPE,
  toScimUser,
  fromScimUser,
  toScimListResponse,
  toScimError,
} from './scim.dto';
export type {
  ScimUserResource,
  ScimListResponse,
  ScimPatchRequest,
  ScimErrorResponse,
} from './scim.dto';

// Service and injection token
export { ScimService, SCIM_USER_ADAPTER } from './scim.service';

// Controller
export { ScimController } from './scim.controller';

// Guard and token
export { ScimBearerGuard, SCIM_BEARER_TOKEN } from './scim-bearer.guard';

// Body parser helper
export { enableScimBodyParser } from './scim-body-parser.middleware';

// Module
export { ScimModule } from './scim.module';
