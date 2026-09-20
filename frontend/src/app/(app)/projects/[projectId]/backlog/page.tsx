'use client';

import { TaskDrawer } from '@/components/task/TaskDrawer';
import { BACKLOG_ID, BacklogBoard } from '@/components/backlog/BacklogBoard';
import {
  useCategories,
  useCompleteSprint,
  useCreateSprint,
  useMembers,
  useMoveTasksToSprint,
  useProject,
  useSprints,
  useStartSprint,
  useTasks,
  useUpdateTask,
  useWorkflows,
} from '@/hooks/useApi';
import { ApiClientError } from '@/lib/api';
import { isWorkspaceAdmin } from '@/lib/permissions';
import { useAuth } from '@/providers/AuthProvider';
import {
  CheckCircleOutline,
  PlayArrowOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function BacklogPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { user, workspace } = useAuth();
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTarget, setBulkTarget] = useState('');
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [sprintError, setSprintError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    assigneeId: '',
    categoryId: '',
    statusId: '',
  });

  const project = useProject(projectId);
  const allTasks = useTasks({ projectId });
  const sprints = useSprints(projectId);
  const categories = useCategories();
  const members = useMembers();
  const workflows = useWorkflows();
  const moveTasks = useMoveTasksToSprint(projectId);
  const createSprint = useCreateSprint(projectId);
  const startSprint = useStartSprint(projectId);
  const completeSprint = useCompleteSprint(projectId);
  const updateTask = useUpdateTask();

  const statuses = useMemo(() => {
    const workflow = workflows.data?.find((item) => item.id === project.data?.workflowId);
    return (workflow?.statuses ?? []).slice().sort((a, b) => a.order - b.order);
  }, [project.data?.workflowId, workflows.data]);

  const openSprints = useMemo(
    () => (sprints.data ?? []).filter((sprint) => sprint.status !== 'COMPLETED'),
    [sprints.data]
  );

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return (allTasks.data ?? []).filter((task) => {
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
      if (filters.categoryId && task.categoryId !== filters.categoryId) return false;
      if (filters.statusId && task.statusId !== filters.statusId) return false;
      if (!search) return true;
      return (
        task.title.toLowerCase().includes(search) ||
        (task.key ?? '').toLowerCase().includes(search) ||
        (task.description ?? '').toLowerCase().includes(search)
      );
    });
  }, [allTasks.data, filters]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function moveSelected() {
    if (!selected.length || !bulkTarget) return;
    await moveTasks.mutateAsync({
      taskIds: selected,
      sprintId: bulkTarget === BACKLOG_ID ? null : bulkTarget,
    });
    setSelected([]);
    setBulkTarget('');
  }

  async function onCreateSprint() {
    setSprintError('');
    if (!sprintForm.name.trim()) {
      setSprintError('Sprint name is required');
      return;
    }
    try {
      await createSprint.mutateAsync({
        name: sprintForm.name.trim(),
        goal: sprintForm.goal.trim() || undefined,
        startDate: sprintForm.startDate || undefined,
        endDate: sprintForm.endDate || undefined,
      });
      setSprintForm({ name: '', goal: '', startDate: '', endDate: '' });
      setCreateSprintOpen(false);
    } catch (err) {
      setSprintError(err instanceof ApiClientError ? err.message : 'Unable to create sprint');
    }
  }

  const hasFilters = Boolean(filters.search || filters.assigneeId || filters.categoryId || filters.statusId);

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 1.5, flexShrink: 0 }}
      >
        <Box>
          <Typography variant="h6">Backlog</Typography>
          <Typography color="text.secondary" variant="body2">
            Drag issues between sprints or reorder within a list — changes save automatically.
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" onClick={() => setCreateSprintOpen(true)}>
            Create sprint
          </Button>
        )}
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{ mb: 1.5, flexShrink: 0 }}
        useFlexGap
        flexWrap="wrap"
      >
        <TextField
          size="small"
          label="Search"
          value={filters.search}
          onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
          sx={{ minWidth: 200, flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Assignee"
          value={filters.assigneeId}
          onChange={(e) => setFilters((current) => ({ ...current, assigneeId: e.target.value }))}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Anyone</MenuItem>
          {(members.data ?? []).map((member) => (
            <MenuItem key={member.userId} value={member.userId}>
              {member.user?.firstName} {member.user?.lastName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Type"
          value={filters.categoryId}
          onChange={(e) => setFilters((current) => ({ ...current, categoryId: e.target.value }))}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All types</MenuItem>
          {(categories.data ?? []).map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={filters.statusId}
          onChange={(e) => setFilters((current) => ({ ...current, statusId: e.target.value }))}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {statuses.map((status) => (
            <MenuItem key={status.id} value={status.id}>
              {status.name}
            </MenuItem>
          ))}
        </TextField>
        {hasFilters && (
          <Button
            onClick={() => setFilters({ search: '', assigneeId: '', categoryId: '', statusId: '' })}
          >
            Clear filters
          </Button>
        )}
      </Stack>

      {selected.length > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          sx={{ mb: 1.5, p: 1.25, bgcolor: '#FFF4E0', borderRadius: 2, flexShrink: 0 }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ mr: 1 }}>
            {selected.length} selected
          </Typography>
          <TextField
            select
            size="small"
            label="Move to"
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value={BACKLOG_ID}>Backlog</MenuItem>
            {openSprints.map((sprint) => (
              <MenuItem key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.status})
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={!bulkTarget || moveTasks.isPending} onClick={() => void moveSelected()}>
            Move
          </Button>
          <Button onClick={() => setSelected([])}>Clear</Button>
        </Stack>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
        <BacklogBoard
          projectId={projectId}
          sprints={openSprints}
          tasks={filteredTasks}
          categories={categories.data ?? []}
          selected={selected}
          onToggle={toggle}
          onOpen={setTaskId}
          onPointsChange={(id, points) =>
            void updateTask.mutateAsync({ taskId: id, input: { storyPoints: points } })
          }
          renderSprintActions={
            isAdmin
              ? (sprint) => (
                  <>
                    {sprint.status === 'PLANNED' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlayArrowOutlined />}
                        disabled={startSprint.isPending}
                        onClick={() => void startSprint.mutateAsync(sprint.id)}
                      >
                        Start sprint
                      </Button>
                    )}
                    {sprint.status === 'ACTIVE' && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<CheckCircleOutline />}
                        disabled={completeSprint.isPending}
                        onClick={() =>
                          void completeSprint.mutateAsync({
                            sprintId: sprint.id,
                            moveIncompleteToBacklog: true,
                          })
                        }
                      >
                        Complete sprint
                      </Button>
                    )}
                  </>
                )
              : undefined
          }
        />
      </Box>

      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />

      <Dialog open={createSprintOpen} onClose={() => setCreateSprintOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create sprint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {sprintError && <Alert severity="error">{sprintError}</Alert>}
            <TextField
              label="Name"
              value={sprintForm.name}
              onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Goal"
              value={sprintForm.goal}
              onChange={(e) => setSprintForm({ ...sprintForm, goal: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={sprintForm.startDate}
                onChange={(e) => setSprintForm({ ...sprintForm, startDate: e.target.value })}
                fullWidth
              />
              <TextField
                label="End"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={sprintForm.endDate}
                onChange={(e) => setSprintForm({ ...sprintForm, endDate: e.target.value })}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateSprintOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void onCreateSprint()} disabled={createSprint.isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
