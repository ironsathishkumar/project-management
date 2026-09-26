'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { useApplyDocumentImport, usePreviewDocumentImport, useProjects } from '@/hooks/useApi';
import { setLastProjectId } from '@/lib/projectPreference';
import { useAuth } from '@/providers/AuthProvider';
import type { ImportAction, ImportChange, ImportPreview, ImportResult } from '@/types';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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
import { Suspense, useMemo, useState } from 'react';

const ACCEPT = '.md,.markdown,.txt,.docx,.pdf';

const ACTION_META: Record<ImportAction, { label: string; color: 'success' | 'primary' | 'info' | 'default' | 'warning' }> = {
  CREATE: { label: 'New task', color: 'success' },
  COMPLETE: { label: 'Mark done', color: 'primary' },
  UPDATE: { label: 'Update', color: 'info' },
  UNCHANGED: { label: 'Unchanged', color: 'default' },
  REMOVED: { label: 'Not in document', color: 'warning' },
};

const FORMAT_LABEL: Record<string, string> = { markdown: 'Markdown', text: 'Text', docx: 'Word', pdf: 'PDF' };

const EXAMPLE = `# Mobile Banking App

## Authentication
- [x] Login screen with OTP
- [ ] Biometric unlock

## Payments
- [ ] UPI transfer flow
  - Supports scan & pay`;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function ImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace } = useAuth();
  const projects = useProjects();
  const preview = usePreviewDocumentImport();
  const apply = useApplyDocumentImport();

  const initialProjectId = searchParams.get('projectId') ?? '';
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>(initialProjectId ? 'existing' : 'new');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const activeProjects = (projects.data ?? []).filter((project) => project.status !== 'ARCHIVED');
  const data: ImportPreview | undefined = preview.data;
  const target = mode === 'existing' ? { projectId } : { projectName: projectName.trim(), projectKey: projectKey.trim() };
  const canPreview = Boolean(file) && (mode === 'new' || Boolean(projectId));
  const actionable = data ? data.counts.CREATE + data.counts.COMPLETE + data.counts.UPDATE : 0;

  function resetPreview() {
    preview.reset();
    apply.reset();
    setResult(null);
  }

  function runPreview() {
    if (!file) return;
    resetPreview();
    preview.mutate({ file, ...target });
  }

  function runApply() {
    if (!file) return;
    apply.mutate({ file, ...target }, { onSuccess: (response) => setResult(response) });
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, ImportChange[]>();
    for (const change of data?.changes ?? []) {
      if (!showUnchanged && change.action === 'UNCHANGED') continue;
      const section = change.section || 'General';
      groups.set(section, [...(groups.get(section) ?? []), change]);
    }
    return [...groups.entries()];
  }, [data, showUnchanged]);

  function openProject(id: string, view: 'list' | 'backlog') {
    if (workspace?.id) setLastProjectId(workspace.id, id);
    router.push(`/projects/${id}/${view}`);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Import from document</Typography>
          <Typography color="text.secondary">
            Turn an implementation document into a project and tasks. Re-import the updated document any time to
            sync progress — manual changes in the app are kept.
          </Typography>
        </Box>
        <Button component={Link} href="/projects" sx={{ alignSelf: { sm: 'flex-start' } }}>
          Back to projects
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">1. Choose document</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                {file ? 'Change file' : 'Select file'}
                <input
                  hidden
                  type="file"
                  accept={ACCEPT}
                  onChange={(event) => {
                    const next = event.target.files?.[0] ?? null;
                    event.target.value = '';
                    setFile(next);
                    resetPreview();
                  }}
                />
              </Button>
              {file ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <DescriptionOutlinedIcon fontSize="small" color="action" />
                  <Typography>{file.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Markdown, Word (.docx), PDF or text · up to 10 MB
                </Typography>
              )}
            </Stack>
            <Box>
              <Button size="small" onClick={() => setShowHelp((value) => !value)}>
                {showHelp ? 'Hide' : 'How should the document look?'}
              </Button>
              <Collapse in={showHelp}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 1 }}>
                  <Box
                    component="pre"
                    sx={{ m: 0, p: 2, bgcolor: 'action.hover', borderRadius: 1, fontSize: 13, minWidth: 280 }}
                  >
                    {EXAMPLE}
                  </Box>
                  <Stack spacing={1}>
                    <Typography variant="body2">• The first top heading becomes the project name.</Typography>
                    <Typography variant="body2">• Each section heading becomes a milestone.</Typography>
                    <Typography variant="body2">
                      • Checklist items (<code>- [ ]</code>, ☐) become tasks; checked items (<code>- [x]</code>, ☑)
                      are marked done.
                    </Typography>
                    <Typography variant="body2">
                      • Without checklists, bullet or numbered items become tasks. Nested bullets go into the
                      description.
                    </Typography>
                    <Typography variant="body2">
                      • Re-importing matches tasks by section + title. It only moves tasks forward to done — it never
                      deletes tasks or reopens work.
                    </Typography>
                  </Stack>
                </Stack>
              </Collapse>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">2. Choose target</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_, value: 'new' | 'existing' | null) => {
                if (!value) return;
                setMode(value);
                resetPreview();
              }}
            >
              <ToggleButton value="new">New project</ToggleButton>
              <ToggleButton value="existing">Existing project (sync)</ToggleButton>
            </ToggleButtonGroup>
            {mode === 'new' ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Project name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder={data?.document.title ?? 'Defaults to the document title'}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 2 }}
                />
                <TextField
                  label="Key"
                  value={projectKey}
                  onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
                  helperText="Optional short code, e.g. BANK"
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
                  resetPreview();
                }}
                sx={{ maxWidth: 420 }}
              >
                {activeProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.key} · {project.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Box>
              <Button
                variant="contained"
                onClick={runPreview}
                disabled={!canPreview || preview.isPending}
                startIcon={preview.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Preview changes
              </Button>
            </Box>
            {preview.error && <Alert severity="error">{errorMessage(preview.error)}</Alert>}
          </Stack>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h6">3. Review</Typography>
                  <Typography color="text.secondary">
                    “{data.document.title}” · {FORMAT_LABEL[data.document.format]} · {data.document.itemCount} tasks
                    in {data.document.sections.length} sections ({data.document.doneCount} done)
                    {' → '}
                    {data.target.isNew ? (
                      <>new project “{data.target.projectName}”</>
                    ) : (
                      <>
                        {data.target.projectKey} · {data.target.projectName}
                      </>
                    )}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} />}
                  label="Show unchanged"
                />
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(Object.keys(ACTION_META) as ImportAction[]).map((action) => (
                  <Chip
                    key={action}
                    label={`${ACTION_META[action].label}: ${data.counts[action]}`}
                    color={ACTION_META[action].color}
                    variant={data.counts[action] ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Stack>

              {data.document.itemCount === 0 && (
                <Alert severity="warning">
                  No tasks were found. Use headings for sections and bullet or checkbox lists for tasks.
                </Alert>
              )}

              {grouped.length > 0 ? (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 480, overflow: 'auto' }}>
                  {grouped.map(([section, changes], index) => (
                    <Box key={section}>
                      {index > 0 && <Divider />}
                      <Typography
                        variant="overline"
                        sx={{ display: 'block', px: 2, pt: 1, bgcolor: 'background.default' }}
                      >
                        {section} · {changes.length}
                      </Typography>
                      {changes.map((change) => (
                        <Stack
                          key={`${change.action}-${change.externalKey}`}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{ px: 2, py: 0.75 }}
                        >
                          <Chip
                            size="small"
                            label={ACTION_META[change.action].label}
                            color={ACTION_META[change.action].color}
                            sx={{ minWidth: 118 }}
                          />
                          {change.done && <CheckCircleOutlineIcon fontSize="small" color="success" />}
                          <Typography sx={{ flex: 1 }} noWrap title={change.title}>
                            {change.title}
                          </Typography>
                          {change.note && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {change.note}
                            </Typography>
                          )}
                          {change.taskKey && (
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {change.taskKey}
                              {change.statusName ? ` · ${change.statusName}` : ''}
                            </Typography>
                          )}
                        </Stack>
                      ))}
                    </Box>
                  ))}
                </Box>
              ) : (
                data.document.itemCount > 0 && (
                  <Alert severity="success">Everything is already in sync with this document.</Alert>
                )
              )}

              {apply.error && <Alert severity="error">{errorMessage(apply.error)}</Alert>}

              {result ? (
                <Alert
                  severity="success"
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button color="inherit" size="small" onClick={() => openProject(result.project.id, 'list')}>
                        List
                      </Button>
                      <Button color="inherit" size="small" onClick={() => openProject(result.project.id, 'backlog')}>
                        Open backlog
                      </Button>
                    </Stack>
                  }
                >
                  Imported into {result.project.key} · {result.project.name}: {result.counts.CREATE} created,{' '}
                  {result.counts.COMPLETE} marked done, {result.counts.UPDATE} updated.
                </Alert>
              ) : (
                <Box>
                  <Button
                    variant="contained"
                    onClick={runApply}
                    disabled={apply.isPending || actionable === 0}
                    startIcon={apply.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {data.target.isNew ? `Create project with ${data.counts.CREATE} tasks` : `Apply ${actionable} changes`}
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default function ImportDocumentPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={null}>
        <ImportContent />
      </Suspense>
    </RequireAdmin>
  );
}
