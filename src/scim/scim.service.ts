import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ScimUserAdapter, ScimUserRecord, ScimPatchOp } from './scim-user.adapter';
import { parseScimFilter } from './scim-filter.parser';
import {
  toScimUser,
  fromScimUser,
  toScimListResponse,
  SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA,
  type ScimUserResource,
  type ScimListResponse,
  type ScimPatchRequest,
} from './scim.dto';

export const SCIM_USER_ADAPTER = 'SCIM_USER_ADAPTER';

@Injectable()
export class ScimService {
  constructor(
    @Inject(SCIM_USER_ADAPTER)
    private readonly adapter: ScimUserAdapter,
  ) {}

  async getUser(id: string, baseUrl: string): Promise<ScimUserResource> {
    const record = await this.adapter.findById(id);
    if (!record) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return toScimUser(record, baseUrl);
  }

  async listUsers(
    baseUrl: string,
    filter?: string,
    startIndex = 1,
    count = 25,
  ): Promise<ScimListResponse> {
    const parsedFilter = filter ? parseScimFilter(filter) : undefined;

    // SCIM uses 1-based pagination; clamp startIndex to minimum 1
    const safeStartIndex = Math.max(1, startIndex);

    const { resources, totalResults } = await this.adapter.list(
      parsedFilter ?? undefined,
      safeStartIndex,
      count,
    );

    return toScimListResponse(resources, totalResults, safeStartIndex, count, baseUrl);
  }

  async createUser(body: any, baseUrl: string): Promise<ScimUserResource> {
    const data = fromScimUser(body);

    // SCIM idempotence: if user already exists, update instead of failing
    let existing: ScimUserRecord | null = null;
    if (data.externalId) {
      existing = await this.adapter.findByExternalId(data.externalId);
    }
    if (!existing && data.email) {
      existing = await this.adapter.findByEmail(data.email);
    }

    let record: ScimUserRecord;
    if (existing) {
      record = await this.adapter.update(existing.id, {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        externalId: data.externalId,
        active: data.active,
        role: data.role,
      });
    } else {
      record = await this.adapter.create(data);
    }

    return toScimUser(record, baseUrl);
  }

  async replaceUser(id: string, body: any, baseUrl: string): Promise<ScimUserResource> {
    // Ensure the user exists first
    const existing = await this.adapter.findById(id);
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const data = fromScimUser(body);
    const record = await this.adapter.update(id, data);
    return toScimUser(record, baseUrl);
  }

  async patchUser(id: string, body: ScimPatchRequest, baseUrl: string): Promise<ScimUserResource> {
    // Ensure the user exists first
    const existing = await this.adapter.findById(id);
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const operations: ScimPatchOp[] = (body.Operations || []).map((op) => ({
      op: op.op,
      path: op.path,
      value: op.value,
    }));

    const record = await this.adapter.patch(id, operations);
    return toScimUser(record, baseUrl);
  }

  async deleteUser(id: string): Promise<void> {
    const existing = await this.adapter.findById(id);
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }
    await this.adapter.delete(id);
  }

  getServiceProviderConfig(): Record<string, any> {
    return {
      schemas: [SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA],
      documentationUri: 'https://tools.ietf.org/html/rfc7644',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Token Standard',
          specUri: 'https://tools.ietf.org/html/rfc6750',
          primary: true,
        },
      ],
      meta: {
        resourceType: 'ServiceProviderConfig',
        location: '/scim/v2/ServiceProviderConfig',
      },
    };
  }
}
