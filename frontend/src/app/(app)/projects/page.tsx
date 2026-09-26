'use client';

import { useProjects, useWorkflows } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { isWorkspaceAdmin } from '@/lib/permissions';
import { setLastProjectId } from '@/lib/projectPreference';
import { useAuth } from '@/providers/AuthProvider';
import { Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

export default function ProjectsPage() {
  const { user, workspace } = useAuth();
  const projects = useProjects();
  const workflows = useWorkflows();
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', description: '', workflowId: '' });

  async function createProject() {
    await api('/projects', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        workflowId: form.workflowId || undefined,
        key: form.key || undefined,
      }),
    });
    setOpen(false);
    setForm({ name: '', key: '', description: '', workflowId: '' });
    void projects.refetch();
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between">
        <Box>
          <Typography variant="h4">{isAdmin ? 'Projects' : 'My projects'}</Typography>
          <Typography color="text.secondary">
            {isAdmin
              ? 'Create and manage workspace projects.'
              : 'Projects assigned to you — open board, backlog, list, or calendar.'}
          </Typography>
        </Box>
        {isAdmin && (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Button variant="outlined" component={Link} href="/projects/import">
              Import from document
            </Button>
            <Button variant="contained" onClick={() => setOpen(true)}>
              New project
            </Button>
          </Stack>
        )}
      </Stack>
      {open && isAdmin && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <TextField label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <TextField
                label="Key"
                value={form.key}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
                helperText="Short code, e.g. PTR"
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <TextField
                select
                label="Workflow"
                value={form.workflowId}
                onChange={(event) => setForm({ ...form, workflowId: event.target.value })}
              >
                <MenuItem value="">Default workflow</MenuItem>
                {(workflows.data ?? []).map((workflow) => (
                  <MenuItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void createProject()} disabled={!form.name}>
                  Create
                </Button>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {(projects.data ?? []).map((project) => (
          <Card
            key={project.id}
            component={Link}
            href={`/projects/${project.id}/board`}
            onClick={() => {
              if (workspace?.id) setLastProjectId(workspace.id, project.id);
            }}
            sx={{ textDecoration: 'none' }}
          >
            <CardContent>
              <Typography variant="overline">{project.key}</Typography>
              <Typography variant="h6">{project.name}</Typography>
              <Typography color="text.secondary">{project.description || 'No description yet'}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
