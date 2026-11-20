/** Role-based + permission-based access control definitions (source of truth for seeding). */
export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'influencers.verify',
  'medical.verify',
  'businesses.verify',
  'categories.manage',
  'services.manage',
  'benchmarks.manage',
  'grading.manage',
  'bookings.read',
  'bookings.manage',
  'campaigns.manage',
  'contact_fees.manage',
  'commissions.manage',
  'payments.read',
  'refunds.manage',
  'payouts.manage',
  'disputes.manage',
  'ai.manage',
  'notifications.manage',
  'moderation.manage',
  'reports.read',
  'audit.read',
  'integrations.manage',
  'localization.manage',
  'settings.manage',
  'admins.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ADMIN_ROLES = {
  SUPER_ADMIN: [...PERMISSIONS],
  MARKETPLACE_ADMIN: [
    'users.read',
    'users.manage',
    'businesses.verify',
    'categories.manage',
    'services.manage',
    'benchmarks.manage',
    'grading.manage',
    'bookings.read',
    'bookings.manage',
    'campaigns.manage',
    'disputes.manage',
    'ai.manage',
    'reports.read',
    'localization.manage',
  ],
  INFLUENCER_VERIFICATION_ADMIN: ['users.read', 'influencers.verify', 'medical.verify'],
  FINANCE_ADMIN: [
    'users.read',
    'bookings.read',
    'payments.read',
    'refunds.manage',
    'payouts.manage',
    'contact_fees.manage',
    'commissions.manage',
    'reports.read',
  ],
  SUPPORT_ADMIN: ['users.read', 'bookings.read', 'campaigns.manage', 'disputes.manage', 'notifications.manage'],
  CONTENT_MODERATOR: ['users.read', 'moderation.manage'],
} as const satisfies Record<string, readonly Permission[]>;

export type AdminRole = keyof typeof ADMIN_ROLES;
export const BASE_ROLES = ['BUSINESS', 'INFLUENCER'] as const;

export function permissionsForRoles(roles: string[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    const perms = (ADMIN_ROLES as Record<string, readonly Permission[]>)[r];
    if (perms) perms.forEach((p) => set.add(p));
  }
  return set;
}

export function hasPermission(roles: string[], required: Permission | Permission[]): boolean {
  const perms = permissionsForRoles(roles);
  const list = Array.isArray(required) ? required : [required];
  return list.every((p) => perms.has(p));
}
