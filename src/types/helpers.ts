/**
 * Standard role constant used across all apps.
 * Each app defines its own roles, but ADMIN is always the superuser role.
 */
export const ROLE_ADMIN = 'ADMIN';

/**
 * Check if a user has the admin role.
 * Works with any object that has a `role` property (JWT payload, DB user, frontend user).
 */
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === ROLE_ADMIN;
}

/**
 * Build a display name from firstName + lastName.
 */
export function getDisplayName(user: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
