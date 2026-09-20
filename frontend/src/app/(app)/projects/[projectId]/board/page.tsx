'use client';

import { KanbanBoard } from '@/components/board/KanbanBoard';
import { FilterBar } from '@/components/filters/FilterBar';
import { CreateTaskDialog, TaskDrawer } from '@/components/task/TaskDrawer';
import { useActiveSprint, useProject, useTasks, useWorkflows } from '@/hooks/useApi';
import { FilterGroup } from '@/types';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const project = useProject(projectId);
  const workflows = useWorkflows();
  const activeSprint = useActiveSprint(projectId);
  const [filters, setFilters] = useState<FilterGroup>({ combinator: 'AND', rules: [] });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sprintId = activeSprint.data?.id;
  const tasks = useTasks({
    projectId,
    filters,
    sprintId: sprintId || undefined,
    enabled: Boolean(sprintId),
  });

  const statuses = useMemo(() => {
    const workflow = workflows.data?.find((item) => item.id === project.data?.workflowId);
    return (workflow?.statuses ?? []).slice().sort((a, b) => a.order - b.order);
  }, [project.data?.workflowId, workflows.data]);

  const hasActiveSprint = Boolean(sprintId);
  const boardTasks = hasActiveSprint ? (tasks.data ?? []) : [];
  const showEmptySprintState = !activeSprint.isLoading && !hasActiveSprint;

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        sx={{ flexShrink: 0, pb: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {activeSprint.isLoading ? null : hasActiveSprint ? (
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {activeSprint.data!.name}
              </Typography>
              {activeSprint.data!.goal && (
                <Typography variant="body2" color="text.secondary">
                  {activeSprint.data!.goal}
                </Typography>
              )}
            </Stack>
          ) : showEmptySprintState ? (
            <Alert
              severity="warning"
              sx={{ mb: 1 }}
              action={
                <Button color="inherit" size="small" component={Link} href={`/projects/${projectId}/backlog`}>
                  Backlog
                </Button>
              }
            >
              No active sprint. Start a sprint to see issues on this board.
            </Alert>
          ) : null}
          <FilterBar value={filters} onChange={setFilters} />
        </Box>
        <Button
          variant="contained"
          onClick={() => setCreating(true)}
          disabled={!hasActiveSprint}
          sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' }, flexShrink: 0 }}
        >
          New task
        </Button>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {hasActiveSprint ? (
          <KanbanBoard statuses={statuses} tasks={boardTasks} onOpen={setTaskId} />
        ) : showEmptySprintState ? (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              border: '1px dashed #E7E0D6',
              borderRadius: 2,
              bgcolor: '#FFFCF7',
              px: 3,
            }}
          >
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Typography variant="h6">Board is empty until a sprint is active</Typography>
              <Typography color="text.secondary" maxWidth={420}>
                Move issues from the backlog into a sprint, then start that sprint. The board shows only the
                active sprint — same as Jira Scrum.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                <Button component={Link} href={`/projects/${projectId}/backlog`} variant="contained">
                  Open backlog
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}
      </Box>

      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
      <CreateTaskDialog
        open={creating}
        onClose={() => setCreating(false)}
        projectId={projectId}
        sprintId={sprintId}
      />
    </Box>
  );
}
