'use client';

import { Status, Task } from '@/types';
import { TaskCard } from '@/components/task/TaskCard';
import { useMoveTask } from '@/hooks/useApi';
import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  getFirstCollision,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ColumnItems = Record<string, string[]>;

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

function buildColumnItems(statuses: Status[], tasks: Task[]): ColumnItems {
  const next: ColumnItems = {};
  for (const status of statuses) {
    next[status.id] = [];
  }

  const sorted = [...tasks].sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)
  );

  for (const task of sorted) {
    if (!next[task.statusId]) {
      next[task.statusId] = [];
    }
    next[task.statusId].push(task.id);
  }

  return next;
}

function SortableTaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const suppressClick = useRef(false);

  useEffect(() => {
    if (isDragging) {
      suppressClick.current = true;
    }
  }, [isDragging]);

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        visibility: isDragging ? 'hidden' : 'visible',
      }}
      sx={{
        touchAction: 'none',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
      }}
      {...attributes}
      {...listeners}
      onClick={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
          return;
        }
        onOpen(task.id);
      }}
    >
      <TaskCard task={task} onOpen={onOpen} disableOpen />
    </Box>
  );
}

function BoardColumn({
  status,
  taskIds,
  tasksById,
  onOpen,
  isOver,
}: {
  status: Status;
  taskIds: string[];
  tasksById: Record<string, Task>;
  onOpen: (id: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: status.id,
    data: { type: 'column', statusId: status.id },
  });

  const highlighted = isOver || isDroppableOver;

  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 280,
        width: 280,
        height: '100%',
        p: 1.5,
        bgcolor: highlighted ? '#EAF1F8' : '#F8F4EC',
        border: '1px solid',
        borderColor: highlighted ? '#1F4E79' : '#E7E0D6',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 150ms ease, border-color 150ms ease',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: status.color }} />
          <Typography fontWeight={800}>{status.name}</Typography>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {taskIds.length}
        </Typography>
      </Stack>

      <Box
        ref={setNodeRef}
        sx={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 120,
          pr: 0.5,
        }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              minHeight: '100%',
            }}
          >
            {taskIds.map((taskId) => {
              const task = tasksById[taskId];
              if (!task) return null;
              return <SortableTaskCard key={taskId} task={task} onOpen={onOpen} />;
            })}

            {taskIds.length === 0 && (
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: highlighted ? '#1F4E79' : '#C4BAAE',
                  borderRadius: 2,
                  py: 5,
                  textAlign: 'center',
                  color: 'text.secondary',
                  fontSize: 13,
                  bgcolor: highlighted ? 'rgba(31, 78, 121, 0.04)' : 'transparent',
                }}
              >
                Drop here
              </Box>
            )}
          </Box>
        </SortableContext>
      </Box>
    </Paper>
  );
}

export function KanbanBoard({
  statuses,
  tasks,
  onOpen,
}: {
  statuses: Status[];
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const moveTask = useMoveTask();
  const [items, setItems] = useState<ColumnItems>(() => buildColumnItems(statuses, tasks));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const itemsRef = useRef(items);
  const activeIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const clonedItems = useRef<ColumnItems | null>(null);
  const pendingDrop = useRef<{ taskId: string; statusId: string; order: number } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (activeId) return;

    // After a successful drop, keep local board state until server/cache catches up.
    // Otherwise clearing activeId immediately rebuilds from stale tasks and snaps back.
    if (pendingDrop.current) {
      const { taskId, statusId, order } = pendingDrop.current;
      const serverTask = tasks.find((task) => task.id === taskId);
      if (serverTask && serverTask.statusId === statusId && serverTask.order === order) {
        pendingDrop.current = null;
        setItems(buildColumnItems(statuses, tasks));
      }
      return;
    }

    setItems(buildColumnItems(statuses, tasks));
  }, [statuses, tasks, activeId]);

  const tasksById = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const task of tasks) {
      map[task.id] = task;
    }
    // Keep in-drag copies for tasks already moved between columns in local state
    for (const list of Object.values(items)) {
      for (const id of list) {
        if (!map[id]) {
          const existing = tasks.find((task) => task.id === id);
          if (existing) map[id] = existing;
        }
      }
    }
    return map;
  }, [tasks, items]);

  const activeTask = activeId ? tasksById[String(activeId)] ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const findContainer = useCallback((id: UniqueIdentifier) => {
    const value = String(id);
    if (value in itemsRef.current) {
      return value;
    }
    return Object.keys(itemsRef.current).find((key) => itemsRef.current[key].includes(value));
  }, []);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (activeIdRef.current && String(activeIdRef.current) in itemsRef.current) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) =>
            Object.keys(itemsRef.current).includes(String(container.id))
          ),
        });
      }

      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);

      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        if (String(overId) in itemsRef.current) {
          const containerItems = itemsRef.current[String(overId)];

          if (containerItems.length > 0) {
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  container.id !== overId && containerItems.includes(String(container.id))
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
    },
    []
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveId(active.id);
      activeIdRef.current = active.id;
      clonedItems.current = structuredClone(itemsRef.current);
      const container = findContainer(active.id);
      setOverColumnId(container ?? null);
    },
    [findContainer]
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const overId = over?.id;
      if (overId == null || String(active.id) in itemsRef.current) {
        return;
      }

      const overContainer = findContainer(overId);
      const activeContainer = findContainer(active.id);

      if (!overContainer || !activeContainer) {
        return;
      }

      setOverColumnId(overContainer);

      if (activeContainer === overContainer) {
        return;
      }

      setItems((current) => {
        const activeItems = current[activeContainer];
        const overItems = current[overContainer];
        const overIndex = overItems.indexOf(String(overId));
        const activeIndex = activeItems.indexOf(String(active.id));

        if (activeIndex < 0) {
          return current;
        }

        let newIndex: number;
        if (String(overId) in current) {
          newIndex = overItems.length + 1;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height / 2;

          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
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
        if (clonedItems.current) {
          setItems(clonedItems.current);
        }
        clonedItems.current = null;
        pendingDrop.current = null;
        setActiveId(null);
        activeIdRef.current = null;
        setOverColumnId(null);
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
          [overContainer]: [
            ...overItems.slice(0, insertIndex),
            movingId,
            ...overItems.slice(insertIndex),
          ],
        };
      }

      const destination = nextItems[overContainer] ?? [];
      const finalIndex = destination.indexOf(String(active.id));
      const original = tasks.find((task) => task.id === String(active.id));
      const rollbackItems = clonedItems.current;

      itemsRef.current = nextItems;
      setItems(nextItems);
      clonedItems.current = null;
      recentlyMovedToNewContainer.current = false;
      setOverColumnId(null);

      if (!original || finalIndex < 0) {
        setActiveId(null);
        activeIdRef.current = null;
        return;
      }

      if (original.statusId === overContainer && original.order === finalIndex) {
        setActiveId(null);
        activeIdRef.current = null;
        return;
      }

      pendingDrop.current = {
        taskId: String(active.id),
        statusId: overContainer,
        order: finalIndex,
      };

      // Clear drag state only after local drop position is committed.
      setActiveId(null);
      activeIdRef.current = null;

      void moveTask
        .mutateAsync({
          taskId: String(active.id),
          statusId: overContainer,
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
    [findContainer, moveTask, tasks]
  );

  const handleDragCancel = useCallback(() => {
    if (clonedItems.current) {
      setItems(clonedItems.current);
    }
    pendingDrop.current = null;
    setActiveId(null);
    activeIdRef.current = null;
    setOverColumnId(null);
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
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box sx={{ height: '100%', minHeight: 0, overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ height: '100%', alignItems: 'stretch', minWidth: 'max-content' }}>
          {statuses.map((status) => (
            <BoardColumn
              key={status.id}
              status={status}
              taskIds={items[status.id] ?? []}
              tasksById={tasksById}
              onOpen={onOpen}
              isOver={overColumnId === status.id}
            />
          ))}
        </Stack>
      </Box>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
            {activeTask ? (
              <Box
                sx={{
                  width: 252,
                  borderRadius: 2,
                  boxShadow: '0 16px 40px rgba(28, 25, 23, 0.22)',
                  cursor: 'grabbing',
                  transform: 'rotate(1deg)',
                }}
              >
                <TaskCard task={activeTask} onOpen={() => undefined} dragging disableOpen />
              </Box>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
