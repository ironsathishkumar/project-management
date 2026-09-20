export const PERMISSIONS = {
  WORKSPACE_VIEW: 'workspace.view',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_DELETE: 'workspace.delete',
  MEMBER_VIEW: 'member.view',
  MEMBER_INVITE: 'member.invite',
  MEMBER_UPDATE: 'member.update',
  MEMBER_REMOVE: 'member.remove',
  PROJECT_VIEW: 'project.view',
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_ARCHIVE: 'project.archive',
  PROJECT_DELETE: 'project.delete',
  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  TASK_ASSIGN: 'task.assign',
  TASK_MOVE: 'task.move',
  TASK_COMMENT: 'task.comment',
  WORKFLOW_VIEW: 'workflow.view',
  WORKFLOW_CREATE: 'workflow.create',
  WORKFLOW_UPDATE: 'workflow.update',
  WORKFLOW_DELETE: 'workflow.delete',
  CATEGORY_VIEW: 'category.view',
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',
  REPORT_VIEW: 'report.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_KEYS = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export const PROJECT_ROLES = {
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export const STATUS_CATEGORIES = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const DEPENDENCY_TYPES = ['BLOCKS', 'BLOCKED_BY', 'RELATED_TO'] as const;

export const VIEW_TYPES = ['BOARD', 'LIST', 'CALENDAR', 'TIMELINE'] as const;

export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  DISABLED: 'DISABLED',
} as const;

export const PROJECT_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (permission) => permission !== PERMISSIONS.WORKSPACE_DELETE
);

export const MEMBER_PERMISSIONS: Permission[] = [
  PERMISSIONS.WORKSPACE_VIEW,
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_CREATE,
  PERMISSIONS.TASK_UPDATE,
  PERMISSIONS.TASK_ASSIGN,
  PERMISSIONS.TASK_MOVE,
  PERMISSIONS.TASK_COMMENT,
  PERMISSIONS.WORKFLOW_VIEW,
  PERMISSIONS.CATEGORY_VIEW,
];

export const VIEWER_PERMISSIONS: Permission[] = [
  PERMISSIONS.WORKSPACE_VIEW,
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.WORKFLOW_VIEW,
  PERMISSIONS.CATEGORY_VIEW,
];

/** Elevated task rights on assigned projects — not workspace admin. */
export const PROJECT_MANAGER_PERMISSIONS: Permission[] = [
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_CREATE,
  PERMISSIONS.TASK_UPDATE,
  PERMISSIONS.TASK_DELETE,
  PERMISSIONS.TASK_ASSIGN,
  PERMISSIONS.TASK_MOVE,
  PERMISSIONS.TASK_COMMENT,
  PERMISSIONS.WORKFLOW_VIEW,
  PERMISSIONS.CATEGORY_VIEW,
];
