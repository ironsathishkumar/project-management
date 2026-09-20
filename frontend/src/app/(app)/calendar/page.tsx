'use client';

import { TaskDrawer } from '@/components/task/TaskDrawer';
import { useProjects, useTasks } from '@/hooks/useApi';
import { isWorkspaceAdmin } from '@/lib/permissions';
import { getLastProjectId } from '@/lib/projectPreference';
import { useAuth } from '@/providers/AuthProvider';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { addDays, format, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function CalendarPage() {
  const { user, workspace } = useAuth();
  const router = useRouter();
  const projects = useProjects();
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);
  const tasks = useTasks({});
  const [taskId, setTaskId] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(new Date()));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, []);

  useEffect(() => {
    if (isAdmin || !workspace?.id || !projects.data?.length) return;
    const stored = getLastProjectId(workspace.id);
    const target =
      (stored && projects.data.some((project) => project.id === stored) ? stored : null) ??
      projects.data[0].id;
    router.replace(`/projects/${target}/calendar`);
  }, [isAdmin, workspace?.id, projects.data, router]);

  if (!isAdmin) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">Opening project calendar...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h4">Calendar</Typography>
        <Typography color="text.secondary">Tasks by due date across the workspace.</Typography>
      </div>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <Typography key={label} variant="caption" fontWeight={700}>
            {label}
          </Typography>
        ))}
        {days.map((day) => {
          const dayTasks = (tasks.data ?? []).filter(
            (task) => task.dueDate && isSameDay(new Date(task.dueDate), day)
          );
          return (
            <Paper key={day.toISOString()} sx={{ minHeight: 120, p: 1 }}>
              <Typography variant="caption">{format(day, 'MMM d')}</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                {dayTasks.map((task) => (
                  <Box
                    key={task.id}
                    onClick={() => setTaskId(task.id)}
                    sx={{
                      bgcolor: '#0F766E',
                      color: 'white',
                      px: 0.75,
                      py: 0.4,
                      borderRadius: 1,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
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
