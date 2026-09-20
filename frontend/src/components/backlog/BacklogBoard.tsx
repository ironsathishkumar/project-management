'use client';

import { useCreateTask, useMoveTasksToSprint } from '@/hooks/useApi';
import { ApiClientError } from '@/lib/api';
import { Category, Sprint, Task } from '@/types';
import {
  BugReportOutlined,
  DragIndicator,
  ExpandLess,
  ExpandMore,
  TaskAltOutlined,
} from '@mui/icons-material';
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  MeasuringStrategy,
  PointerSensor,
  UniqueIdentifier,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const BACKLOG_ID = 'backlog';

type ContainerItems = Record<string, string[]>;
type QuickType = 'task' | 'bug';

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
};

function sprintIdFromContainer(containerId: string): string | null {
  return containerId === BACKLOG_ID ? null : containerId;
}

function containerIdForTask(task: Task) {
  return task.sprintId || BACKLOG_ID;
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

function buildContainerItems(containerIds: string[], tasks: Task[]): ContainerItems {
  const next: ContainerItems = {};
  for (const id of containerIds) next[id] = [];

  for (const task of sortTasks(tasks)) {
    const containerId = containerIdForTask(task);
    if (!next[containerId]) next[containerId] = [];
    next[containerId].push(task.id);
  }

  return next;
}

function resolveCategory(categories: Category[], type: QuickType) {
  if (type === 'bug') {
    return categories.find((item) => item.key === 'BUG') ?? categories.find((item) => /bug/i.test(item.name));
  }
  return (
    categories.find((item) => item.key === 'FEATURE') ??
    categories.find((item) => item.key === 'TASK') ??
    categories.find((item) => /feature|task/i.test(item.name)) ??
    categories[0]
  );
}

function sumPoints(tasks: Task[]) {
  return tasks.reduce((total, task) => total + (task.storyPoints ?? 0), 0);
}

function IssueRow({
  task,
  selected,
  onToggle,
  onOpen,
  onPointsChange,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onPointsChange: (points: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task, containerId: containerIdForTask(task) },
  });
  const suppressClick = useRef(false);

  useEffect(() => {
    if (isDragging) suppressClick.current = true;
  }, [isDragging]);

  return (
    <Stack
      ref={setNodeRef}
      direction="row"
      alignItems="center"
      spacing={0.75}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      sx={{
        px: 1,
        py: 0.75,
        borderBottom: '1px solid #F0EAE0',
        bgcolor: selected ? '#FFF4E0' : 'transparent',
        '&:hover': { bgcolor: selected ? '#FFF4E0' : '#FAF7F1' },
        touchAction: 'none',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', color: 'text.disabled', cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
      >
        <DragIndicator fontSize="small" />
      </Box>
      <Checkbox size="small" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
      <Chip
        size="small"
        label={task.category?.name ?? 'Issue'}
        sx={{
          height: 22,
          bgcolor: task.category?.color ? `${task.category.color}22` : undefined,
          color: task.category?.color,
          fontWeight: 600,
          minWidth: 64,
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ width: 64, flexShrink: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        {task.key ?? '—'}
      </Typography>
      <Box
        sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen();
        }}
      >
        <Typography variant="body2" noWrap fontWeight={600}>
          {task.title}
        </Typography>
      </Box>
      <Chip size="small" variant="outlined" label={task.status?.name ?? '—'} sx={{ display: { xs: 'none', md: 'flex' } }} />
      <Typography variant="caption" color="text.secondary" sx={{ width: 64, display: { xs: 'none', sm: 'block' } }}>
        {task.priority}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ width: 100, display: { xs: 'none', lg: 'block' } }} noWrap>
        {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={task.storyPoints ?? ''}
        placeholder="Pts"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const raw = e.target.value;
          onPointsChange(raw === '' ? null : Number(raw));
        }}
        inputProps={{ min: 0, max: 100, step: 1 }}
        sx={{ width: 64, '& .MuiInputBase-root': { height: 28, fontSize: 12 } }}
      />
    </Stack>
  );
}

function QuickCreate({
  projectId,
  sprintId,
  categories,
}: {
  projectId: string;
  sprintId: string | null;
  categories: Category[];
}) {
  const createTask = useCreateTask();
  const [type, setType] = useState<QuickType | null>(null);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [error, setError] = useState('');

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!type || !title.trim()) return;
    const category = resolveCategory(categories, type);
    if (!category) {
      setError('No categories configured');
      return;
    }
    setError('');
    try {
      await createTask.mutateAsync({
        projectId,
        title: title.trim(),
        categoryId: category.id,
        priority: type === 'bug' ? 'HIGH' : 'MEDIUM',
        sprintId,
        storyPoints: points === '' ? undefined : Number(points),
      });
      setTitle('');
      setPoints('');
      setType(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to create issue');
    }
  }

  if (!type) {
    return (
      <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1 }}>
        <ButtonGroup size="small" variant="text">
          <Button startIcon={<TaskAltOutlined fontSize="small" />} onClick={() => setType('task')}>
            Create task
          </Button>
          <Button startIcon={<BugReportOutlined fontSize="small" />} onClick={() => setType('bug')} color="error">
            Create bug
          </Button>
        </ButtonGroup>
      </Stack>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={(e) => void submit(e)}
      sx={{ px: 1.5, py: 1.25, bgcolor: '#FFFCF7', borderTop: '1px dashed #E7E0D6' }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Chip
          size="small"
          color={type === 'bug' ? 'error' : 'primary'}
          label={type === 'bug' ? 'Bug' : 'Task'}
          onDelete={() => {
            setType(null);
            setTitle('');
          }}
        />
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={type === 'bug' ? 'What is the bug?' : 'What needs to be done?'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setType(null);
              setTitle('');
            }
          }}
        />
        <TextField
          size="small"
          type="number"
          placeholder="Pts"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          sx={{ width: 80 }}
          inputProps={{ min: 0, max: 100 }}
        />
        <Button type="submit" variant="contained" size="small" disabled={!title.trim() || createTask.isPending}>
          Create
        </Button>
        <Button
          size="small"
          onClick={() => {
            setType(null);
            setTitle('');
          }}
        >
          Cancel
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

function SprintPanel({
  title,
  subtitle,
  containerId,
  sprint,
  taskIds,
  tasksById,
  projectId,
  categories,
  selected,
  onToggle,
  onOpen,
  onPointsChange,
  isOver,
  defaultOpen = true,
  actions,
}: {
  title: string;
  subtitle?: string;
  containerId: string;
  sprint: Sprint | null;
  taskIds: string[];
  tasksById: Record<string, Task>;
  projectId: string;
  categories: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onPointsChange: (taskId: string, points: number | null) => void;
  isOver: boolean;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  });
  const highlighted = isOver || isDroppableOver;
  const tasks = taskIds.map((id) => tasksById[id]).filter(Boolean);
  const done = tasks.filter((task) => task.status?.category === 'COMPLETED').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const points = sumPoints(tasks);
  const donePoints = sumPoints(tasks.filter((task) => task.status?.category === 'COMPLETED'));

  useEffect(() => {
    if (highlighted && !open) setOpen(true);
  }, [highlighted, open]);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: highlighted ? '#1F4E79' : '#E7E0D6',
        borderRadius: 2,
        bgcolor: '#FFFCF7',
        overflow: 'hidden',
        boxShadow: highlighted ? '0 0 0 2px rgba(31,78,121,0.15)' : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        spacing={1}
        sx={{
          px: 1.5,
          py: 1.25,
          bgcolor: sprint?.status === 'ACTIVE' ? '#F0F7F1' : '#F7F3EC',
          borderBottom: '1px solid #E7E0D6',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <IconButton size="small" onClick={() => setOpen((value) => !value)}>
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography fontWeight={800}>{title}</Typography>
              {sprint && (
                <Chip size="small" label={sprint.status} color={sprint.status === 'ACTIVE' ? 'success' : 'default'} />
              )}
              <Chip size="small" variant="outlined" label={`${tasks.length} issues`} sx={{ height: 22 }} />
              <Chip
                size="small"
                variant="outlined"
                label={`${donePoints}/${points} pts`}
                sx={{ height: 22, fontWeight: 700 }}
              />
            </Stack>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" display="block">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {actions && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {actions}
          </Stack>
        )}
      </Stack>

      {tasks.length > 0 && <LinearProgress variant="determinate" value={progress} sx={{ height: 3 }} />}

      <Collapse in={open}>
        <Box
          ref={setNodeRef}
          sx={{
            minHeight: 56,
            bgcolor: highlighted ? 'rgba(31,78,121,0.04)' : 'transparent',
          }}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {taskIds.map((taskId) => {
              const task = tasksById[taskId];
              if (!task) return null;
              return (
                <IssueRow
                  key={task.id}
                  task={task}
                  selected={selected.includes(task.id)}
                  onToggle={() => onToggle(task.id)}
                  onOpen={() => onOpen(task.id)}
                  onPointsChange={(value) => onPointsChange(task.id, value)}
                />
              );
            })}
          </SortableContext>
          {taskIds.length === 0 && (
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{
                px: 2,
                py: 2.5,
                borderBottom: '1px dashed',
                borderColor: highlighted ? '#1F4E79' : '#E7E0D6',
                textAlign: 'center',
              }}
            >
              Drop issues here
            </Typography>
          )}
          <QuickCreate projectId={projectId} sprintId={sprint?.id ?? null} categories={categories} />
        </Box>
      </Collapse>
    </Box>
  );
}

export function BacklogBoard({
  projectId,
  sprints,
  tasks,
  categories,
  selected,
  onToggle,
  onOpen,
  onPointsChange,
  renderSprintActions,
}: {
  projectId: string;
  sprints: Sprint[];
  tasks: Task[];
  categories: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onPointsChange: (taskId: string, points: number | null) => void;
  renderSprintActions?: (sprint: Sprint) => ReactNode;
}) {
  const moveTasks = useMoveTasksToSprint(projectId);
  const containerIds = useMemo(() => [...sprints.map((sprint) => sprint.id), BACKLOG_ID], [sprints]);

  const [items, setItems] = useState<ContainerItems>(() => buildContainerItems(containerIds, tasks));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overContainerId, setOverContainerId] = useState<string | null>(null);

  const itemsRef = useRef(items);
  const activeIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const clonedItems = useRef<ContainerItems | null>(null);
  const pendingDrop = useRef<{ taskId: string; sprintId: string | null; order: number } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (activeId) return;

    if (pendingDrop.current) {
      const { taskId, sprintId, order } = pendingDrop.current;
      const serverTask = tasks.find((task) => task.id === taskId);
      const serverContainer = serverTask ? containerIdForTask(serverTask) : null;
      const expected = sprintId ?? null;
      const actual = serverTask?.sprintId ?? null;
      if (serverTask && actual === expected && serverTask.order === order && serverContainer) {
        pendingDrop.current = null;
        setItems(buildContainerItems(containerIds, tasks));
      }
      return;
    }

    setItems(buildContainerItems(containerIds, tasks));
  }, [tasks, containerIds, activeId]);

  const tasksById = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const task of tasks) map[task.id] = task;
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasksById[String(activeId)] ?? null : null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const findContainer = useCallback((id: UniqueIdentifier) => {
    const value = String(id);
    if (value in itemsRef.current) return value;
    return Object.keys(itemsRef.current).find((key) => itemsRef.current[key].includes(value));
  }, []);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (activeIdRef.current && String(activeIdRef.current) in itemsRef.current) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          Object.keys(itemsRef.current).includes(String(container.id))
        ),
      });
    }

    const pointerIntersections = pointerWithin(args);
    const intersections = pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
    let overId = getFirstCollision(intersections, 'id');

    if (overId != null) {
      if (String(overId) in itemsRef.current) {
        const containerItems = itemsRef.current[String(overId)];
        if (containerItems.length > 0) {
          overId = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) => container.id !== overId && containerItems.includes(String(container.id))
            ),
          })[0]?.id;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMovedToNewContainer.current) {
      lastOverId.current = activeIdRef.current;
    }

    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveId(active.id);
      activeIdRef.current = active.id;
      clonedItems.current = structuredClone(itemsRef.current);
      setOverContainerId(findContainer(active.id) ?? null);
    },
    [findContainer]
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const overId = over?.id;
      if (overId == null || String(active.id) in itemsRef.current) return;

      const overContainer = findContainer(overId);
      const activeContainer = findContainer(active.id);
      if (!overContainer || !activeContainer) return;

      setOverContainerId(overContainer);
      if (activeContainer === overContainer) return;

      setItems((current) => {
        const activeItems = current[activeContainer] ?? [];
        const overItems = current[overContainer] ?? [];
        const activeIndex = activeItems.indexOf(String(active.id));
        if (activeIndex < 0) return current;

        const overIndex = overItems.indexOf(String(overId));
        let newIndex: number;
        if (String(overId) in current) {
          newIndex = overItems.length + 1;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
          newIndex = overIndex >= 0 ? overIndex + (isBelowOverItem ? 1 : 0) : overItems.length + 1;
        }

        recentlyMovedToNewContainer.current = true;
        return {
          ...current,
          [activeContainer]: activeItems.filter((id) => id !== String(active.id)),
          [overContainer]: [
            ...overItems.slice(0, newIndex),
            activeItems[activeIndex],
            ...overItems.slice(newIndex),
          ],
        };
      });
    },
    [findContainer]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const activeContainer = findContainer(active.id);

      if (!over || !activeContainer) {
        if (clonedItems.current) setItems(clonedItems.current);
        clonedItems.current = null;
        pendingDrop.current = null;
        setActiveId(null);
        activeIdRef.current = null;
        setOverContainerId(null);
        recentlyMovedToNewContainer.current = false;
        return;
      }

      const overContainer = findContainer(over.id) ?? activeContainer;
      const current = itemsRef.current;
      const activeItems = current[activeContainer] ?? [];
      const overItems = current[overContainer] ?? [];
      const activeIndex = activeItems.indexOf(String(active.id));
      const overIndex = overItems.indexOf(String(over.id));

      let nextItems = current;

      if (activeContainer === overContainer) {
        if (activeIndex !== overIndex && activeIndex >= 0 && overIndex >= 0) {
          nextItems = {
            ...current,
            [overContainer]: arrayMove(overItems, activeIndex, overIndex),
          };
        }
      } else if (activeIndex >= 0) {
        const movingId = activeItems[activeIndex];
        const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
        nextItems = {
          ...current,
          [activeContainer]: activeItems.filter((id) => id !== movingId),
          [overContainer]: [...overItems.slice(0, insertIndex), movingId, ...overItems.slice(insertIndex)],
        };
      }

      const destination = nextItems[overContainer] ?? [];
      const finalIndex = destination.indexOf(String(active.id));
      const original = tasks.find((task) => task.id === String(active.id));
      const rollbackItems = clonedItems.current;
      const targetSprintId = sprintIdFromContainer(overContainer);

      itemsRef.current = nextItems;
      setItems(nextItems);
      clonedItems.current = null;
      recentlyMovedToNewContainer.current = false;
      setOverContainerId(null);
      setActiveId(null);
      activeIdRef.current = null;

      if (!original || finalIndex < 0) return;

      const unchanged =
        (original.sprintId ?? null) === targetSprintId && original.order === finalIndex;
      if (unchanged) return;

      pendingDrop.current = {
        taskId: String(active.id),
        sprintId: targetSprintId,
        order: finalIndex,
      };

      void moveTasks
        .mutateAsync({
          taskIds: [String(active.id)],
          sprintId: targetSprintId,
          order: finalIndex,
        })
        .catch(() => {
          if (rollbackItems) {
            setItems(rollbackItems);
            itemsRef.current = rollbackItems;
          }
          pendingDrop.current = null;
        });
    },
    [findContainer, moveTasks, tasks]
  );

  const handleDragCancel = useCallback(() => {
    if (clonedItems.current) setItems(clonedItems.current);
    pendingDrop.current = null;
    setActiveId(null);
    activeIdRef.current = null;
    setOverContainerId(null);
    clonedItems.current = null;
    recentlyMovedToNewContainer.current = false;
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Stack spacing={1.5}>
        {sprints.map((sprint) => {
          const dateLabel =
            sprint.startDate || sprint.endDate
              ? `${sprint.startDate ? format(new Date(sprint.startDate), 'MMM d') : '—'} → ${
                  sprint.endDate ? format(new Date(sprint.endDate), 'MMM d, yyyy') : '—'
                }`
              : sprint.goal || undefined;

          return (
            <SprintPanel
              key={sprint.id}
              title={sprint.name}
              subtitle={dateLabel}
              containerId={sprint.id}
              sprint={sprint}
              taskIds={items[sprint.id] ?? []}
              tasksById={tasksById}
              projectId={projectId}
              categories={categories}
              selected={selected}
              onToggle={onToggle}
              onOpen={onOpen}
              onPointsChange={onPointsChange}
              isOver={overContainerId === sprint.id}
              defaultOpen={sprint.status === 'ACTIVE' || (items[sprint.id] ?? []).length > 0}
              actions={renderSprintActions?.(sprint)}
            />
          );
        })}

        <SprintPanel
          title="Backlog"
          subtitle="Issues not assigned to a sprint — drag into a sprint to plan"
          containerId={BACKLOG_ID}
          sprint={null}
          taskIds={items[BACKLOG_ID] ?? []}
          tasksById={tasksById}
          projectId={projectId}
          categories={categories}
          selected={selected}
          onToggle={onToggle}
          onOpen={onOpen}
          onPointsChange={onPointsChange}
          isOver={overContainerId === BACKLOG_ID}
          defaultOpen
        />
      </Stack>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activeTask ? (
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: '#FFFCF7',
                  border: '1px solid #1F4E79',
                  borderRadius: 1.5,
                  boxShadow: '0 12px 28px rgba(23,50,77,0.22)',
                  minWidth: 280,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {activeTask.key ?? 'Issue'}
                </Typography>
                <Typography fontWeight={700}>{activeTask.title}</Typography>
              </Box>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
