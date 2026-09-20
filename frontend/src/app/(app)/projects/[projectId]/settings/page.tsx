'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { useProject } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function ProjectSettingsContent() {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' });

  useEffect(() => {
    if (!project.data) return;
    setForm({
      name: project.data.name,
      description: project.data.description ?? '',
      status: project.data.status,
    });
  }, [project.data]);

  async function save() {
    await api(`/projects/${params.projectId}`, { method: 'PATCH', body: JSON.stringify(form) });
    void project.refetch();
  }

  async function archive() {
    await api(`/projects/${params.projectId}/archive`, { method: 'POST' });
    void project.refetch();
  }

  return (
    <Card sx={{ m: { xs: 2, md: 3 } }}>
      <CardContent>
        <Typography variant="h6">Project settings</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Admin-only · update project details or archive.
        </Typography>
        <Stack spacing={2} sx={{ mt: 2, maxWidth: 560 }}>
          <TextField
            label="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            multiline
            minRows={3}
          />
          <TextField
            select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {['ACTIVE', 'ON_HOLD', 'COMPLETED'].map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => void save()}>
              Save
            </Button>
            <Button color="warning" onClick={() => void archive()}>
              Archive
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ProjectSettingsPage() {
  return (
    <RequireAdmin fallbackHref="/projects">
      <ProjectSettingsContent />
    </RequireAdmin>
  );
}
