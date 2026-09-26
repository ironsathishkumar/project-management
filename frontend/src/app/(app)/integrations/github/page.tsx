'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { CopyBlock } from '@/components/integrations/CopyBlock';
import { useDiscoverGithub, useProjects, useSetupGithub, type GithubSetupInput } from '@/hooks/useApi';
import { API_URL } from '@/lib/api';
import { setLastProjectId } from '@/lib/projectPreference';
import { useAuth } from '@/providers/AuthProvider';
import type { GithubDiscovery, GithubSetupResult } from '@/types';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const NO_DOCUMENT = '__none__';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function PlanPreview({ discovery }: { discovery: GithubDiscovery }) {
  const [open, setOpen] = useState(false);
  const preview = discovery.preview;
  if (!preview) return null;
  const { document, counts, target } = preview;
  const changes = preview.changes.filter((change) => change.action !== 'REMOVED');
  const sections = [...new Set(changes.map((change) => change.section || 'General'))];

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography fontWeight={600}>{document.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {document.itemCount} tasks in {document.sections.length} sections · {document.doneCount} already done
            {!target.isNew && ` · ${counts.CREATE} new, ${counts.COMPLETE} to mark done, ${counts.UNCHANGED} unchanged`}
          </Typography>
        </Box>
        <Button size="small" onClick={() => setOpen((value) => !value)} sx={{ alignSelf: { sm: 'center' } }}>
          {open ? 'Hide tasks' : 'Show tasks'}
        </Button>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 1.5, maxHeight: 360, overflow: 'auto' }}>
          {sections.map((section, index) => (
            <Box key={section}>
              {index > 0 && <Divider sx={{ my: 1 }} />}
              <Typography variant="overline" color="text.secondary">
                {section}
              </Typography>
              {changes
                .filter((change) => (change.section || 'General') === section)
                .map((change) => (
                  <Stack key={change.externalKey} direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
                    <CheckCircleOutlineIcon
                      fontSize="small"
                      color={change.done ? 'success' : 'disabled'}
                      titleAccess={change.done ? 'Done' : 'To do'}
                    />
                    <Typography variant="body2" noWrap title={change.title} sx={{ flex: 1 }}>
                      {change.title}
                    </Typography>
                    {change.taskKey && (
                      <Typography variant="caption" color="text.secondary">
                        {change.taskKey}
                      </Typography>
                    )}
                  </Stack>
                ))}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function SetupDone({ result, repo }: { result: GithubSetupResult; repo: string }) {
  const router = useRouter();
  const { workspace } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const project = result.project;
  const documentFailed = result.sync?.document ? !result.sync.document.ok : false;

  function openProject(view: 'backlog' | 'board') {
    if (!project) return;
    if (workspace?.id) setLastProjectId(workspace.id, project.id);
    router.push(`/projects/${project.id}/${view}`);
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Alert severity="success">
            <Typography fontWeight={600}>
              {project ? `${project.key} · ${project.name}` : 'Project'} is connected to {repo}
            </Typography>
            {result.sync?.message && <Typography variant="body2">First sync: {result.sync.message}</Typography>}
            <Typography variant="body2">
              {result.integration.github?.autoSync
                ? 'New commits and document changes are picked up automatically every few minutes.'
                : 'Auto-sync is off — use “Sync now” on the Integrations page.'}
            </Typography>
          </Alert>
          {result.syncError && (
            <Alert severity="warning">
              The project was connected, but the first sync failed: {result.syncError}. Use “Sync now” on the
              Integrations page to retry.
            </Alert>
          )}
          {documentFailed && (
            <Alert severity="warning">
              Document sync failed: {result.sync?.document?.error}. Check the document path in GitHub settings.
            </Alert>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => openProject('backlog')} disabled={!project}>
              Open backlog
            </Button>
            <Button variant="outlined" onClick={() => openProject('board')} disabled={!project}>
              Open board
            </Button>
            <Button component={Link} href={`/integrations?projectId=${project?.id ?? ''}`}>
              Integration settings
            </Button>
          </Stack>

          <Divider />
          <Box>
            <Button size="small" onClick={() => setShowAdvanced((value) => !value)}>
              {showAdvanced ? 'Hide' : 'Optional: instant updates from a developer machine or CI'}
            </Button>
            <Collapse in={showAdvanced}>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Alert severity="warning">This API key is shown only once. Copy it now if you plan to use it.</Alert>
                <CopyBlock
                  label="1. Save as .pm-sync.env in the repository (git-ignored)"
                  value={`PM_API_URL=${API_URL}\nPM_API_KEY=${result.apiKey}${
                    result.integration.github?.docsPath ? `\nPM_DOCS_PATH=${result.integration.github.docsPath}` : ''
                  }`}
                />
                <CopyBlock
                  label="2. Send every commit the moment it is made (needs tools/pm-sync.mjs, Node 18+)"
                  value="node tools/pm-sync.mjs install-hook"
                />
              </Stack>
            </Collapse>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function GithubSetupContent() {
  const searchParams = useSearchParams();
  const projects = useProjects();
  const discover = useDiscoverGithub();
  const setup = useSetupGithub();

  const initialProjectId = searchParams.get('projectId') ?? '';
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [branch, setBranch] = useState('');
  const [showBranch, setShowBranch] = useState(false);
  const [discovery, setDiscovery] = useState<GithubDiscovery | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>(initialProjectId ? 'existing' : 'new');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [result, setResult] = useState<GithubSetupResult | null>(null);

  const activeProjects = (projects.data ?? []).filter((project) => project.status !== 'ARCHIVED');
  const docsPath = discovery?.docsPath ?? '';

  function connection(): GithubSetupInput {
    return { repo: repo.trim(), token: token.trim() || undefined, branch: branch.trim() || undefined };
  }

  function target(nextMode = mode, nextProjectId = projectId) {
    return nextMode === 'existing'
      ? { projectId: nextProjectId || undefined }
      : { projectName: projectName.trim() || undefined, projectKey: projectKey.trim() || undefined };
  }

  function runDiscover(overrides: Partial<GithubSetupInput> = {}) {
    setup.reset();
    discover.mutate({ ...connection(), ...target(), ...overrides }, { onSuccess: setDiscovery });
  }

  function changeConnection(update: () => void) {
    update();
    setDiscovery(null);
    discover.reset();
  }

  function submit() {
    if (!discovery) return;
    setup.mutate(
      { ...connection(), docsPath: docsPath || undefined, autoSync, ...target() },
      { onSuccess: setResult }
    );
  }

  const suggestedName = discovery?.preview?.document.title || discovery?.repo.name || '';
  const canSubmit = Boolean(discovery) && !discovery?.docError && (mode === 'new' || Boolean(projectId));

  if (result) {
    return <SetupDone result={result} repo={discovery?.repo.fullName ?? repo} />;
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">1. Repository</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
              <TextField
                label="GitHub repository"
                value={repo}
                onChange={(event) => changeConnection(() => setRepo(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && repo.trim()) runDiscover();
                }}
                placeholder="https://github.com/owner/name"
                sx={{ flex: 2 }}
                autoFocus
              />
              <TextField
                label="Token (private repositories only)"
                type="password"
                value={token}
                onChange={(event) => changeConnection(() => setToken(event.target.value))}
                helperText="Fine-grained token with read-only Contents access. Stored encrypted."
                sx={{ flex: 1 }}
              />
            </Stack>
            <Collapse in={showBranch}>
              <TextField
                label="Branch"
                value={branch}
                onChange={(event) => changeConnection(() => setBranch(event.target.value))}
                placeholder="default branch"
                helperText="Only commits on this branch update tasks"
                sx={{ maxWidth: 320 }}
              />
            </Collapse>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={() => runDiscover()}
                disabled={!repo.trim() || discover.isPending}
                startIcon={discover.isPending ? <CircularProgress size={16} color="inherit" /> : <GitHubIcon />}
              >
                {discovery ? 'Check again' : 'Find plan'}
              </Button>
              {!showBranch && (
                <Button size="small" onClick={() => setShowBranch(true)}>
                  Use a specific branch
                </Button>
              )}
            </Stack>
            {discover.error && <Alert severity="error">{errorMessage(discover.error)}</Alert>}
          </Stack>
        </CardContent>
      </Card>

      {discovery && (
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6">2. Plan</Typography>
                <Chip size="small" icon={<GitHubIcon />} label={discovery.repo.fullName} />
                <Chip size="small" variant="outlined" label={discovery.repo.private ? 'Private' : 'Public'} />
                <Chip size="small" variant="outlined" label={`Branch ${discovery.branch}`} />
              </Stack>

              <TextField
                select
                label="Implementation document"
                value={docsPath || NO_DOCUMENT}
                onChange={(event) => {
                  const value = event.target.value;
                  runDiscover({ docsPath: value === NO_DOCUMENT ? '' : value });
                }}
                disabled={discover.isPending}
                helperText={
                  discovery.docsPath
                    ? 'Its tasks are imported now, and edits to this file on GitHub re-sync the plan'
                    : discovery.candidates.length
                      ? 'No plan was detected automatically — pick the document that lists the work, or continue with commits only'
                      : 'No documents found in the repository — the project will be updated from commits only'
                }
              >
                <MenuItem value={NO_DOCUMENT}>
                  <em>None — track commits only</em>
                </MenuItem>
                {discovery.candidates.map((candidate) => (
                  <MenuItem key={candidate.path} value={candidate.path}>
                    {candidate.path}
                  </MenuItem>
                ))}
                {discovery.docsPath && !discovery.candidates.some((item) => item.path === discovery.docsPath) && (
                  <MenuItem value={discovery.docsPath}>{discovery.docsPath}</MenuItem>
                )}
              </TextField>
              {discovery.docError && <Alert severity="error">{discovery.docError}</Alert>}
              {discovery.preview?.document.itemCount === 0 && (
                <Alert severity="warning">
                  No tasks were found in this document. Use headings for sections and bullet or checkbox lists for tasks.
                </Alert>
              )}
              <PlanPreview discovery={discovery} />

              <Divider />

              <Stack spacing={2}>
                <Typography variant="h6">3. Project</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={mode}
                  onChange={(_, value: 'new' | 'existing' | null) => {
                    if (!value) return;
                    setMode(value);
                    if (value === 'new' || projectId) {
                      discover.mutate(
                        { ...connection(), docsPath, ...target(value) },
                        { onSuccess: setDiscovery }
                      );
                    }
                  }}
                >
                  <ToggleButton value="new">New project</ToggleButton>
                  <ToggleButton value="existing">Existing project</ToggleButton>
                </ToggleButtonGroup>
                {mode === 'new' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Project name"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder={suggestedName}
                      InputLabelProps={{ shrink: true }}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Key"
                      value={projectKey}
                      onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
                      helperText="Optional, e.g. BANK — used in commits like “fixes BANK-4”"
                      inputProps={{ maxLength: 8 }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                ) : (
                  <TextField
                    select
                    label="Project"
                    value={projectId}
                    onChange={(event) => {
                      setProjectId(event.target.value);
                      discover.mutate(
                        { ...connection(), docsPath, ...target('existing', event.target.value) },
                        { onSuccess: setDiscovery }
                      );
                    }}
                    helperText="Tasks are matched by section and title — existing tasks are not duplicated"
                    sx={{ maxWidth: 420 }}
                  >
                    {activeProjects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.key} · {project.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <FormControlLabel
                  control={<Switch checked={autoSync} onChange={(event) => setAutoSync(event.target.checked)} />}
                  label="Keep in sync automatically (checks GitHub every few minutes)"
                />
              </Stack>

              {setup.error && <Alert severity="error">{errorMessage(setup.error)}</Alert>}
              <Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={submit}
                  disabled={!canSubmit || setup.isPending || discover.isPending}
                  startIcon={setup.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {setup.isPending
                    ? 'Connecting…'
                    : mode === 'new'
                      ? discovery.preview
                        ? `Create project with ${discovery.preview.document.itemCount} tasks`
                        : 'Create project'
                      : 'Connect project'}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Commits from the last 30 days that mention task keys are applied right away.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default function GithubSetupPage() {
  return (
    <RequireAdmin>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4">Add project from GitHub</Typography>
            <Typography color="text.secondary">
              Paste a repository. The tracker finds its implementation document, creates the project and tasks, and
              keeps them in sync with commits like “fixes BANK-4”.
            </Typography>
          </Box>
          <Button component={Link} href="/integrations" sx={{ alignSelf: { sm: 'flex-start' }, flexShrink: 0 }}>
            Back to integrations
          </Button>
        </Stack>
        <Suspense fallback={null}>
          <GithubSetupContent />
        </Suspense>
      </Stack>
    </RequireAdmin>
  );
}
