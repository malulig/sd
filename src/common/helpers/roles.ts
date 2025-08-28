export const ROLE = {
  admin: 'admin',
  manager: 'manager',
  user: 'user',
} as const;

export type AppRole = typeof ROLE[keyof typeof ROLE];

export const isAppRole = (v: unknown): v is AppRole =>
  v === ROLE.admin || v === ROLE.manager || v === ROLE.user;

export const toAppRole = (v: unknown): AppRole =>
  isAppRole(v) ? v : ROLE.user; 
