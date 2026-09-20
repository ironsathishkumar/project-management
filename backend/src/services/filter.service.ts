import { FilterQuery } from 'mongoose';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, startOfDay, endOfDay } from './date.helpers';

export interface FilterRule {
  field: string;
  operator: string;
  value?: unknown;
}

export interface FilterGroup {
  combinator: 'AND' | 'OR';
  rules: Array<FilterRule | FilterGroup>;
}

function isGroup(rule: FilterRule | FilterGroup): rule is FilterGroup {
  return 'combinator' in rule && 'rules' in rule;
}

function fieldPath(field: string): string {
  const map: Record<string, string> = {
    project: 'projectId',
    status: 'statusId',
    statusCategory: 'statusCategory',
    category: 'categoryId',
    priority: 'priority',
    assignee: 'assigneeId',
    creator: 'creatorId',
    tag: 'tagIds',
    dueDate: 'dueDate',
    startDate: 'startDate',
    createdDate: 'createdAt',
    updatedDate: 'updatedAt',
    milestone: 'milestoneId',
    title: 'title',
    description: 'description',
  };
  return map[field] ?? field;
}

function dateValue(operator: string, value: unknown): unknown {
  const now = new Date();
  switch (operator) {
    case 'today':
      return { $gte: startOfDay(now), $lte: endOfDay(now) };
    case 'this week':
    case 'this_week':
      return { $gte: startOfWeek(now), $lte: endOfWeek(now) };
    case 'this month':
    case 'this_month':
      return { $gte: startOfMonth(now), $lte: endOfMonth(now) };
    case 'overdue':
      return { $lt: startOfDay(now) };
    default:
      return value;
  }
}

function compileRule(rule: FilterRule): FilterQuery<unknown> {
  const path = fieldPath(rule.field);
  const operator = rule.operator;
  const value = rule.value;

  switch (operator) {
    case 'is':
      return { [path]: value };
    case 'is not':
    case 'is_not':
      return { [path]: { $ne: value } };
    case 'contains':
      return { [path]: { $regex: String(value ?? ''), $options: 'i' } };
    case 'does not contain':
    case 'does_not_contain':
      return { [path]: { $not: { $regex: String(value ?? ''), $options: 'i' } } };
    case 'is empty':
    case 'is_empty':
      return { $or: [{ [path]: null }, { [path]: '' }, { [path]: { $exists: false } }] };
    case 'is not empty':
    case 'is_not_empty':
      return { [path]: { $nin: [null, ''] } };
    case 'is any of':
    case 'is_any_of':
      return { [path]: { $in: Array.isArray(value) ? value : [value] } };
    case 'is none of':
    case 'is_none_of':
      return { [path]: { $nin: Array.isArray(value) ? value : [value] } };
    case 'before':
      return { [path]: { $lt: new Date(String(value)) } };
    case 'after':
      return { [path]: { $gt: new Date(String(value)) } };
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return { [path]: { $gte: new Date(String(value[0])), $lte: new Date(String(value[1])) } };
      }
      return {};
    case 'today':
    case 'this week':
    case 'this_week':
    case 'this month':
    case 'this_month':
      return { [path]: dateValue(operator, value) };
    case 'overdue':
      return { [path]: dateValue(operator, value), completedAt: null };
    case 'equals':
      return { [path]: value };
    case 'greater than':
    case 'greater_than':
      return { [path]: { $gt: value } };
    case 'less than':
    case 'less_than':
      return { [path]: { $lt: value } };
    default:
      return {};
  }
}

export function compileFilters(group?: FilterGroup | null): FilterQuery<unknown> {
  if (!group || !group.rules?.length) {
    return {};
  }

  const compiled = group.rules
    .map((rule) => (isGroup(rule) ? compileFilters(rule) : compileRule(rule)))
    .filter((item) => Object.keys(item).length > 0);

  if (!compiled.length) return {};
  if (group.combinator === 'OR') {
    return { $or: compiled };
  }
  return { $and: compiled };
}

export function parseFilters(raw?: string): FilterGroup | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as FilterGroup;
  } catch {
    return undefined;
  }
}
