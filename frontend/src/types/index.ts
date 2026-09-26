export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
}

export interface Role {
  id: string;
  name: string;
  key: string;
  permissions: string[];
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}

export interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  role?: Role;
}

export interface AuthUser extends User {
  memberships?: Membership[];
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description?: string;
  icon?: string;
  status: string;
  ownerId: string;
  workflowId: string;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Status {
  id: string;
  workflowId: string;
  name: string;
  key: string;
  category: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  order: number;
  color: string;
  icon: string;
  isDefault: boolean;
  isFinal: boolean;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  statuses: Status[];
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
  key: string;
  color: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  parentTaskId?: string;
  milestoneId?: string;
  sprintId?: string;
  number?: number;
  key?: string;
  storyPoints?: number | null;
  title: string;
  description?: string;
  statusId: string;
  categoryId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string;
  creatorId: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  order: number;
  status?: Status | null;
  category?: Category | null;
  assignee?: User | null;
  creator?: User | null;
  tags?: Tag[];
  commentCount?: number;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  subtasks?: Task[];
  comments?: Comment[];
  externalKey?: string;
  source?: TaskSource;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSource {
  kind: 'DOCUMENT' | 'APP' | 'GITHUB';
  name?: string;
  section?: string;
  syncedAt?: string;
}

export type ImportAction = 'CREATE' | 'COMPLETE' | 'UPDATE' | 'UNCHANGED' | 'REMOVED';

export interface ImportChange {
  action: ImportAction;
  externalKey: string;
  title: string;
  section: string;
  done: boolean;
  taskId?: string;
  taskKey?: string;
  statusName?: string;
  note?: string;
}

export interface ParsedImportDocument {
  fileName: string;
  format: 'markdown' | 'text' | 'docx' | 'pdf';
  title: string;
  mode: 'checklist' | 'list' | 'headings';
  itemCount: number;
  doneCount: number;
  sections: Array<{ title: string; items: Array<{ externalKey: string; title: string; done: boolean }> }>;
}

export interface ImportPreview {
  document: ParsedImportDocument;
  target: { projectId?: string; projectName?: string; projectKey?: string; isNew: boolean };
  changes: ImportChange[];
  counts: Record<ImportAction, number>;
}

export interface Integration {
  id: string;
  projectId: string;
  project: { id: string; name: string; key: string } | null;
  name: string;
  description: string;
  keyPrefix: string;
  status: 'ACTIVE' | 'REVOKED';
  createdBy: { id: string; name: string } | null;
  lastUsedAt?: string;
  requestCount: number;
  github: IntegrationGithub | null;
  createdAt: string;
}

export interface IntegrationGithub {
  repo: string;
  branch: string;
  docsPath: string;
  autoSync: boolean;
  hasToken: boolean;
  hasWebhookSecret: boolean;
  webhookUrl: string;
  lastSyncedAt?: string;
  lastEventAt?: string;
  lastEventStatus?: 'OK' | 'ERROR';
  lastEventMessage?: string;
}

export interface GithubTestResult {
  repo: string;
  private: boolean;
  defaultBranch: string;
  docFound: boolean | null;
}

export interface GithubSyncResult {
  message: string;
  commits: { processed: number; skipped: number; taskUpdates: number };
  document: { ok: boolean; error?: string } | null;
}

export interface IntegrationWithKey {
  integration: Integration;
  apiKey: string;
}

export interface IntegrationActivity {
  id: string;
  action: string;
  taskId?: string;
  task: { key: string | null; title: string } | null;
  toStatus: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ImportResult {
  project: { id: string; name: string; key: string };
  changes: ImportChange[];
  counts: Record<ImportAction, number>;
}

export interface Sprint {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  goal?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
  startedAt?: string;
  completedAt?: string;
  order: number;
  taskCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
  user?: User | null;
}

export interface FilterRule {
  field: string;
  operator: string;
  value?: unknown;
}

export interface FilterGroup {
  combinator: 'AND' | 'OR';
  rules: Array<FilterRule | FilterGroup>;
}

export interface SavedView {
  id: string;
  name: string;
  viewType: 'BOARD' | 'LIST' | 'CALENDAR' | 'TIMELINE';
  filters: FilterGroup;
  sorting: { field: string; direction: 'asc' | 'desc' };
  grouping: string;
  columns: string[];
}

export interface ReportSummary {
  totals: { projects: number; tasks: number; completed: number; overdue: number };
  statusDistribution: Array<{ name: string; value: number }>;
  categoryDistribution: Array<{ name: string; value: number; color: string }>;
  workload: Array<{ assigneeId: string; count: number }>;
  projectProgress: Array<{ projectId: string; name: string; total: number; completed: number; progress: number }>;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityId?: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  roleId: string;
  status: string;
  user: User | null;
  role?: Role | null;
}

export interface ProjectRole {
  id: string;
  projectId: string;
  name: string;
  key: string;
  permissionLevel: 'MANAGER' | 'MEMBER' | 'VIEWER';
  color: string;
  description?: string;
  isDefault?: boolean;
  order?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  projectRole: string;
  user?: User | null;
  role?: Partial<ProjectRole> | null;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  minutes: number;
  workDate: string;
  description?: string;
  user?: User | null;
  createdAt: string;
}

export interface TimeEntrySummary {
  totalMinutes: number;
  entries: TimeEntry[];
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  status: string;
  dueDate?: string;
}

export type NavMenuIcon =
  | 'dashboard'
  | 'folder'
  | 'people'
  | 'tasks'
  | 'calendar'
  | 'reports'
  | 'settings'
  | 'board'
  | 'backlog'
  | 'list'
  | 'timeline'
  | 'overview'
  | 'integrations';

export interface NavMenuItem {
  key: string;
  label: string;
  href: string;
  icon: NavMenuIcon;
  order: number;
}

export interface NavigationMenus {
  roleKey: string;
  isAdmin: boolean;
  workspace: NavMenuItem[];
  project: NavMenuItem[];
  projectSide: NavMenuItem[];
}
