export interface ScimUserAdapter {
  findById(id: string): Promise<ScimUserRecord | null>;
  findByExternalId(externalId: string): Promise<ScimUserRecord | null>;
  findByEmail(email: string): Promise<ScimUserRecord | null>;
  list(
    filter?: ScimFilter,
    startIndex?: number,
    count?: number,
  ): Promise<{ resources: ScimUserRecord[]; totalResults: number }>;
  create(data: ScimCreateUser): Promise<ScimUserRecord>;
  update(id: string, data: ScimUpdateUser): Promise<ScimUserRecord>;
  patch(id: string, operations: ScimPatchOp[]): Promise<ScimUserRecord>;
  delete(id: string): Promise<void>;
}

export interface ScimUserRecord {
  id: string;
  externalId?: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScimCreateUser {
  externalId?: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  role?: string;
}

export interface ScimUpdateUser {
  externalId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  role?: string;
}

export interface ScimPatchOp {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: any;
}

export interface ScimFilter {
  attribute: string;
  operator: 'eq' | 'ne' | 'co' | 'sw' | 'ew' | 'gt' | 'ge' | 'lt' | 'le';
  value: string;
}
