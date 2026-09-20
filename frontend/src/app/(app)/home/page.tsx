'use client';

import { useProjects, useReports, useTasks } from '@/hooks/useApi';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';
import { isWorkspaceAdmin } from '@/lib/permissions';
import { getLastProjectId } from '@/lib/projectPreference';
import { CreateTaskDialog } from '@/components/task/TaskDrawer';
import { Box, Button, Card, CardContent, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function HomePage() {
  const { user, workspace, workspaces } = useAuth();
  const router = useRouter();
  const projects = useProjects();
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);
  const reports = useReports(isAdmin);
  const myTasks = useTasks({ assigneeId: user?.id });
  const [open, setOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const overdue = useMemo(
    () =>
      (myTasks.data ?? []).filter(
        (task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status?.category !== 'COMPLETED'
      ),
    [myTasks.data]
  );

  useEffect(() => {
    if (!user || isAdmin || !workspace?.id || !projects.data) return;
    const list = projects.data;
    if (!list.length) {
      router.replace('/projects');
      return;
    }
    const stored = getLastProjectId(workspace.id);
    const target =
      (stored && list.some((project) => project.id === stored) ? stored : null) ?? list[0].id;
    router.replace(`/projects/${target}/board`);
  }, [user, isAdmin, workspace?.id, projects.data, router]);

  async function createWorkspace() {
    if (!workspaceName.trim()) return;
    const created = await api<{ id: string }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: workspaceName.trim() }),
    });
    localStorage.setItem('workspaceId', created.id);
    window.location.reload();
  }

  if (!workspaces.length) {
    return (
      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Typography variant="h4">Create your first workspace</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            A workspace holds projects, workflows, categories, and your team.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              label="Workspace name"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
            <Button variant="contained" onClick={() => void createWorkspace()}>
              Create
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">Opening your project...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Good to see you, {user?.firstName}</Typography>
          <Typography color="text.secondary">{workspace?.name} · admin overview</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/users" variant="outlined">
            Manage users
          </Button>
          <Button variant="contained" onClick={() => setOpen(true)}>
            New task
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        {[
          ['Projects', reports.data?.totals.projects ?? 0],
          ['Open tasks', reports.data?.totals.tasks ?? 0],
          ['Completed', reports.data?.totals.completed ?? 0],
          ['Overdue', reports.data?.totals.overdue ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent>
              <Typography color="text.secondary">{label}</Typography>
              <Typography variant="h3">{value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' }, gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6">Project progress</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              {(reports.data?.projectProgress ?? []).map((project) => (
                <Box key={project.projectId}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>{project.name}</Typography>
                    <Typography variant="body2">{project.progress}%</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={project.progress}
                    sx={{ mt: 1, height: 8, borderRadius: 99 }}
                  />
                </Box>
              ))}
              {!reports.data?.projectProgress.length && (
                <Typography color="text.secondary">No projects yet.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">My work</Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {(myTasks.data ?? []).slice(0, 6).map((task) => (
                <Box key={task.id} sx={{ p: 1.25, border: '1px solid #E7E0D6', borderRadius: 2 }}>
                  <Typography fontWeight={700}>{task.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.status?.name} ·{' '}
                    {task.updatedAt ? formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true }) : ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Projects</Typography>
            <Button component={Link} href="/projects">
              Manage projects
            </Button>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mt: 2 }}>
            {(projects.data ?? []).map((project) => (
              <Box
                key={project.id}
                component={Link}
                href={`/projects/${project.id}/board`}
                sx={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Box sx={{ p: 2, border: '1px solid #E7E0D6', borderRadius: 2, bgcolor: '#FFFCF7' }}>
                  <Typography variant="overline">{project.key}</Typography>
                  <Typography variant="h6">{project.name}</Typography>
                  <Typography color="text.secondary">{project.description || 'No description'}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
      {overdue.length > 0 && (
        <Typography color="warning.main">{overdue.length} of your tasks are overdue.</Typography>
      )}
      <CreateTaskDialog open={open} onClose={() => setOpen(false)} />
    </Stack>
  );
}
