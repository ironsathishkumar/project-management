'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import {
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrationActivity,
  useIntegrations,
  useProjects,
  useRotateIntegration,
  useUpdateIntegration,
} from '@/hooks/useApi';
import { API_URL } from '@/lib/api';
import { CopyBlock } from '@/components/integrations/CopyBlock';
import { GithubSummary } from '@/components/integrations/GithubPanel';
import type { Integration, IntegrationWithKey } from '@/types';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const ACTIVITY_LABEL: Record<string, string> = {
  TASK_CREATED: 'Created task',
  TASK_STATUS_CHANGED: 'Changed status',
  TASK_UPDATED: 'Updated task',
  COMMENT_CREATED: 'Commented',
  DOCUMENT_IMPORTED: 'Synced document',
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function snippets(apiKey: string, projectKey = 'KEY') {
  return {
    env: `PM_API_URL=${API_URL}\nPM_API_KEY=${apiKey}`,
    cli: `node tools/pm-sync.mjs me\nnode tools/pm-sync.mjs status ${projectKey}-4 done -m "Deployed to staging"\nnode tools/pm-sync.mjs upsert auth-login "Login with OTP" --section Authentication --status in_progress\nnode tools/pm-sync.mjs doc docs/implementation.md`,
    curl: `curl -X PATCH ${API_URL}/app/tasks/${projectKey}-4 \\\n  -H "x-api-key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"done","comment":"Deployed to staging"}'`,
    upsert: `curl -X POST ${API_URL}/app/tasks \\\n  -H "x-api-key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"externalKey":"auth-login","title":"Login with OTP","section":"Authentication","status":"in_progress"}'`,
  };
}

function KeyDialog({ value, onClose }: { value: IntegrationWithKey | null; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  if (!value) return null;
  const code = snippets(value.apiKey, value.integration.project?.key);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>API key for {value.integration.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning">Copy this key now. For security it is stored hashed and won’t be shown again.</Alert>
          <CopyBlock value={value.apiKey} label="API key" />
          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            Quick start
          </Typography>
          <Tabs value={tab} onChange={(_, next: number) => setTab(next)} sx={{ minHeight: 36 }}>
            <Tab label="CLI" sx={{ minHeight: 36 }} />
            <Tab label="curl" sx={{ minHeight: 36 }} />
          </Tabs>
          {tab === 0 ? (
            <Stack spacing={1.5}>
              <CopyBlock value={code.env} label="1. Add to the app’s .env or CI secrets" />
              <CopyBlock value={code.cli} label="2. Push updates (tools/pm-sync.mjs from this repo, Node 18+)" />
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <CopyBlock value={code.curl} label="Move a task by its key" />
              <CopyBlock value={code.upsert} label="Create or update a task by your own id (externalKey)" />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          I’ve copied the key
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ActivityList({ integrationId }: { integrationId: string }) {
  const activity = useIntegrationActivity(integrationId);
  if (activity.isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    );
  }
  if (!activity.data?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No activity yet. Updates pushed with this key will appear here.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5}>
      {activity.data.map((item) => (
        <Stack key={item.id} direction="row" spacing={1.5} alignItems="baseline">
          <Typography variant="body2" sx={{ minWidth: 130 }}>
            {ACTIVITY_LABEL[item.action] ?? item.action}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>
            {item.task
              ? `${item.task.key ? `${item.task.key} · ` : ''}${item.task.title}${item.toStatus ? ` → ${item.toStatus}` : ''}`
              : typeof item.metadata?.fileName === 'string'
                ? item.metadata.fileName
                : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function IntegrationRow({
  item,
  onKey,
}: {
  item: Integration;
  onKey: (value: IntegrationWithKey) => void;
}) {
  const update = useUpdateIntegration();
  const rotate = useRotateIntegration();
  const remove = useDeleteIntegration();
  const [showActivity, setShowActivity] = useState(false);
  const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null);
  const active = item.status === 'ACTIVE';
  const error = update.error ?? rotate.error ?? remove.error;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">{item.name}</Typography>
              <Chip size="small" label={active ? 'Active' : 'Revoked'} color={active ? 'success' : 'default'} />
            </Stack>
            <Typography color="text.secondary">
              {item.project ? (
                <Link href={`/projects/${item.project.id}/backlog`}>
                  {item.project.key} · {item.project.name}
                </Link>
              ) : (
                'Project removed'
              )}
              {item.description ? ` — ${item.description}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Key <code>{item.keyPrefix}…</code> ·{' '}
              {item.lastUsedAt
                ? `last used ${formatDistanceToNow(new Date(item.lastUsedAt), { addSuffix: true })} · ${item.requestCount} requests`
                : 'never used'}
              {item.createdBy ? ` · created by ${item.createdBy.name}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <Button size="small" onClick={() => setShowActivity((value) => !value)}>
              {showActivity ? 'Hide activity' : 'Activity'}
            </Button>
            <Button size="small" onClick={() => setConfirm('rotate')}>
              New key
            </Button>
            <Button
              size="small"
              color={active ? 'warning' : 'primary'}
              onClick={() => update.mutate({ id: item.id, status: active ? 'REVOKED' : 'ACTIVE' })}
            >
              {active ? 'Revoke' : 'Enable'}
            </Button>
            <Button size="small" color="error" onClick={() => setConfirm('delete')}>
              Delete
            </Button>
          </Stack>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(error)}
          </Alert>
        )}
        <GithubSummary item={item} />
        <Collapse in={showActivity} unmountOnExit>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <ActivityList integrationId={item.id} />
          </Box>
        </Collapse>
      </CardContent>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm === 'rotate' ? 'Issue a new key?' : `Delete ${item.name}?`}</DialogTitle>
        <DialogContent>
          <Typography>
            {confirm === 'rotate'
              ? 'The current key stops working immediately. Update the app’s PM_API_KEY with the new key.'
              : 'The app loses access immediately. Tasks it already created stay in the project.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={confirm === 'delete' ? 'error' : 'primary'}
            onClick={() => {
              if (confirm === 'rotate') rotate.mutate(item.id, { onSuccess: onKey });
              else remove.mutate(item.id);
              setConfirm(null);
            }}
          >
            {confirm === 'rotate' ? 'Issue new key' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const filterProjectId = searchParams.get('projectId') ?? undefined;
  const integrations = useIntegrations(filterProjectId);
  const projects = useProjects();
  const create = useCreateIntegration();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', projectId: filterProjectId ?? '', description: '' });
  const [revealed, setRevealed] = useState<IntegrationWithKey | null>(null);
  const activeProjects = (projects.data ?? []).filter((project) => project.status !== 'ARCHIVED');
  const filterProject = activeProjects.find((project) => project.id === filterProjectId);

  function submit() {
    create.mutate(
      { name: form.name.trim(), projectId: form.projectId, description: form.description.trim() || undefined },
      {
        onSuccess: (result) => {
          setOpen(false);
          setForm({ name: '', projectId: filterProjectId ?? '', description: '' });
          setRevealed(result);
        },
      }
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Integrations</Typography>
          <Typography color="text.secondary">
            Connect your applications so they can push task progress automatically. Each app gets its own API key and
            can only touch its connected project.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpen(true)} sx={{ alignSelf: { sm: 'flex-start' }, flexShrink: 0 }}>
          Connect app
        </Button>
      </Stack>

      {filterProjectId && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" component={Link} href="/integrations">
              Show all
            </Button>
          }
        >
          Showing apps connected to {filterProject ? `${filterProject.key} · ${filterProject.name}` : 'this project'}.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            What a connected app can do
          </Typography>
          <Box
            component="ul"
            sx={{ m: 0, pl: 2.5, color: 'text.secondary', '& li': { mb: 0.5 }, typography: 'body2' }}
          >
            <li>
              Move tasks by key (<code>BANK-4 → done</code>) and leave comments — e.g. from CI after a deploy.
            </li>
            <li>
              Create or update tasks using its own ids (<code>externalKey</code>), one at a time or up to 500 in bulk.
            </li>
            <li>Re-sync its implementation document, same rules as the manual document import.</li>
            <li>
              With GitHub linked: commits like <code>fixes BANK-4</code> or <code>BANK-4 done</code> update tasks, and
              edits to the document in the repo re-sync the plan.
            </li>
            <li>
              Manual edits win: titles and descriptions changed here are never overwritten. All changes show in task
              activity.
            </li>
          </Box>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            API reference:{' '}
            <a href={API_URL.replace(/\/api\/v1$/, '/api/docs')} target="_blank" rel="noreferrer">
              Swagger → App API
            </a>
          </Typography>
        </CardContent>
      </Card>

      {integrations.error && <Alert severity="error">{errorMessage(integrations.error)}</Alert>}

      {integrations.data && integrations.data.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5} alignItems="center" sx={{ py: 4, textAlign: 'center' }}>
              <HubOutlinedIcon color="action" fontSize="large" />
              <Typography variant="h6">No apps connected yet</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
                Connect an application to a project to get an API key. Tip: import its implementation document first
                so the tasks already exist.
              </Typography>
              <Button variant="outlined" onClick={() => setOpen(true)}>
                Connect app
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {(integrations.data ?? []).map((item) => (
            <IntegrationRow key={item.id} item={item} onKey={setRevealed} />
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect an app</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="App name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Mobile Banking App"
              autoFocus
            />
            <TextField
              select
              label="Project"
              value={form.projectId}
              onChange={(event) => setForm({ ...form, projectId: event.target.value })}
              helperText="The app can only read and update tasks in this project"
            >
              {activeProjects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description (optional)"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Repo URL, owner, environment…"
            />
            {create.error && <Alert severity="error">{errorMessage(create.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={!form.name.trim() || !form.projectId || create.isPending}
          >
            Create key
          </Button>
        </DialogActions>
      </Dialog>

      <KeyDialog value={revealed} onClose={() => setRevealed(null)} />
    </Stack>
  );
}

export default function IntegrationsPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={null}>
        <IntegrationsContent />
      </Suspense>
    </RequireAdmin>
  );
}
