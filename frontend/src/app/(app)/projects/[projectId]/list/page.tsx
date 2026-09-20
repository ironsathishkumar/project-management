'use client';

import { FilterBar } from '@/components/filters/FilterBar';
import { CreateTaskDialog, TaskDrawer } from '@/components/task/TaskDrawer';
import { useTasks } from '@/hooks/useApi';
import { FilterGroup } from '@/types';
import {
  Button,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function ListPage() {
  const params = useParams<{ projectId: string }>();
  const [filters, setFilters] = useState<FilterGroup>({ combinator: 'AND', rules: [] });
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const tasks = useTasks({ projectId: params.projectId, filters, sortField, sortDirection });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <FilterBar value={filters} onChange={setFilters} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="Sort"
            value={sortField}
            onChange={(event) => setSortField(event.target.value)}
          >
            {['priority', 'dueDate', 'createdAt', 'updatedAt', 'title'].map((field) => (
              <MenuItem key={field} value={field}>
                {field}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}
          >
            <MenuItem value="asc">Asc</MenuItem>
            <MenuItem value="desc">Desc</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => setCreating(true)}>
            New task
          </Button>
        </Stack>
      </Stack>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Due</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(tasks.data ?? []).map((task) => (
            <TableRow key={task.id} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskId(task.id)}>
              <TableCell>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                >
                  {task.key ?? '—'}
                </Typography>
              </TableCell>
              <TableCell>{task.title}</TableCell>
              <TableCell>
                <Chip size="small" label={task.status?.name ?? '—'} sx={{ bgcolor: `${task.status?.color}22` }} />
              </TableCell>
              <TableCell>{task.category?.name}</TableCell>
              <TableCell>{task.priority}</TableCell>
              <TableCell>
                {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : '—'}
              </TableCell>
              <TableCell>{task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
      <CreateTaskDialog open={creating} onClose={() => setCreating(false)} projectId={params.projectId} />
    </Stack>
  );
}
