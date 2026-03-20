import type { ScimFilter } from './scim-user.adapter';

/**
 * Mapping from SCIM attribute names (RFC 7643) to internal field names.
 */
const SCIM_ATTRIBUTE_MAP: Record<string, string> = {
  userName: 'email',
  externalId: 'externalId',
  'name.givenName': 'firstName',
  'name.familyName': 'lastName',
  active: 'active',
  'emails.value': 'email',
};

const VALID_OPERATORS = new Set([
  'eq', 'ne', 'co', 'sw', 'ew', 'gt', 'ge', 'lt', 'le',
]);

/**
 * Parse a SCIM filter string into a structured ScimFilter object.
 *
 * Supports the pattern: `attribute operator "value"` or `attribute operator value`
 *
 * Examples:
 *   userName eq "john@example.com"
 *   active eq "true"
 *   name.givenName co "Jane"
 *
 * Returns null if the filter string is invalid or uses an unsupported attribute.
 */
export function parseScimFilter(filterStr: string): ScimFilter | null {
  if (!filterStr || typeof filterStr !== 'string') {
    return null;
  }

  const trimmed = filterStr.trim();
  if (!trimmed) {
    return null;
  }

  // Pattern: attribute operator "value" (with or without quotes)
  const match = trimmed.match(
    /^([\w.]+)\s+(eq|ne|co|sw|ew|gt|ge|lt|le)\s+"?([^"]*)"?$/i,
  );

  if (!match) {
    return null;
  }

  const [, scimAttribute, operator, value] = match;
  const normalizedOp = operator.toLowerCase();

  if (!VALID_OPERATORS.has(normalizedOp)) {
    return null;
  }

  const internalAttribute = SCIM_ATTRIBUTE_MAP[scimAttribute];
  if (!internalAttribute) {
    return null;
  }

  return {
    attribute: internalAttribute,
    operator: normalizedOp as ScimFilter['operator'],
    value,
  };
}

/**
 * Map a SCIM attribute name to the internal field name.
 * Returns undefined if the attribute is not recognized.
 */
export function mapScimAttribute(scimAttribute: string): string | undefined {
  return SCIM_ATTRIBUTE_MAP[scimAttribute];
}
