// Types
export {
  BaseUser,
  UnifiedJwtPayload,
  Permission,
  AuthCoreConfig,
  FileUser,
  UserAdapter,
  CreateUserData,
  UpdateUserData,
  RefreshTokenAdapter,
  TokenBlacklistAdapter,
} from './types';

// Services
export {
  TokenService,
  BaseAuthService,
  PortalTokenVerifier,
  LoginResult,
  createKeycloakVerifier,
  createAzureAdVerifier,
  SsoTokenVerifier,
  SsoUserInfo,
} from './services';

// Guards
export {
  UnifiedAuthGuard,
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  ApiKeyGuard,
  TOKEN_BLACKLIST_ADAPTER,
  API_KEY_ADAPTER,
  ADMIN_ROLES,
  ApiKeyAdapter,
} from './guards';

// Decorators
export {
  CurrentUser,
  AuthenticatedUser,
  ApiKeyUser,
  CurrentUserType,
  Roles,
  ROLES_KEY,
  Public,
  IS_PUBLIC_KEY,
  ApiKeyAuth,
  API_KEY_AUTH_KEY,
  RequirePermissions,
  RequiredPermission,
  PERMISSIONS_KEY,
} from './decorators';

// NestJS Module
export { AuthCoreModule, AuthCoreModuleOptions } from './nestjs';

// SCIM (also available via @zolivz/auth-core/scim)
export {
  ScimModule,
  ScimService,
  ScimController,
  ScimBearerGuard,
  SCIM_USER_ADAPTER,
  SCIM_BEARER_TOKEN,
  ScimUserAdapter,
  ScimUserRecord,
  ScimCreateUser,
  ScimUpdateUser,
  ScimPatchOp,
  ScimFilter,
  parseScimFilter,
  toScimUser,
  fromScimUser,
  toScimListResponse,
  toScimError,
} from './scim';
