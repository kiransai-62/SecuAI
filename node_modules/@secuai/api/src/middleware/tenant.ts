import { Response } from 'express';

/**
 * STRICT SECURITY REQUIREMENT:
 * Return 404 (not 403) on other users' resources to prevent ID enumeration.
 */
export function assertTenantOwnership<T extends { user_id: string }>(
  resource: T | null | undefined,
  currentUserId: string,
  res: Response
): resource is T {
  if (!resource || resource.user_id !== currentUserId) {
    res.status(404).json({ error: 'Resource not found' });
    return false;
  }
  return true;
}
