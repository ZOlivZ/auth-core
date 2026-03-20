import type { ScimCreateUser, ScimUserRecord } from './scim-user.adapter';

// ─── SCIM 2.0 Schema URNs ──────────────────────────────────────────────────

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA =
  'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig';

export const SCIM_CONTENT_TYPE = 'application/scim+json';

// ─── Response DTOs ──────────────────────────────────────────────────────────

export interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{ value: string; primary: boolean }>;
  active: boolean;
  roles?: Array<{ value: string }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUserResource[];
}

export interface ScimPatchRequest {
  schemas: string[];
  Operations: Array<{
    op: 'add' | 'replace' | 'remove';
    path?: string;
    value?: any;
  }>;
}

export interface ScimErrorResponse {
  schemas: string[];
  status: string;
  detail: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Convert an internal ScimUserRecord to the SCIM 2.0 User resource format.
 */
export function toScimUser(record: ScimUserRecord, baseUrl: string): ScimUserResource {
  const resource: ScimUserResource = {
    schemas: [SCIM_USER_SCHEMA],
    id: record.id,
    userName: record.email,
    name: {
      givenName: record.firstName,
      familyName: record.lastName,
    },
    emails: [{ value: record.email, primary: true }],
    active: record.active,
    meta: {
      resourceType: 'User',
      created: record.createdAt.toISOString(),
      lastModified: record.updatedAt.toISOString(),
      location: `${baseUrl}/scim/v2/Users/${record.id}`,
    },
  };

  if (record.externalId) {
    resource.externalId = record.externalId;
  }

  if (record.role) {
    resource.roles = [{ value: record.role }];
  }

  return resource;
}

/**
 * Parse an incoming SCIM User resource body into internal ScimCreateUser data.
 */
export function fromScimUser(resource: any): ScimCreateUser {
  const email =
    resource.userName ||
    resource.emails?.[0]?.value ||
    '';

  return {
    externalId: resource.externalId,
    email,
    firstName: resource.name?.givenName || '',
    lastName: resource.name?.familyName || '',
    active: resource.active !== undefined ? resource.active : true,
    role: resource.roles?.[0]?.value,
  };
}

/**
 * Build a SCIM 2.0 ListResponse envelope.
 */
export function toScimListResponse(
  records: ScimUserRecord[],
  totalResults: number,
  startIndex: number,
  count: number,
  baseUrl: string,
): ScimListResponse {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage: count,
    Resources: records.map((r) => toScimUser(r, baseUrl)),
  };
}

/**
 * Build a SCIM 2.0 Error response.
 */
export function toScimError(status: number, detail: string): ScimErrorResponse {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    detail,
  };
}
