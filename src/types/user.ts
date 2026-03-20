export interface BaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  externalId?: string | null; // IDP subject UUID for SCIM correlation
  isActive: boolean;
  lastLoginAt?: Date | null;
}
