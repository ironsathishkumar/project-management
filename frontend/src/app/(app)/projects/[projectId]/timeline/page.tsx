'use client';

import { TaskDrawer } from '@/components/task/TaskDrawer';
import { useTasks } from '@/hooks/useApi';
import { Box, Stack, Typography } from '@mui/material';
import { addDays, differenceInDays, format, startOfDay } from 'date-fns';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function TimelinePage() {
  const params = useParams<{ projectId: string }>();
  const tasks = useTasks({ projectId: params.projectId });
  const [taskId, setTaskId] = useState<string | null>(null);
  const start = startOfDay(new Date());
  const days = 30;

  const items = useMemo(() => {
    return (tasks.data ?? []).map((task) => {
      const from = task.startDate ? new Date(task.startDate) : task.createdAt ? new Date(task.createdAt) : start;
      const to = task.dueDate ? new Date(task.dueDate) : addDays(from, 3);
      const left = Math.max(0, differenceInDays(from, start));
      const width = Math.max(1, differenceInDays(to, from) + 1);
      return { task, left, width };
    });
  }, [start, tasks.data]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Next {days} days</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: days * 28 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${days}, 28px)`, mb: 1 }}>
            {Array.from({ length: days }, (_, index) => (
              <Typography key={index} variant="caption" sx={{ width: 28 }}>
                {format(addDays(start, index), 'd')}
              </Typography>
            ))}
          </Box>
          <Stack spacing={1}>
            {items.map(({ task, left, width }) => (
              <Box key={task.id} sx={{ position: 'relative', height: 36 }}>
                <Box
                  onClick={() => setTaskId(task.id)}
                  sx={{
                    position: 'absolute',
                    left: left * 28,
                    width: width * 28,
                    bgcolor: task.status?.color ?? '#1F4E79',
                    color: 'white',
                    borderRadius: 1,
                    px: 1,
                    py: 0.75,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 13,
                  }}
                >
                  {task.title}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
    </Stack>
  );
}
