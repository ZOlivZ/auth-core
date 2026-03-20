import * as jose from 'jose';
import { AuthCoreConfig } from '../types/config';

// ---------------------------------------------------------------------------
// SsoUserInfo — normalized claims extracted from any IDP token
// ---------------------------------------------------------------------------

export interface SsoUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  sub: string;
  roles?: string[];
}

// ---------------------------------------------------------------------------
// SsoTokenVerifier — function returned by the factory
// ---------------------------------------------------------------------------

export type SsoTokenVerifier = (token: string) => Promise<SsoUserInfo>;

// ---------------------------------------------------------------------------
// Keycloak
// ---------------------------------------------------------------------------

export function createKeycloakVerifier(
  config: NonNullable<AuthCoreConfig['keycloak']>,
): SsoTokenVerifier {
  const issuerUrl = `${config.publicUrl ?? config.serverUrl}/realms/${config.realm}`;
  const jwksUrl = new URL(
    `/realms/${config.realm}/protocol/openid-connect/certs`,
    config.serverUrl,
  );
  const jwks = jose.createRemoteJWKSet(jwksUrl);

  return async (token: string): Promise<SsoUserInfo> => {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: issuerUrl,
    });

    const email = (payload.email as string | undefined) ?? '';
    const firstName =
      (payload.given_name as string | undefined) ??
      (payload.preferred_username as string | undefined) ??
      '';
    const lastName = (payload.family_name as string | undefined) ?? '';

    // Keycloak stores realm roles in realm_access.roles
    const realmAccess = payload.realm_access as
      | { roles?: string[] }
      | undefined;
    const roles = realmAccess?.roles ?? [];

    return {
      email,
      firstName,
      lastName,
      sub: payload.sub ?? '',
      roles,
    };
  };
}

// ---------------------------------------------------------------------------
// Azure AD
// ---------------------------------------------------------------------------

export function createAzureAdVerifier(
  config: NonNullable<AuthCoreConfig['azureAd']>,
): SsoTokenVerifier {
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  const jwksUrl = new URL(
    `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
  );
  const jwks = jose.createRemoteJWKSet(jwksUrl);

  return async (token: string): Promise<SsoUserInfo> => {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer,
      audience: config.clientId,
    });

    const email =
      (payload.preferred_username as string | undefined) ??
      (payload.email as string | undefined) ??
      '';
    const firstName = (payload.given_name as string | undefined) ?? '';
    const lastName = (payload.family_name as string | undefined) ?? '';

    // Azure AD puts roles in the "roles" claim (App roles)
    const roles = (payload.roles as string[] | undefined) ?? [];

    return {
      email,
      firstName,
      lastName,
      sub: payload.sub ?? '',
      roles,
    };
  };
}
