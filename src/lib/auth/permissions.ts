import type { TeamPermissionKey, TeamPermissions } from '@/lib/types/database';

export const PERMISSION_KEYS: TeamPermissionKey[] = [
  'view_deals',
  'manage_watchlist',
  'commit_withdraw',
  'download_documents',
  'schedule_meetings',
];

/**
 * Defaults applied to a new team-member invite. commit_withdraw stays off by
 * design — it requires a separate admin-approval request before the parent
 * investor can enable it.
 */
export const DEFAULT_TEAM_PERMISSIONS: TeamPermissions = {
  view_deals: true,
  manage_watchlist: true,
  commit_withdraw: false,
  download_documents: false,
  schedule_meetings: false,
};

/**
 * Keys that require admin approval before the parent investor can toggle them
 * on for a sub-user. Admin can revoke approval at any time (forcing the flag
 * back off and requiring re-request).
 */
export const APPROVAL_REQUIRED_KEYS: TeamPermissionKey[] = ['commit_withdraw'];

export function normalizePermissions(value: unknown): TeamPermissions {
  if (!value || typeof value !== 'object') return {};
  const out: TeamPermissions = {};
  for (const key of PERMISSION_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

interface PermissionUser {
  parent_investor_id?: string | null;
  permissions?: TeamPermissions | unknown;
  is_active?: boolean;
}

/**
 * True if this user is permitted to perform the action keyed by `key`.
 * Parent investors (parent_investor_id IS NULL) always pass — permissions only
 * apply to sub-users.
 */
export function hasPermission(user: PermissionUser | null | undefined, key: TeamPermissionKey): boolean {
  if (!user) return false;
  if (user.is_active === false) return false;
  if (!user.parent_investor_id) return true;
  const perms = normalizePermissions(user.permissions);
  return perms[key] === true;
}

/**
 * Returns true if this user is a team-invited sub-user (i.e. has a parent).
 */
export function isTeamMember(user: PermissionUser | null | undefined): boolean {
  return !!(user && user.parent_investor_id);
}
