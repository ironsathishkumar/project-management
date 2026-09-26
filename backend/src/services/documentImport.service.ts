import { PROJECT_STATUS, STATUS_CATEGORIES } from '../config/constants';
import { Category, Milestone, Project, Status, Task } from '../models';
import type { ProjectDocument } from '../models/Project';
import type { TaskDocument } from '../models/Task';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';
import { ParsedDocument, ParsedItem, parseDocumentFile } from './documentParser';
import { projectService } from './project.service';
import { taskService } from './task.service';

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

export interface ImportTarget {
  projectId?: string;
  projectName?: string;
  projectKey?: string;
}

type ExistingTask = TaskDocument;

interface ProjectState {
  project: ProjectDocument | null;
  existing: Map<string, ExistingTask>;
  statusById: Map<string, { name: string; category: string }>;
}

function countChanges(changes: ImportChange[]) {
  const counts: Record<ImportAction, number> = { CREATE: 0, COMPLETE: 0, UPDATE: 0, UNCHANGED: 0, REMOVED: 0 };
  for (const change of changes) counts[change.action] += 1;
  return counts;
}

async function loadProjectState(workspaceId: string, projectId?: string): Promise<ProjectState> {
  if (!projectId) {
    return { project: null, existing: new Map(), statusById: new Map() };
  }
  const project = await Project.findOne({ id: projectId, workspaceId });
  if (!project) {
    throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw ApiError.badRequest('PROJECT_ARCHIVED', 'Archived projects cannot receive imports');
  }
  const [tasks, statuses] = await Promise.all([
    Task.find({ workspaceId, projectId, externalKey: { $type: 'string' } }),
    Status.find({ workflowId: project.workflowId }),
  ]);
  return {
    project: project as ProjectDocument,
    existing: new Map(tasks.map((task) => [task.externalKey as string, task as TaskDocument])),
    statusById: new Map(statuses.map((status) => [status.id, { name: status.name, category: status.category }])),
  };
}

function diff(document: ParsedDocument, state: ProjectState): ImportChange[] {
  const changes: ImportChange[] = [];
  const seen = new Set<string>();

  for (const item of document.sections.flatMap((section) => section.items)) {
    seen.add(item.externalKey);
    const task = state.existing.get(item.externalKey);
    const base = { externalKey: item.externalKey, title: item.title, section: item.section, done: item.done };
    if (!task) {
      changes.push({ ...base, action: 'CREATE' });
      continue;
    }
    const status = state.statusById.get(task.statusId);
    const ref = { taskId: task.id, taskKey: task.key ?? undefined, statusName: status?.name };
    const isComplete = status?.category === STATUS_CATEGORIES.COMPLETED;

    if (item.done && !isComplete) {
      changes.push({ ...base, ...ref, action: 'COMPLETE' });
      continue;
    }

    const imported = task.source?.importedDescription ?? '';
    if (item.description !== imported) {
      if (task.description === imported) {
        changes.push({ ...base, ...ref, action: 'UPDATE', note: 'Description changed in document' });
      } else {
        changes.push({ ...base, ...ref, action: 'UNCHANGED', note: 'Description edited in app — kept' });
      }
      continue;
    }

    changes.push({
      ...base,
      ...ref,
      action: 'UNCHANGED',
      note: !item.done && isComplete ? 'Already done in app' : undefined,
    });
  }

  for (const [externalKey, task] of state.existing) {
    if (seen.has(externalKey) || task.source?.kind !== 'DOCUMENT' || task.source.name !== document.fileName) {
      continue;
    }
    changes.push({
      action: 'REMOVED',
      externalKey,
      title: task.title,
      section: task.source.section ?? '',
      done: false,
      taskId: task.id,
      taskKey: task.key ?? undefined,
      statusName: state.statusById.get(task.statusId)?.name,
      note: 'No longer in document — left unchanged',
    });
  }

  return changes;
}

export async function resolveDefaults(workspaceId: string, workflowId: string) {
  const [defaultStatus, completedStatus, categories] = await Promise.all([
    Status.findOne({ workflowId, isDefault: true, isActive: true }),
    Status.findOne({ workflowId, category: STATUS_CATEGORIES.COMPLETED, isActive: true }).sort({ order: 1 }),
    Category.find({ workspaceId, isActive: true }).sort({ order: 1 }),
  ]);
  const category = categories.find((item) => /^(feature|task)$/i.test(item.name)) ?? categories[0];
  if (!defaultStatus || !completedStatus) {
    throw ApiError.badRequest('WORKFLOW_INCOMPLETE', 'The project workflow needs a default and a completed status');
  }
  if (!category) {
    throw ApiError.badRequest('CATEGORY_REQUIRED', 'Create at least one task category before importing');
  }
  return { defaultStatus, completedStatus, category };
}

export async function ensureMilestones(workspaceId: string, projectId: string, sections: string[]) {
  const named = sections.filter((name) => name && name !== 'General');
  const existing = await Milestone.find({ workspaceId, projectId, name: { $in: named } });
  const byName = new Map(existing.map((milestone) => [milestone.name, milestone.id]));
  for (const name of named) {
    if (!byName.has(name)) {
      const milestone = await Milestone.create({ workspaceId, projectId, name, description: 'Created by import' });
      byName.set(name, milestone.id);
    }
  }
  return byName;
}

export const documentImportService = {
  async preview(workspaceId: string, file: { buffer: Buffer; originalname: string }, target: ImportTarget) {
    const document = await parseDocumentFile(file.buffer, file.originalname);
    const state = await loadProjectState(workspaceId, target.projectId);
    const changes = diff(document, state);
    return {
      document,
      target: state.project
        ? { projectId: state.project.id, projectName: state.project.name, projectKey: state.project.key, isNew: false }
        : { projectName: target.projectName || document.title, projectKey: target.projectKey, isNew: true },
      changes,
      counts: countChanges(changes),
    };
  },

  async apply(
    workspaceId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string },
    target: ImportTarget,
    via: Record<string, unknown> = { via: 'document' }
  ) {
    const document = await parseDocumentFile(file.buffer, file.originalname);
    if (!document.itemCount) {
      throw ApiError.badRequest(
        'NO_TASKS_FOUND',
        'No tasks were found. Use headings for sections and bullet or checkbox lists for tasks'
      );
    }

    let projectId = target.projectId;
    if (!projectId) {
      const created = await projectService.create(workspaceId, userId, {
        name: target.projectName || document.title,
        key: target.projectKey,
        description: `Imported from ${document.fileName}`,
      });
      projectId = created.id as string;
    }

    const state = await loadProjectState(workspaceId, projectId);
    const project = state.project!;
    const changes = diff(document, state);
    const items = new Map<string, ParsedItem>(
      document.sections.flatMap((section) => section.items).map((item) => [item.externalKey, item])
    );
    const { defaultStatus, completedStatus, category } = await resolveDefaults(workspaceId, project.workflowId);
    const milestones = await ensureMilestones(
      workspaceId,
      project.id,
      [...new Set(changes.filter((change) => change.action === 'CREATE').map((change) => change.section))]
    );
    const source = { kind: 'DOCUMENT' as const, name: document.fileName };
    let nextOrder = await Task.countDocuments({ projectId: project.id, sprintId: { $exists: false } });

    for (const change of changes) {
      const item = items.get(change.externalKey);
      if (change.action === 'CREATE' && item) {
        const created = await taskService.create(workspaceId, userId, {
          projectId: project.id,
          title: item.title,
          description: item.description,
          categoryId: category.id,
          statusId: item.done ? completedStatus.id : defaultStatus.id,
          milestoneId: milestones.get(item.section),
          externalKey: item.externalKey,
          source: { ...source, section: item.section, importedDescription: item.description },
        });
        const createdTask = created as unknown as { id?: string; key?: string } | null;
        change.taskId = createdTask?.id;
        change.taskKey = createdTask?.key;
        if (createdTask?.id) {
          await Task.updateOne({ id: createdTask.id }, { $set: { order: nextOrder++ } });
        }
        continue;
      }

      if (change.action === 'COMPLETE' && change.taskId) {
        const task = state.existing.get(change.externalKey)!;
        const order = await Task.countDocuments({ projectId: project.id, statusId: completedStatus.id });
        const fromStatusId = task.statusId;
        await Task.updateOne(
          { id: task.id },
          { $set: { statusId: completedStatus.id, completedAt: new Date(), order, 'source.syncedAt': new Date() } }
        );
        await activityService.record({
          workspaceId,
          projectId: project.id,
          taskId: task.id,
          userId,
          action: 'TASK_STATUS_CHANGED',
          entityType: 'task',
          entityId: task.id,
          metadata: { fromStatusId, toStatusId: completedStatus.id, ...via, fileName: document.fileName },
        });
        continue;
      }

      if (change.action === 'UPDATE' && change.taskId && item) {
        await Task.updateOne(
          { id: change.taskId },
          {
            $set: {
              description: item.description,
              'source.importedDescription': item.description,
              'source.syncedAt': new Date(),
            },
          }
        );
      }
    }

    const counts = countChanges(changes);
    await activityService.record({
      workspaceId,
      projectId: project.id,
      userId,
      action: 'DOCUMENT_IMPORTED',
      entityType: 'project',
      entityId: project.id,
      metadata: { ...via, fileName: document.fileName, counts },
    });

    return {
      project: { id: project.id, name: project.name, key: project.key },
      changes,
      counts,
    };
  },
};
