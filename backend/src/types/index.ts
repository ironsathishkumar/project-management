import { Permission } from '../config/constants';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  membershipId: string;
  roleId: string;
  roleKey: string;
  permissions: Permission[];
  projectId?: string;
  projectRole?: string;
  /** Present for non-admin members — project IDs they can access */
  assignedProjectIds?: string[];
}
