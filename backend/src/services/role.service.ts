import {
  ALL_PERMISSIONS,
  ADMIN_PERMISSIONS,
  MEMBER_PERMISSIONS,
  ROLE_KEYS,
  VIEWER_PERMISSIONS,
} from '../config/constants';
import { Role } from '../models';

export async function ensureSystemRoles() {
  const definitions = [
    {
      key: ROLE_KEYS.OWNER,
      name: 'Owner',
      description: 'Highest workspace authority',
      permissions: ALL_PERMISSIONS,
    },
    {
      key: ROLE_KEYS.ADMIN,
      name: 'Admin',
      description: 'Manages workspace configuration and members',
      permissions: ADMIN_PERMISSIONS,
    },
    {
      key: ROLE_KEYS.MEMBER,
      name: 'Member',
      description: 'Creates and works on tasks',
      permissions: MEMBER_PERMISSIONS,
    },
    {
      key: ROLE_KEYS.VIEWER,
      name: 'Viewer',
      description: 'Read-only access',
      permissions: VIEWER_PERMISSIONS,
    },
  ];

  const roles = [];
  for (const definition of definitions) {
    const role = await Role.findOneAndUpdate(
      { key: definition.key, workspaceId: { $exists: false } },
      { ...definition, isSystemRole: true, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    roles.push(role);
  }
  return roles;
}

export async function getSystemRole(key: string) {
  await ensureSystemRoles();
  const role = await Role.findOne({ key, isSystemRole: true });
  if (!role) {
    throw new Error(`System role ${key} is missing`);
  }
  return role;
}
