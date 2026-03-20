export interface UnifiedJwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  type: 'staff' | 'member';
  permissions: Permission[];
}

export interface Permission {
  scope: string;
  entityId?: string;
}
