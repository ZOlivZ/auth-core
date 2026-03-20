import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { parseScimFilter } from '../../src/scim/scim-filter.parser';
import {
  fromScimUser,
  toScimUser,
  toScimListResponse,
  SCIM_USER_SCHEMA,
  SCIM_LIST_SCHEMA,
} from '../../src/scim/scim.dto';
import { ScimService, SCIM_USER_ADAPTER } from '../../src/scim/scim.service';
import type {
  ScimUserAdapter,
  ScimUserRecord,
  ScimCreateUser,
} from '../../src/scim/scim-user.adapter';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ScimUserRecord> = {}): ScimUserRecord {
  return {
    id: 'usr-001',
    email: 'john@test.com',
    firstName: 'John',
    lastName: 'Doe',
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

const BASE_URL = 'https://example.com';

// ─── parseScimFilter ───────────────────────────────────────────────────────────

describe('parseScimFilter', () => {
  it('should parse a valid userName eq filter', () => {
    const result = parseScimFilter('userName eq "john@test.com"');
    expect(result).toEqual({
      attribute: 'email',
      operator: 'eq',
      value: 'john@test.com',
    });
  });

  it('should parse a dotted attribute (name.givenName co)', () => {
    const result = parseScimFilter('name.givenName co "Jo"');
    expect(result).toEqual({
      attribute: 'firstName',
      operator: 'co',
      value: 'Jo',
    });
  });

  it('should return null for an unknown attribute', () => {
    expect(parseScimFilter('foo eq "bar"')).toBeNull();
  });

  it('should return null for an empty string', () => {
    expect(parseScimFilter('')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseScimFilter(null as any)).toBeNull();
  });
});

// ─── fromScimUser ──────────────────────────────────────────────────────────────

describe('fromScimUser', () => {
  it('should convert a full SCIM user resource to ScimCreateUser', () => {
    const resource = {
      userName: 'john@test.com',
      externalId: 'ext-001',
      name: { givenName: 'John', familyName: 'Doe' },
      active: true,
      roles: [{ value: 'ADMIN' }],
    };

    const result = fromScimUser(resource);
    expect(result).toEqual({
      externalId: 'ext-001',
      email: 'john@test.com',
      firstName: 'John',
      lastName: 'Doe',
      active: true,
      role: 'ADMIN',
    });
  });

  it('should handle a minimal user with just userName', () => {
    const resource = { userName: 'minimal@test.com' };

    const result = fromScimUser(resource);
    expect(result).toEqual({
      externalId: undefined,
      email: 'minimal@test.com',
      firstName: '',
      lastName: '',
      active: true,
      role: undefined,
    });
  });

  it('should extract email from the emails array if userName is missing', () => {
    const resource = {
      emails: [{ value: 'from-array@test.com', primary: true }],
      name: { givenName: 'Jane', familyName: 'Smith' },
    };

    const result = fromScimUser(resource);
    expect(result.email).toBe('from-array@test.com');
  });
});

// ─── toScimUser ────────────────────────────────────────────────────────────────

describe('toScimUser', () => {
  it('should convert a ScimUserRecord to a ScimUserResource', () => {
    const record = makeRecord({
      externalId: 'ext-001',
      role: 'ADMIN',
    });

    const result = toScimUser(record, BASE_URL);

    expect(result.schemas).toEqual([SCIM_USER_SCHEMA]);
    expect(result.id).toBe('usr-001');
    expect(result.externalId).toBe('ext-001');
    expect(result.userName).toBe('john@test.com');
    expect(result.name).toEqual({ givenName: 'John', familyName: 'Doe' });
    expect(result.emails).toEqual([{ value: 'john@test.com', primary: true }]);
    expect(result.active).toBe(true);
    expect(result.roles).toEqual([{ value: 'ADMIN' }]);
    expect(result.meta.resourceType).toBe('User');
    expect(result.meta.location).toBe(`${BASE_URL}/scim/v2/Users/usr-001`);
  });

  it('should omit externalId when not present', () => {
    const record = makeRecord(); // no externalId
    const result = toScimUser(record, BASE_URL);
    expect(result.externalId).toBeUndefined();
  });

  it('should omit roles when role is not present', () => {
    const record = makeRecord(); // no role
    const result = toScimUser(record, BASE_URL);
    expect(result.roles).toBeUndefined();
  });
});

// ─── toScimListResponse ────────────────────────────────────────────────────────

describe('toScimListResponse', () => {
  it('should build a correct envelope for an empty list', () => {
    const result = toScimListResponse([], 0, 1, 25, BASE_URL);

    expect(result.schemas).toEqual([SCIM_LIST_SCHEMA]);
    expect(result.totalResults).toBe(0);
    expect(result.startIndex).toBe(1);
    expect(result.itemsPerPage).toBe(25);
    expect(result.Resources).toEqual([]);
  });

  it('should build a correct envelope with records', () => {
    const records = [makeRecord(), makeRecord({ id: 'usr-002', email: 'jane@test.com' })];
    const result = toScimListResponse(records, 2, 1, 25, BASE_URL);

    expect(result.totalResults).toBe(2);
    expect(result.Resources).toHaveLength(2);
    expect(result.Resources[0].id).toBe('usr-001');
    expect(result.Resources[1].id).toBe('usr-002');
  });
});

// ─── ScimService ───────────────────────────────────────────────────────────────

describe('ScimService', () => {
  let service: ScimService;
  let mockAdapter: ScimUserAdapter;

  beforeEach(() => {
    mockAdapter = {
      findById: vi.fn(),
      findByExternalId: vi.fn(),
      findByEmail: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    // Instantiate ScimService with the mock adapter injected manually
    service = new ScimService(mockAdapter);
  });

  it('createUser should call adapter.create with parsed data', async () => {
    const scimBody = {
      userName: 'new@test.com',
      name: { givenName: 'New', familyName: 'User' },
      active: true,
    };
    const created = makeRecord({ id: 'usr-new', email: 'new@test.com', firstName: 'New', lastName: 'User' });
    vi.mocked(mockAdapter.findByEmail).mockResolvedValue(null);
    vi.mocked(mockAdapter.create).mockResolvedValue(created);

    const result = await service.createUser(scimBody, BASE_URL);

    expect(mockAdapter.create).toHaveBeenCalledWith({
      externalId: undefined,
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      active: true,
      role: undefined,
    });
    expect(result.id).toBe('usr-new');
  });

  it('createUser with existing externalId should update instead of create (upsert)', async () => {
    const existing = makeRecord({ id: 'usr-001', externalId: 'ext-001', email: 'john@test.com' });
    vi.mocked(mockAdapter.findByExternalId).mockResolvedValue(existing);
    const updated = makeRecord({ id: 'usr-001', externalId: 'ext-001', email: 'john-updated@test.com', firstName: 'Johnny' });
    vi.mocked(mockAdapter.update).mockResolvedValue(updated);

    const scimBody = {
      userName: 'john-updated@test.com',
      externalId: 'ext-001',
      name: { givenName: 'Johnny', familyName: 'Doe' },
      active: true,
    };

    const result = await service.createUser(scimBody, BASE_URL);

    expect(mockAdapter.findByExternalId).toHaveBeenCalledWith('ext-001');
    expect(mockAdapter.create).not.toHaveBeenCalled();
    expect(mockAdapter.update).toHaveBeenCalledWith('usr-001', {
      email: 'john-updated@test.com',
      firstName: 'Johnny',
      lastName: 'Doe',
      externalId: 'ext-001',
      active: true,
      role: undefined,
    });
    expect(result.id).toBe('usr-001');
  });

  it('createUser with existing email should update instead of create (upsert)', async () => {
    const existing = makeRecord({ id: 'usr-002', email: 'jane@test.com' });
    vi.mocked(mockAdapter.findByExternalId).mockResolvedValue(null);
    vi.mocked(mockAdapter.findByEmail).mockResolvedValue(existing);
    const updated = makeRecord({ id: 'usr-002', email: 'jane@test.com', externalId: 'ext-new', firstName: 'Jane' });
    vi.mocked(mockAdapter.update).mockResolvedValue(updated);

    const scimBody = {
      userName: 'jane@test.com',
      externalId: 'ext-new',
      name: { givenName: 'Jane', familyName: 'Doe' },
      active: true,
    };

    const result = await service.createUser(scimBody, BASE_URL);

    expect(mockAdapter.findByExternalId).toHaveBeenCalledWith('ext-new');
    expect(mockAdapter.findByEmail).toHaveBeenCalledWith('jane@test.com');
    expect(mockAdapter.create).not.toHaveBeenCalled();
    expect(mockAdapter.update).toHaveBeenCalledWith('usr-002', {
      email: 'jane@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      externalId: 'ext-new',
      active: true,
      role: undefined,
    });
    expect(result.id).toBe('usr-002');
  });

  it('getUser should return a SCIM formatted user', async () => {
    const record = makeRecord();
    vi.mocked(mockAdapter.findById).mockResolvedValue(record);

    const result = await service.getUser('usr-001', BASE_URL);

    expect(mockAdapter.findById).toHaveBeenCalledWith('usr-001');
    expect(result.schemas).toEqual([SCIM_USER_SCHEMA]);
    expect(result.userName).toBe('john@test.com');
  });

  it('getUser should throw NotFoundException for unknown ID', async () => {
    vi.mocked(mockAdapter.findById).mockResolvedValue(null);

    await expect(service.getUser('unknown', BASE_URL)).rejects.toThrow(NotFoundException);
  });

  it('patchUser should pass operations to adapter', async () => {
    const record = makeRecord();
    vi.mocked(mockAdapter.findById).mockResolvedValue(record);
    vi.mocked(mockAdapter.patch).mockResolvedValue({ ...record, active: false });

    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace' as const, path: 'active', value: false }],
    };

    const result = await service.patchUser('usr-001', patchBody, BASE_URL);

    expect(mockAdapter.patch).toHaveBeenCalledWith('usr-001', [
      { op: 'replace', path: 'active', value: false },
    ]);
    expect(result.active).toBe(false);
  });

  it('deleteUser should call adapter.delete', async () => {
    const record = makeRecord();
    vi.mocked(mockAdapter.findById).mockResolvedValue(record);
    vi.mocked(mockAdapter.delete).mockResolvedValue(undefined);

    await service.deleteUser('usr-001');

    expect(mockAdapter.delete).toHaveBeenCalledWith('usr-001');
  });

  it('listUsers with filter should call adapter.list with parsed filter', async () => {
    vi.mocked(mockAdapter.list).mockResolvedValue({ resources: [], totalResults: 0 });

    await service.listUsers(BASE_URL, 'userName eq "john@test.com"', 1, 25);

    expect(mockAdapter.list).toHaveBeenCalledWith(
      { attribute: 'email', operator: 'eq', value: 'john@test.com' },
      1,
      25,
    );
  });
});
