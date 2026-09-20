'use client';

import { Task } from '@/types';
import { CheckRounded } from '@mui/icons-material';
import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';

const PRIORITY_COLOR: Record<string, 'default' | 'warning' | 'error' | 'info'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

export function TaskCard({
  task,
  onOpen,
  dragging = false,
  disableOpen = false,
}: {
  task: Task;
  onOpen: (id: string) => void;
  dragging?: boolean;
  disableOpen?: boolean;
}) {
  const subtasks = task.subtasks ?? [];
  const subtaskTotal = task.subtaskCount ?? subtasks.length;
  const subtaskDone =
    task.subtaskDoneCount ?? subtasks.filter((item) => item.status?.category === 'COMPLETED').length;

  return (
    <Stack
      spacing={1}
      onClick={() => {
        if (!dragging && !disableOpen) onOpen(task.id);
      }}
      sx={{
        p: 1.5,
        bgcolor: '#FFFCF7',
        border: '1px solid',
        borderColor: dragging ? '#1F4E79' : '#E7E0D6',
        borderRadius: 2,
        cursor: dragging ? 'grabbing' : 'pointer',
        boxShadow: dragging ? '0 8px 20px rgba(28, 25, 23, 0.12)' : 'none',
        userSelect: 'none',
        pointerEvents: dragging ? 'none' : 'auto',
        transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
        '&:hover':
          disableOpen || dragging
            ? undefined
            : {
                borderColor: '#1F4E79',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 18px rgba(28, 25, 23, 0.08)',
              },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {task.category && (
          <Chip
            size="small"
            label={task.category.name}
            sx={{ bgcolor: `${task.category.color}22`, color: task.category.color, fontWeight: 700 }}
          />
        )}
        <Chip size="small" label={task.priority} color={PRIORITY_COLOR[task.priority]} />
      </Stack>
      {task.key && (
        <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.3}>
          {task.key}
          {task.storyPoints != null ? ` · ${task.storyPoints} pts` : ''}
        </Typography>
      )}
      <Typography fontWeight={700}>{task.title}</Typography>

      {subtaskTotal > 0 && (
        <Box sx={{ height: 4, borderRadius: 99, bgcolor: '#E7E0D6', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${Math.round((subtaskDone / Math.max(subtaskTotal, 1)) * 100)}%`,
              bgcolor: '#16A34A',
              transition: 'width 200ms ease',
            }}
          />
        </Box>
      )}

      {subtasks.length > 0 && (
        <Box
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          sx={{
            mt: 0.25,
            pt: 1,
            borderTop: '1px solid #EDE6DB',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary" letterSpacing={0.4}>
              Sub-tasks
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {subtaskDone}/{subtaskTotal}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            {subtasks.map((subtask) => {
              const done = subtask.status?.category === 'COMPLETED';
              return (
                <Stack
                  key={subtask.id}
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!dragging) onOpen(subtask.id);
                  }}
                  sx={{
                    px: 0.75,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: '#FFFEFB',
                    border: '1px solid #EDE6DB',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#1F4E79', bgcolor: '#F7FBFF' },
                  }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: done ? '#16A34A' : subtask.status?.color ?? '#D9D0C4',
                      color: '#fff',
                    }}
                  >
                    {done ? <CheckRounded sx={{ fontSize: 11 }} /> : null}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{ display: 'block', lineHeight: 1.2 }}
                    >
                      {subtask.key}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      sx={{
                        textDecoration: done ? 'line-through' : 'none',
                        opacity: done ? 0.65 : 1,
                        lineHeight: 1.25,
                      }}
                    >
                      {subtask.title}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    noWrap
                    sx={{
                      flexShrink: 0,
                      maxWidth: 72,
                      color: subtask.status?.color ?? 'text.secondary',
                    }}
                  >
                    {subtask.status?.name ?? '—'}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={0.75} alignItems="center">
          {task.assignee ? (
            <>
              <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: 'primary.main' }}>
                {task.assignee.firstName[0]}
                {task.assignee.lastName[0]}
              </Avatar>
              <Typography variant="caption" color="text.secondary">
                {task.assignee.firstName}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Unassigned
            </Typography>
          )}
        </Stack>
        {task.dueDate && (
          <Typography variant="caption" color="text.secondary">
            {format(new Date(task.dueDate), 'MMM d')}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
