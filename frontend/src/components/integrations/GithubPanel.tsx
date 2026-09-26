'use client';

import {
  useConfigureGithub,
  useDisconnectGithub,
  useGithubWebhookSecret,
  useSyncGithub,
  useTestGithub,
} from '@/hooks/useApi';
import type { Integration } from '@/types';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { CopyBlock } from './CopyBlock';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function keywordHelp(projectKey: string) {
  return [
    `fixes ${projectKey}-4          → Done  (also: closes, resolves, completes)`,
    `${projectKey}-4 done           → Done  (also: fixed, closed, resolved)`,
    `start ${projectKey}-4          → In progress  (also: "${projectKey}-4 wip")`,
    `${projectKey}-4 #review        → any status by name or key`,
    `${projectKey}-4 #comment text  → adds a comment`,
    `closes ${projectKey}-1, ${projectKey}-2 and ${projectKey}-3`,
  ].join('\n');
}

function GithubDialog({ item, open, onClose }: { item: Integration; open: boolean; onClose: () => void }) {
  const configure = useConfigureGithub();
  const disconnect = useDisconnectGithub();
  const secret = useGithubWebhookSecret();
  const test = useTestGithub();
  const github = item.github;
  const [form, setForm] = useState({
    repo: github?.repo ?? '',
    branch: github?.branch ?? '',
    docsPath: github?.docsPath ?? '',
    token: '',
    removeToken: false,
    autoSync: github?.autoSync ?? true,
  });
  const projectKey = item.project?.key ?? 'KEY';

  function save() {
    test.reset();
    configure.mutate(
      {
        id: item.id,
        repo: form.repo,
        branch: form.branch,
        docsPath: form.docsPath,
        autoSync: form.autoSync,
        token: form.removeToken ? null : form.token.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm((current) => ({ ...current, token: '', removeToken: false }));
          test.mutate(item.id);
        },
      }
    );
  }

  const error = configure.error ?? disconnect.error ?? secret.error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>GitHub for {item.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Repository"
              value={form.repo}
              onChange={(event) => setForm({ ...form, repo: event.target.value })}
              placeholder="owner/name or https://github.com/owner/name"
              sx={{ flex: 2 }}
              autoFocus
            />
            <TextField
              label="Branch"
              value={form.branch}
              onChange={(event) => setForm({ ...form, branch: event.target.value })}
              placeholder="default branch"
              helperText="Only commits on this branch update tasks"
              sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label="Implementation document path (optional)"
            value={form.docsPath}
            onChange={(event) => setForm({ ...form, docsPath: event.target.value })}
            placeholder="docs/implementation.md"
            helperText="When this file changes on GitHub, the plan is re-synced (new tasks added, checked items marked done)"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label="GitHub token"
              type="password"
              value={form.token}
              onChange={(event) => setForm({ ...form, token: event.target.value, removeToken: false })}
              placeholder={github?.hasToken ? '•••••••• saved — leave empty to keep' : 'Needed for private repositories'}
              helperText="Fine-grained token with read-only Contents access. Stored encrypted."
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
              disabled={form.removeToken}
            />
            {github?.hasToken && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.removeToken}
                    onChange={(event) => setForm({ ...form, removeToken: event.target.checked, token: '' })}
                  />
                }
                label="Remove saved token"
              />
            )}
          </Stack>
          <FormControlLabel
            control={<Switch checked={form.autoSync} onChange={(event) => setForm({ ...form, autoSync: event.target.checked })} />}
            label="Auto-sync: check GitHub for new commits and document changes every few minutes (works on localhost)"
          />

          {error && <Alert severity="error">{errorMessage(error)}</Alert>}
          {test.error && <Alert severity="error">Connection check failed: {errorMessage(test.error)}</Alert>}
          {test.data && (
            <Alert severity="success">
              Connected to {test.data.repo} ({test.data.private ? 'private' : 'public'}, default branch{' '}
              {test.data.defaultBranch}){test.data.docFound ? ' · document found' : ''}
            </Alert>
          )}

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={save} disabled={!form.repo.trim() || configure.isPending}>
              {github ? 'Save' : 'Connect repository'}
            </Button>
            {github && (
              <Button onClick={() => test.mutate(item.id)} disabled={test.isPending}>
                Test connection
              </Button>
            )}
            {github && (
              <Button
                color="error"
                onClick={() => disconnect.mutate(item.id, { onSuccess: onClose })}
                disabled={disconnect.isPending}
              >
                Disconnect
              </Button>
            )}
          </Stack>

          <Divider />
          <Typography variant="subtitle1">Commit message keywords</Typography>
          <Typography variant="body2" color="text.secondary">
            Every commit that mentions a {projectKey} key adds a comment with a link to the commit. Add a keyword to
            also move the task:
          </Typography>
          <CopyBlock value={keywordHelp(projectKey)} />

          {github && (
            <>
              <Divider />
              <Typography variant="subtitle1">Instant updates with a webhook (optional)</Typography>
              <Typography variant="body2" color="text.secondary">
                Auto-sync already covers most cases. For instant updates, add a webhook in GitHub → Settings → Webhooks
                with content type <code>application/json</code> and the <code>push</code> event. GitHub cannot reach
                localhost — this needs a deployed tracker or a tunnel (ngrok, cloudflared, smee.io).
              </Typography>
              <CopyBlock value={github.webhookUrl} label="Payload URL" />
              {secret.data ? (
                <>
                  <Alert severity="warning">Copy the secret now — it won’t be shown again.</Alert>
                  <CopyBlock value={secret.data.secret} label="Secret" />
                </>
              ) : (
                <Box>
                  <Button variant="outlined" onClick={() => secret.mutate(item.id)} disabled={secret.isPending}>
                    {github.hasWebhookSecret ? 'Generate new secret' : 'Generate secret'}
                  </Button>
                </Box>
              )}

              <Divider />
              <Typography variant="subtitle1">From a developer machine (optional)</Typography>
              <Typography variant="body2" color="text.secondary">
                Send each commit the moment it’s made, even before pushing. Put <code>PM_API_URL</code> and{' '}
                <code>PM_API_KEY</code> in a git-ignored <code>.pm-sync.env</code> in the repository, then:
              </Typography>
              <CopyBlock value="node tools/pm-sync.mjs install-hook" />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function GithubSummary({ item }: { item: Integration }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const sync = useSyncGithub();
  const github = item.github;

  function runSync(sinceDays?: number) {
    setMenu(null);
    sync.mutate({ id: item.id, sinceDays });
  }

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      {github ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <GitHubIcon fontSize="small" />
              <Typography fontWeight={600}>{github.repo}</Typography>
              {github.branch && <Chip size="small" label={github.branch} variant="outlined" />}
              <Chip
                size="small"
                label={github.autoSync ? 'Auto-sync on' : 'Auto-sync off'}
                color={github.autoSync ? 'success' : 'default'}
                variant="outlined"
              />
              {github.hasWebhookSecret && <Chip size="small" label="Webhook" variant="outlined" />}
            </Stack>
            {github.docsPath && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Document: <code>{github.docsPath}</code>
              </Typography>
            )}
            <Typography
              variant="body2"
              color={github.lastEventStatus === 'ERROR' ? 'error' : 'text.secondary'}
              sx={{ mt: 0.5 }}
            >
              {github.lastEventAt
                ? `${github.lastEventMessage} · ${formatDistanceToNow(new Date(github.lastEventAt), { addSuffix: true })}`
                : 'Not synced yet'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Button size="small" variant="outlined" onClick={(event) => setMenu(event.currentTarget)} disabled={sync.isPending}>
              {sync.isPending ? 'Syncing…' : 'Sync now'}
            </Button>
            <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
              <MenuItem onClick={() => runSync()}>New commits since last sync</MenuItem>
              <MenuItem onClick={() => runSync(7)}>Commits from the last 7 days</MenuItem>
              <MenuItem onClick={() => runSync(30)}>Commits from the last 30 days</MenuItem>
            </Menu>
            <Button size="small" onClick={() => setOpen(true)}>
              GitHub settings
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            Link a GitHub repository so commits like <code>fixes {item.project?.key ?? 'KEY'}-4</code> and document
            changes update tasks.
          </Typography>
          <Button size="small" variant="outlined" startIcon={<GitHubIcon />} onClick={() => setOpen(true)}>
            Connect GitHub
          </Button>
        </Stack>
      )}
      {sync.error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {errorMessage(sync.error)}
        </Alert>
      )}
      {sync.data && (
        <Alert severity={sync.data.document && !sync.data.document.ok ? 'warning' : 'success'} sx={{ mt: 1.5 }}>
          {sync.data.message}
        </Alert>
      )}
      {open && <GithubDialog item={item} open={open} onClose={() => setOpen(false)} />}
    </Box>
  );
}
