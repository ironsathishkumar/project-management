import { Workflow, Status, WorkflowTransition, Project } from '../models';
import { keyify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';

export const workflowService = {
  async list(workspaceId: string) {
    const workflows = await Workflow.find({ workspaceId, isActive: true }).sort({ createdAt: 1 });
    const workflowIds = workflows.map((item) => item.id);
    const statuses = await Status.find({ workflowId: { $in: workflowIds }, isActive: true }).sort({ order: 1 });
    const transitions = await WorkflowTransition.find({ workflowId: { $in: workflowIds } });

    return workflows.map((workflow) => ({
      ...workflow.toJSON(),
      statuses: statuses.filter((status) => status.workflowId === workflow.id),
      transitions: transitions.filter((item) => item.workflowId === workflow.id),
    }));
  },

  async get(workspaceId: string, workflowId: string) {
    const workflow = await Workflow.findOne({ id: workflowId, workspaceId, isActive: true });
    if (!workflow) {
      throw ApiError.notFound('WORKFLOW_NOT_FOUND', 'Workflow not found');
    }
    const statuses = await Status.find({ workflowId, isActive: true }).sort({ order: 1 });
    const transitions = await WorkflowTransition.find({ workflowId });
    return { ...workflow.toJSON(), statuses, transitions };
  },

  async create(workspaceId: string, input: { name: string; description?: string; isDefault?: boolean }) {
    if (input.isDefault) {
      await Workflow.updateMany({ workspaceId }, { isDefault: false });
    }
    const workflow = await Workflow.create({
      workspaceId,
      name: input.name,
      description: input.description ?? '',
      isDefault: Boolean(input.isDefault),
    });
    return workflow;
  },

  async update(workspaceId: string, workflowId: string, input: Record<string, unknown>) {
    if (input.isDefault) {
      await Workflow.updateMany({ workspaceId }, { isDefault: false });
    }
    const workflow = await Workflow.findOneAndUpdate({ id: workflowId, workspaceId }, input, { new: true });
    if (!workflow) {
      throw ApiError.notFound('WORKFLOW_NOT_FOUND', 'Workflow not found');
    }
    return workflow;
  },

  async remove(workspaceId: string, workflowId: string) {
    const inUse = await Project.findOne({ workspaceId, workflowId, status: { $ne: 'ARCHIVED' } });
    if (inUse) {
      throw ApiError.conflict('WORKFLOW_IN_USE', 'Workflow is assigned to a project');
    }
    const workflow = await Workflow.findOneAndUpdate(
      { id: workflowId, workspaceId },
      { isActive: false },
      { new: true }
    );
    if (!workflow) {
      throw ApiError.notFound('WORKFLOW_NOT_FOUND', 'Workflow not found');
    }
    return workflow;
  },

  async addStatus(
    workflowId: string,
    input: {
      name: string;
      category: string;
      color?: string;
      icon?: string;
      isDefault?: boolean;
      isFinal?: boolean;
      order?: number;
    }
  ) {
    const workflow = await Workflow.findOne({ id: workflowId, isActive: true });
    if (!workflow) {
      throw ApiError.notFound('WORKFLOW_NOT_FOUND', 'Workflow not found');
    }
    const count = await Status.countDocuments({ workflowId });
    if (input.isDefault) {
      await Status.updateMany({ workflowId }, { isDefault: false });
    }
    return Status.create({
      workflowId,
      name: input.name,
      key: keyify(input.name),
      category: input.category,
      color: input.color ?? '#64748B',
      icon: input.icon ?? 'circle',
      isDefault: Boolean(input.isDefault),
      isFinal: Boolean(input.isFinal),
      order: input.order ?? count,
    });
  },

  async updateStatus(statusId: string, input: Record<string, unknown>) {
    const status = await Status.findOne({ id: statusId });
    if (!status) {
      throw ApiError.notFound('STATUS_NOT_FOUND', 'Status not found');
    }
    if (input.isDefault) {
      await Status.updateMany({ workflowId: status.workflowId }, { isDefault: false });
    }
    Object.assign(status, input);
    await status.save();
    return status;
  },

  async reorder(workflowId: string, statusIds: string[]) {
    await Promise.all(
      statusIds.map((statusId, order) => Status.updateOne({ id: statusId, workflowId }, { order }))
    );
    return Status.find({ workflowId, isActive: true }).sort({ order: 1 });
  },

  async removeStatus(statusId: string) {
    const status = await Status.findOneAndUpdate({ id: statusId }, { isActive: false }, { new: true });
    if (!status) {
      throw ApiError.notFound('STATUS_NOT_FOUND', 'Status not found');
    }
    return status;
  },
};
