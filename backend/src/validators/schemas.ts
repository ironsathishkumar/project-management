import { z } from 'zod';
import { TASK_PRIORITIES, VIEW_TYPES } from '../config/constants';

export const registerSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phoneNumber: z.string().max(32).optional(),
  profileImage: z.string().url().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  bloodGroup: z.string().max(8).optional(),
  dateOfBirth: z.coerce.date().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
    .optional(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleKey: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  /** Required when the email is not registered yet. */
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  /** Temporary password for newly created users. Defaults to ChangeMe123! */
  password: z.string().min(8).max(100).optional(),
});

export const updateMemberSchema = z
  .object({
    roleKey: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional(),
    status: z.enum(['ACTIVE', 'DISABLED', 'INVITED']).optional(),
  })
  .refine((value) => Boolean(value.roleKey || value.status), {
    message: 'Provide roleKey and/or status',
  });

export const createProjectSchema = z.object({
  name: z.string().min(2).max(80),
  key: z.string().min(2).max(8).optional(),
  description: z.string().max(2000).optional(),
  workflowId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  icon: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  projectRole: z.string().min(1).max(64).default('FULL_STACK'),
});

export const updateProjectMemberSchema = z.object({
  projectRole: z.string().min(1).max(64),
});

export const createProjectRoleSchema = z.object({
  name: z.string().min(1).max(80),
  key: z.string().min(2).max(32).optional(),
  permissionLevel: z.enum(['MANAGER', 'MEMBER', 'VIEWER']).optional(),
  color: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const updateProjectRoleSchema = createProjectRoleSchema.partial();

export const createTimeEntrySchema = z.object({
  minutes: z.number().min(1).max(24 * 60),
  workDate: z.coerce.date().optional(),
  description: z.string().max(1000).optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

export const createStatusSchema = z.object({
  name: z.string().min(1).max(40),
  category: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  color: z.string().optional(),
  icon: z.string().optional(),
  isDefault: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const updateStatusSchema = createStatusSchema.partial();

export const reorderStatusesSchema = z.object({
  statusIds: z.array(z.string().uuid()).min(1),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(200).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const filterRuleSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown().optional(),
    }),
    z.object({
      combinator: z.enum(['AND', 'OR']),
      rules: z.array(filterRuleSchema),
    }),
  ])
);

export const filterGroupSchema = z.object({
  combinator: z.enum(['AND', 'OR']).default('AND'),
  rules: z.array(filterRuleSchema).default([]),
});

export const taskQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  search: z.string().optional(),
  grouping: z.enum(['status', 'category', 'priority', 'assignee', 'milestone']).optional(),
  sortField: z
    .enum(['priority', 'dueDate', 'createdAt', 'updatedAt', 'status', 'assignee', 'category', 'title'])
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  viewType: z.enum(VIEW_TYPES).optional(),
  filters: z.string().optional(),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  statusId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  storyPoints: z.number().min(0).max(100).nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ projectId: true });

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  order: z.number().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
});

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  ownerId: z.string().uuid().optional(),
});

export const createSprintSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(2000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const updateSprintSchema = createSprintSchema.partial();

export const completeSprintSchema = z.object({
  moveIncompleteToBacklog: z.boolean().optional(),
  moveIncompleteToSprintId: z.string().uuid().optional(),
});

export const moveTasksToSprintSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  sprintId: z.string().uuid().nullable(),
  /** Insert index within the target sprint/backlog (0-based). Appends when omitted. */
  order: z.number().int().min(0).optional(),
});

export const createDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
  type: z.enum(['BLOCKS', 'BLOCKED_BY', 'RELATED_TO']),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().optional(),
});

export const createViewSchema = z.object({
  name: z.string().min(1).max(80),
  viewType: z.enum(VIEW_TYPES),
  projectId: z.string().uuid().optional(),
  filters: filterGroupSchema.optional(),
  sorting: z
    .object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  grouping: z.string().optional(),
  columns: z.array(z.string()).optional(),
  isShared: z.boolean().optional(),
});

export const createCustomFieldSchema = z.object({
  name: z.string().min(1).max(80),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'USER']),
  projectId: z.string().uuid().optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
});

export const createIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  projectId: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const updateIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['ACTIVE', 'REVOKED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const appTaskFields = {
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20000).optional(),
  status: z.string().trim().min(1).max(60).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  comment: z.string().trim().min(1).max(5000).optional(),
};

export const appUpsertTaskSchema = z.object({
  externalKey: z.string().trim().min(1).max(200),
  section: z.string().trim().max(120).optional(),
  ...appTaskFields,
});

export const appBulkUpsertSchema = z.object({
  tasks: z.array(appUpsertTaskSchema).min(1).max(500),
});

export const appUpdateTaskSchema = z
  .object(appTaskFields)
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const appCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const configureGithubSchema = z.object({
  repo: z.string().trim().min(3).max(200),
  branch: z.string().trim().max(200).optional(),
  docsPath: z.string().trim().max(300).optional(),
  token: z.string().trim().max(400).nullable().optional(),
  autoSync: z.boolean().optional(),
});

const githubTargetFields = {
  repo: z.string().trim().min(3).max(200),
  token: z.string().trim().max(400).optional(),
  branch: z.string().trim().max(200).optional(),
  docsPath: z.string().trim().max(300).optional(),
  projectId: z.string().min(1).optional(),
  projectName: z.string().trim().max(120).optional(),
  projectKey: z.string().trim().max(8).optional(),
};

export const githubDiscoverSchema = z.object(githubTargetFields);

export const githubSetupSchema = z.object({
  ...githubTargetFields,
  autoSync: z.boolean().optional(),
  sinceDays: z.number().int().min(1).max(90).optional(),
});

export const githubSyncSchema = z.object({
  sinceDays: z.number().int().min(1).max(90).optional(),
});

export const appCommitsSchema = z.object({
  branch: z.string().trim().max(200).optional(),
  commits: z
    .array(
      z.object({
        sha: z.string().trim().min(7).max(64),
        message: z.string().max(20000),
        url: z.string().url().max(500).optional(),
        author: z.string().max(200).optional(),
        branch: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(300),
});
