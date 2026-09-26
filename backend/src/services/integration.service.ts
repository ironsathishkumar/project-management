import crypto from 'crypto';
import { PROJECT_STATUS } from '../config/constants';
import { Activity, Integration, Project, Status, Task, User } from '../models';
import { AppContext } from '../types';
import { ApiError } from '../utils/ApiError';

const KEY_PREFIX = 'pmk_';

function generateKey() {
  const apiKey = `${KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  return { apiKey, keyPrefix: apiKey.slice(0, 12), keyHash: hashKey(apiKey) };
}

function hashKey(apiKey: string) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

type IntegrationRecord = InstanceType<typeof Integration>;

async function present(integrations: IntegrationRecord[]) {
  const projectIds = [...new Set(integrations.map((item) => item.projectId))];
  const userIds = [...new Set(integrations.map((item) => item.createdBy))];
  const [projects, users] = await Promise.all([
    Project.find({ id: { $in: projectIds } }).select('id name key'),
    User.find({ id: { $in: userIds } }).select('id firstName lastName'),
  ]);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const userById = new Map(users.map((user) => [user.id, user]));
  return integrations.map((item) => {
    const project = projectById.get(item.projectId);
    const creator = userById.get(item.createdBy);
    return {
      id: item.id as string,
      projectId: item.projectId,
      project: project ? { id: project.id as string, name: project.name, key: project.key } : null,
      name: item.name,
      description: item.description,
      keyPrefix: item.keyPrefix,
      status: item.status,
      createdBy: creator ? { id: creator.id as string, name: `${creator.firstName} ${creator.lastName}`.trim() } : null,
      lastUsedAt: item.lastUsedAt,
      requestCount: item.requestCount,
      createdAt: (item as unknown as { createdAt: Date }).createdAt,
    };
  });
}

async function findOwned(workspaceId: string, integrationId: string) {
  const integration = await Integration.findOne({ id: integrationId, workspaceId });
  if (!integration) {
    throw ApiError.notFound('INTEGRATION_NOT_FOUND', 'Integration not found');
  }
  return integration;
}

export const integrationService = {
  async list(workspaceId: string, projectId?: string) {
    const query: Record<string, unknown> = { workspaceId };
    if (projectId) query.projectId = projectId;
    return present(await Integration.find(query).sort({ createdAt: -1 }));
  },

  async create(workspaceId: string, userId: string, input: { name: string; projectId: string; description?: string }) {
    const project = await Project.findOne({ id: input.projectId, workspaceId });
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    if (project.status === PROJECT_STATUS.ARCHIVED) {
      throw ApiError.badRequest('PROJECT_ARCHIVED', 'Archived projects cannot be connected');
    }
    const { apiKey, keyPrefix, keyHash } = generateKey();
    const integration = await Integration.create({
      workspaceId,
      projectId: project.id,
      name: input.name,
      description: input.description ?? '',
      keyPrefix,
      keyHash,
      createdBy: userId,
    });
    const [presented] = await present([integration]);
    return { integration: presented, apiKey };
  },

  async update(
    workspaceId: string,
    integrationId: string,
    input: { name?: string; description?: string; status?: 'ACTIVE' | 'REVOKED' }
  ) {
    const integration = await findOwned(workspaceId, integrationId);
    if (input.name !== undefined) integration.name = input.name;
    if (input.description !== undefined) integration.description = input.description;
    if (input.status !== undefined) integration.status = input.status;
    await integration.save();
    const [presented] = await present([integration]);
    return presented;
  },

  async rotate(workspaceId: string, integrationId: string) {
    const integration = await findOwned(workspaceId, integrationId);
    const { apiKey, keyPrefix, keyHash } = generateKey();
    integration.keyPrefix = keyPrefix;
    integration.keyHash = keyHash;
    integration.status = 'ACTIVE';
    await integration.save();
    const [presented] = await present([integration]);
    return { integration: presented, apiKey };
  },

  async remove(workspaceId: string, integrationId: string) {
    const integration = await findOwned(workspaceId, integrationId);
    await integration.deleteOne();
    return { deleted: true };
  },

  async activity(workspaceId: string, integrationId: string, limit = 25) {
    await findOwned(workspaceId, integrationId);
    const items = await Activity.find({ workspaceId, 'metadata.integrationId': integrationId })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100));
    const taskIds = [...new Set(items.map((item) => item.taskId).filter(Boolean))] as string[];
    const statusIds = [
      ...new Set(
        items
          .map((item) => (item.metadata as Record<string, unknown> | undefined)?.toStatusId)
          .filter((value): value is string => typeof value === 'string')
      ),
    ];
    const [tasks, statuses] = await Promise.all([
      Task.find({ id: { $in: taskIds } }).select('id key title'),
      Status.find({ id: { $in: statusIds } }).select('id name'),
    ]);
    const taskById = new Map(tasks.map((task) => [task.id, { key: task.key ?? null, title: task.title }]));
    const statusById = new Map(statuses.map((status) => [status.id, status.name]));
    return items.map((item) => {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      return {
        id: item.id as string,
        action: item.action,
        taskId: item.taskId,
        task: item.taskId ? taskById.get(item.taskId) ?? null : null,
        toStatus: typeof metadata.toStatusId === 'string' ? statusById.get(metadata.toStatusId) ?? null : null,
        metadata,
        createdAt: (item as unknown as { createdAt: Date }).createdAt,
      };
    });
  },

  async authenticate(apiKey: string): Promise<AppContext> {
    if (!apiKey.startsWith(KEY_PREFIX)) {
      throw ApiError.unauthorized('Invalid API key');
    }
    const integration = await Integration.findOne({ keyHash: hashKey(apiKey) });
    if (!integration || integration.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Invalid or revoked API key');
    }
    const project = await Project.findOne({ id: integration.projectId, workspaceId: integration.workspaceId });
    if (!project || project.status === PROJECT_STATUS.ARCHIVED) {
      throw ApiError.forbidden('The connected project is archived or no longer exists');
    }
    Integration.updateOne({ id: integration.id }, { $set: { lastUsedAt: new Date() }, $inc: { requestCount: 1 } })
      .exec()
      .catch(() => undefined);
    return {
      integrationId: integration.id as string,
      integrationName: integration.name,
      workspaceId: integration.workspaceId,
      projectId: integration.projectId,
      actorUserId: integration.createdBy,
    };
  },
};
