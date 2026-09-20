'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { useCategories, useMembers, useWorkflows } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

function SettingsContent() {
  const { workspace } = useAuth();
  const members = useMembers();
  const workflows = useWorkflows();
  const categories = useCategories();
  const [tab, setTab] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [statusForm, setStatusForm] = useState({ workflowId: '', name: '', category: 'IN_PROGRESS' });

  async function addCategory() {
    if (!categoryName.trim()) return;
    await api('/categories', { method: 'POST', body: JSON.stringify({ name: categoryName.trim() }) });
    setCategoryName('');
    void categories.refetch();
  }

  async function addStatus() {
    if (!statusForm.workflowId || !statusForm.name) return;
    await api(`/workflows/${statusForm.workflowId}/statuses`, {
      method: 'POST',
      body: JSON.stringify({ name: statusForm.name, category: statusForm.category }),
    });
    setStatusForm({ ...statusForm, name: '' });
    void workflows.refetch();
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Workspace settings</Typography>
        <Typography color="text.secondary">
          Admin-only · members, workflows, and categories for {workspace?.name}.
        </Typography>
      </div>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
        <Tab label="Members" />
        <Tab label="Workflows" />
        <Tab label="Categories" />
      </Tabs>
      {tab === 0 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Button component={Link} href="/users" variant="outlined">
                Open user management
              </Button>
              {(members.data ?? []).map((member) => (
                <Stack
                  key={member.id}
                  direction="row"
                  justifyContent="space-between"
                  sx={{ borderBottom: '1px solid #E7E0D6', py: 1.25 }}
                >
                  <Box>
                    <Typography>
                      {member.user ? `${member.user.firstName} ${member.user.lastName}` : member.userId}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {member.user?.email}
                    </Typography>
                  </Box>
                  <Chip label={member.role?.name ?? member.status} size="small" />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  select
                  label="Workflow"
                  value={statusForm.workflowId}
                  onChange={(event) => setStatusForm({ ...statusForm, workflowId: event.target.value })}
                  sx={{ minWidth: 220 }}
                >
                  {(workflows.data ?? []).map((workflow) => (
                    <MenuItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Status name"
                  value={statusForm.name}
                  onChange={(event) => setStatusForm({ ...statusForm, name: event.target.value })}
                />
                <TextField
                  select
                  label="Category"
                  value={statusForm.category}
                  onChange={(event) => setStatusForm({ ...statusForm, category: event.target.value })}
                >
                  {['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="contained" onClick={() => void addStatus()}>
                  Add status
                </Button>
              </Stack>
            </CardContent>
          </Card>
          {(workflows.data ?? []).map((workflow) => (
            <Card key={workflow.id}>
              <CardContent>
                <Typography variant="h6">{workflow.name}</Typography>
                <Typography color="text.secondary">{workflow.description}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  {workflow.statuses.map((status) => (
                    <Chip
                      key={status.id}
                      label={`${status.name} · ${status.category}`}
                      sx={{ bgcolor: `${status.color}22` }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="New category"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                fullWidth
              />
              <Button variant="contained" onClick={() => void addCategory()}>
                Add
              </Button>
            </Stack>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(categories.data ?? []).map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  sx={{ bgcolor: `${category.color}22`, color: category.color }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default function SettingsPage() {
  return (
    <RequireAdmin>
      <SettingsContent />
    </RequireAdmin>
  );
}
