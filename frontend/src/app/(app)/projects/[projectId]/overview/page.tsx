'use client';

import { useProject, useTasks } from '@/hooks/useApi';
import { Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const tasks = useTasks({ projectId: params.projectId });

  const progress = useMemo(() => {
    const list = tasks.data ?? [];
    const total = list.length;
    const completed = list.filter((task) => task.status?.category === 'COMPLETED').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress: pct };
  }, [tasks.data]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6">Progress</Typography>
          <Typography variant="h3" sx={{ mt: 1 }}>
            {progress.progress}%
          </Typography>
          <LinearProgress variant="determinate" value={progress.progress} sx={{ mt: 2, height: 10, borderRadius: 99 }} />
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {progress.completed} of {progress.total} tasks complete
          </Typography>
        </CardContent>
      </Card>
      <Typography color="text.secondary">{project.data?.description}</Typography>
    </Stack>
  );
}
