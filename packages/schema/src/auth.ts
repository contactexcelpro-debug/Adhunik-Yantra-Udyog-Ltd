import { z } from 'zod';

/**
 * Roles and permissions.
 *
 * One matrix, shared by the API and the web app: the server enforces it, the interface
 * reads the same table to decide what to show. A control that is hidden is also refused,
 * and a control that is refused is not shown — they cannot drift apart.
 */

export const ROLES = ['viewer', 'engineer', 'approver', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const roleSchema = z.enum(ROLES);

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Viewer',
  engineer: 'Engineer',
  approver: 'Approver',
  admin: 'Administrator',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  viewer: 'Read designs, calculations and reference data. Can download sheets, changes nothing.',
  engineer: 'Raise, edit and calculate designs, and record manufactured results.',
  approver: 'Everything an engineer does, plus approving designs and maintaining reference data.',
  admin: 'Full access, including user accounts.',
};

export const PERMISSIONS = [
  'designs.view',
  'designs.create',
  'designs.edit',
  'designs.calculate',
  'designs.select',
  'designs.revise',
  'designs.archive',
  'designs.delete',
  'designs.approve',
  'results.record',
  'reference.view',
  'reference.edit',
  'customers.edit',
  'customers.delete',
  'users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ['designs.view', 'reference.view'];

const ENGINEER: Permission[] = [
  ...VIEWER,
  'designs.create',
  'designs.edit',
  'designs.calculate',
  'designs.select',
  'designs.revise',
  'designs.archive',
  // Approved work is protected separately, by the route: no role can delete it.
  'designs.delete',
  'results.record',
  'customers.edit',
];

const APPROVER: Permission[] = [
  ...ENGINEER,
  'designs.approve',
  // Reference data changes every future calculation, so it sits above the engineer role.
  'reference.edit',
  'customers.delete',
];

const ADMIN: Permission[] = [...APPROVER, 'users.manage'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: VIEWER,
  engineer: ENGINEER,
  approver: APPROVER,
  admin: ADMIN,
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/* ─────────────────────────── payloads ─────────────────────────── */

export const emailSchema = z
  .string()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .transform((v) => v.trim().toLowerCase());

/**
 * Long over complex. Length is what actually resists guessing, and a rule that forces
 * symbols mostly produces one predictable symbol on the end.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'That is longer than 200 characters.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const setupSchema = z.object({
  name: z.string().min(1, 'Your name is required.'),
  email: emailSchema,
  password: passwordSchema,
});

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: emailSchema,
  role: roleSchema,
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required.').optional(),
  email: emailSchema.optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  /** Set by an administrator; the holder should change it at next sign-in. */
  password: passwordSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
});

export type LoginDto = z.infer<typeof loginSchema>;
export type SetupDto = z.infer<typeof setupSchema>;
export type UserCreateDto = z.infer<typeof userCreateSchema>;
export type UserUpdateDto = z.infer<typeof userUpdateSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
