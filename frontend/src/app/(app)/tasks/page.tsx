'use client';

import { FilterBar } from '@/components/filters/FilterBar';
import { CreateTaskDialog, TaskDrawer } from '@/components/task/TaskDrawer';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/hooks/useApi';
import { FilterGroup } from '@/types';
import { Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function MyTasksContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterGroup>({ combinator: 'AND', rules: [] });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const tasks = useTasks({
    assigneeId: user?.id,
    search: searchParams.get('search') ?? undefined,
    filters,
    sortField: 'dueDate',
    sortDirection: 'asc',
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between">
        <div>
          <Typography variant="h4">My Tasks</Typography>
          <Typography color="text.secondary">Work assigned to you across the workspace.</Typography>
        </div>
        <Button variant="contained" onClick={() => setCreating(true)}>
          New task
        </Button>
      </Stack>
      <FilterBar value={filters} onChange={setFilters} />
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Due</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(tasks.data ?? []).map((task) => (
            <TableRow key={task.id} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskId(task.id)}>
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {task.key ?? '—'}
                </Typography>
              </TableCell>
              <TableCell>{task.title}</TableCell>
              <TableCell>
                <Chip size="small" label={task.status?.name ?? '—'} />
              </TableCell>
              <TableCell>{task.priority}</TableCell>
              <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
      <CreateTaskDialog open={creating} onClose={() => setCreating(false)} />
    </Stack>
  );
}

export default function MyTasksPage() {
  return (
    <Suspense fallback={<Typography>Loading tasks…</Typography>}>
      <MyTasksContent />
    </Suspense>
  );
}
