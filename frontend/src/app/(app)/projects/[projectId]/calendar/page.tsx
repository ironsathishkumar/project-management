'use client';

import { TaskDrawer } from '@/components/task/TaskDrawer';
import { useTasks } from '@/hooks/useApi';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { addDays, endOfMonth, format, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function ProjectCalendarPage() {
  const params = useParams<{ projectId: string }>();
  const tasks = useTasks({ projectId: params.projectId });
  const [taskId, setTaskId] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(new Date()));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">{format(new Date(), 'MMMM yyyy')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {days.map((day) => {
          const dayTasks = (tasks.data ?? []).filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), day));
          const inMonth = day.getMonth() === new Date().getMonth() || day <= endOfMonth(new Date());
          return (
            <Paper key={day.toISOString()} sx={{ minHeight: 110, p: 1, opacity: inMonth ? 1 : 0.55 }}>
              <Typography variant="caption">{format(day, 'd')}</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {dayTasks.map((task) => (
                  <Box
                    key={task.id}
                    onClick={() => setTaskId(task.id)}
                    sx={{ bgcolor: '#1F4E79', color: 'white', px: 0.75, py: 0.25, borderRadius: 1, cursor: 'pointer', fontSize: 12 }}
                  >
                    {task.title}
                  </Box>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Box>
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
    </Stack>
  );
}
