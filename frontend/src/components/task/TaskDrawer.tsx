'use client';

import {
  useCategories,
  useCreateTask,
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useMembers,
  useProjects,
  useTask,
  useTimeEntries,
  useUpdateTask,
  useWorkflows,
} from '@/hooks/useApi';
import { api } from '@/lib/api';
import {
  AddRounded,
  ArrowForward,
  CheckRounded,
  Close,
  ExpandMoreRounded,
  PersonOutline,
  Schedule,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: '#FFFCF7',
        border: '1px solid #EDE6DB',
      }}
    >
      <Typography sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600, mb: 0.25 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

const menuPaperSx = {
  mt: 1,
  minWidth: 260,
  maxWidth: 320,
  borderRadius: 2.5,
  border: '1px solid #E7E0D6',
  bgcolor: '#FFFEFB',
  boxShadow: '0 18px 40px rgba(23, 50, 77, 0.12)',
  overflow: 'hidden',
  '& .MuiList-root': { py: 0.75 },
  '& .MuiMenuItem-root': {
    mx: 0.75,
    my: 0.25,
    borderRadius: 2,
    px: 1.25,
    py: 1,
    gap: 1,
    '&.Mui-selected': {
      bgcolor: 'rgba(31,78,121,0.08)',
      '&:hover': { bgcolor: 'rgba(31,78,121,0.12)' },
    },
  },
} as const;

function ValueChip({
  onClick,
  leading,
  label,
  accent,
}: {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  leading: ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        maxWidth: '100%',
        boxSizing: 'border-box',
        pl: 1,
        pr: 1.25,
        py: 0.85,
        borderRadius: 999,
        border: '1.5px solid',
        borderColor: accent ? `${accent}55` : '#D9D0C4',
        bgcolor: accent ? `${accent}14` : '#FFFEFB',
        transition: 'border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease',
        boxShadow: '0 1px 0 rgba(23,50,77,0.04)',
        '&:hover': {
          borderColor: accent ?? '#1F4E79',
          transform: 'translateY(-1px)',
          boxShadow: '0 8px 18px rgba(23,50,77,0.08)',
        },
      }}
    >
      {leading}
      <Typography fontWeight={700} variant="body2" noWrap sx={{ maxWidth: 220 }}>
        {label}
      </Typography>
      <ExpandMoreRounded sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
    </Box>
  );
}

export function TaskDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(taskId);
  const taskQuery = useTask(activeId);
  const workflows = useWorkflows();
  const categories = useCategories();
  const members = useMembers();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const timeEntries = useTimeEntries(activeId);
  const createTimeEntry = useCreateTimeEntry(activeId ?? '');
  const deleteTimeEntry = useDeleteTimeEntry(activeId ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [comment, setComment] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(null);
  const [logHours, setLogHours] = useState('0');
  const [logMinutes, setLogMinutes] = useState('30');
  const [workUpdate, setWorkUpdate] = useState('');
  const [logDate, setLogDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hideDoneSubtasks, setHideDoneSubtasks] = useState(false);

  useEffect(() => setActiveId(taskId), [taskId]);

  const task = taskQuery.data;
  const statuses = useMemo(() => {
    const all = workflows.data?.flatMap((workflow) => workflow.statuses) ?? [];
    return all
      .filter(
        (status) =>
          !task ||
          all.find((item) => item.id === task.statusId)?.workflowId === status.workflowId ||
          status.id === task.statusId
      )
      .filter((status) => status.category !== 'CANCELLED')
      .sort((a, b) => a.order - b.order);
  }, [task, workflows.data]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setSubtaskTitle('');
    setComment('');
    setLogHours('0');
    setLogMinutes('30');
    setWorkUpdate('');
    setLogDate(format(new Date(), 'yyyy-MM-dd'));
  }, [task?.id]);

  async function patch(input: Record<string, unknown>, message: string) {
    if (!activeId) return;
    setBusy(true);
    try {
      await updateTask.mutateAsync({ taskId: activeId, input });
      setToast(message);
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask() {
    if (!task || !subtaskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        projectId: task.projectId,
        title: subtaskTitle.trim(),
        categoryId: task.categoryId,
        parentTaskId: task.id,
        sprintId: task.sprintId ?? null,
        priority: task.priority,
      });
      setSubtaskTitle('');
      setToast('Subtask added');
      await queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch {
      setToast('Could not add subtask');
    }
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    const doneStatus =
      statuses.find((item) => item.category === 'COMPLETED' && item.isFinal) ??
      statuses.find((item) => item.category === 'COMPLETED');
    const todoStatus =
      statuses.find((item) => item.isDefault) ?? statuses.find((item) => item.category === 'NOT_STARTED');
    const next = done ? doneStatus : todoStatus;
    if (!next) return;
    await updateTask.mutateAsync({ taskId: subtaskId, input: { statusId: next.id } });
    setToast(done ? 'Nice — step complete' : 'Step reopened');
    if (activeId) void queryClient.invalidateQueries({ queryKey: ['task', activeId] });
  }

  async function addComment() {
    if (!activeId || !comment.trim()) return;
    await api(`/tasks/${activeId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: comment.trim() }),
    });
    setComment('');
    setToast('Update shared');
    void queryClient.invalidateQueries({ queryKey: ['task', activeId] });
  }

  async function submitTimeLog() {
    if (!activeId) return;
    const hours = Math.max(0, Number.parseInt(logHours, 10) || 0);
    const minutesPart = Math.max(0, Number.parseInt(logMinutes, 10) || 0);
    const total = hours * 60 + minutesPart;
    if (total < 1) {
      setToast('Enter time greater than 0');
      return;
    }
    const updateText = workUpdate.trim();
    if (!updateText) {
      setToast('Add a work update');
      return;
    }
    try {
      await createTimeEntry.mutateAsync({
        minutes: total,
        description: updateText,
        workDate: logDate || undefined,
      });
      await api(`/tasks/${activeId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: `⏱ ${formatMinutes(total)} — ${updateText}`,
        }),
      });
      setToast(`Logged ${formatMinutes(total)}`);
      setWorkUpdate('');
      setLogHours('0');
      setLogMinutes('30');
      void queryClient.invalidateQueries({ queryKey: ['task', activeId] });
    } catch {
      setToast('Could not log time');
    }
  }

  function applyQuickMinutes(minutes: number) {
    setLogHours(String(Math.floor(minutes / 60)));
    setLogMinutes(String(minutes % 60));
  }

  const subtasks = task?.subtasks ?? [];
  const doneCount = subtasks.filter((item) => item.status?.category === 'COMPLETED').length;
  const visibleSubtasks = hideDoneSubtasks
    ? subtasks.filter((item) => item.status?.category !== 'COMPLETED')
    : subtasks;
  const subtaskProgress = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const currentIndex = statuses.findIndex((status) => status.id === task?.statusId);
  const nextStatus = currentIndex >= 0 ? statuses[currentIndex + 1] : undefined;
  const isDone = task?.status?.category === 'COMPLETED';
  const selectedLogMinutes =
    (Math.max(0, Number.parseInt(logHours, 10) || 0) * 60) +
    (Math.max(0, Number.parseInt(logMinutes, 10) || 0));

  const primaryAction = (() => {
    if (!task) return null;
    if (isDone) {
      const reopen = statuses.find((item) => item.isDefault) ?? statuses[0];
      return reopen
        ? {
            label: 'Reopen this work',
            onClick: () => void patch({ statusId: reopen.id }, 'Reopened'),
          }
        : null;
    }
    if (nextStatus) {
      return {
        label: `Move to ${nextStatus.name}`,
        onClick: () => void patch({ statusId: nextStatus.id }, `Now in ${nextStatus.name}`),
      };
    }
    return null;
  })();

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(taskId)}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 640 },
            bgcolor: '#F7F3EC',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1}>
                  {task?.key ?? 'Issue'}
                  {task?.category ? ` · ${task.category.name}` : ''}
                </Typography>
                <TextField
                  fullWidth
                  variant="standard"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    if (task && title.trim() && title.trim() !== task.title) {
                      void patch({ title: title.trim() }, 'Title updated');
                    }
                  }}
                  placeholder="What are we working on?"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      typography: 'h4',
                      fontFamily: '"Fraunces", Georgia, serif',
                      fontWeight: 600,
                      mt: 0.5,
                    },
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {isDone
                    ? 'Finished'
                    : task?.assignee
                      ? `Updated ${
                          task.updatedAt
                            ? formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })
                            : 'recently'
                        }`
                      : 'Unassigned'}
                </Typography>
                {task?.source?.kind === 'DOCUMENT' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    From document: {task.source.name}
                    {task.source.section ? ` · ${task.source.section}` : ''}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={onClose} aria-label="Close" sx={{ bgcolor: '#FFFCF7' }}>
                <Close />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 3, pb: 2 }}>
            {taskQuery.isLoading && !task && (
              <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            )}

            {task && (
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.75, display: 'block' }}>
                      Status
                    </Typography>
                    <ValueChip
                      accent={task.status?.color}
                      onClick={(event) => setStatusAnchor(event.currentTarget)}
                      leading={
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: task.status?.color ?? '#1F4E79',
                            flexShrink: 0,
                          }}
                        />
                      }
                      label={task.status?.name ?? 'Select'}
                    />
                    <Menu
                      anchorEl={statusAnchor}
                      open={Boolean(statusAnchor)}
                      onClose={() => setStatusAnchor(null)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      PaperProps={{ sx: menuPaperSx }}
                    >
                      {statuses.map((status, index) => {
                        const selected = task.statusId === status.id;
                        return (
                          <MenuItem
                            key={status.id}
                            selected={selected}
                            onClick={() => {
                              setStatusAnchor(null);
                              if (!selected) void patch({ statusId: status.id }, `Moved to ${status.name}`);
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Box
                                sx={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  bgcolor: status.color,
                                  color: '#fff',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {selected ? <CheckRounded sx={{ fontSize: 14 }} /> : index + 1}
                              </Box>
                            </ListItemIcon>
                            <ListItemText
                              primary={status.name}
                              primaryTypographyProps={{ fontWeight: selected ? 700 : 600, variant: 'body2' }}
                            />
                          </MenuItem>
                        );
                      })}
                    </Menu>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.75, display: 'block' }}>
                      Assignee
                    </Typography>
                    <ValueChip
                      accent={task.assigneeId ? '#1F4E79' : undefined}
                      onClick={(event) => setAssigneeAnchor(event.currentTarget)}
                      leading={
                        task.assignee ? (
                          <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#1F4E79' }}>
                            {`${task.assignee.firstName[0]}${task.assignee.lastName[0]}`}
                          </Avatar>
                        ) : (
                          <Avatar sx={{ width: 22, height: 22, bgcolor: '#E7E0D6', color: '#57534E' }}>
                            <PersonOutline sx={{ fontSize: 14 }} />
                          </Avatar>
                        )
                      }
                      label={task.assignee ? task.assignee.firstName : 'Unassigned'}
                    />
                    <Menu
                      anchorEl={assigneeAnchor}
                      open={Boolean(assigneeAnchor)}
                      onClose={() => setAssigneeAnchor(null)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      PaperProps={{ sx: menuPaperSx }}
                    >
                      <MenuItem
                        selected={!task.assigneeId}
                        onClick={() => {
                          setAssigneeAnchor(null);
                          if (task.assigneeId) void patch({ assigneeId: null }, 'Unassigned');
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: '#E7E0D6', color: '#57534E' }}>
                            <PersonOutline fontSize="small" />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary="Unassigned"
                          primaryTypographyProps={{ fontWeight: !task.assigneeId ? 700 : 600, variant: 'body2' }}
                        />
                      </MenuItem>
                      {(members.data ?? []).map((member) => {
                        const selected = task.assigneeId === member.userId;
                        const name = member.user
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.userId;
                        const initials = member.user
                          ? `${member.user.firstName[0]}${member.user.lastName[0]}`
                          : '?';
                        return (
                          <MenuItem
                            key={member.userId}
                            selected={selected}
                            onClick={() => {
                              setAssigneeAnchor(null);
                              if (!selected) {
                                void patch(
                                  { assigneeId: member.userId },
                                  `${member.user?.firstName ?? 'Teammate'} is on it`
                                );
                              }
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: '#17324D' }}>
                                {initials}
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={name}
                              primaryTypographyProps={{ fontWeight: selected ? 700 : 600, variant: 'body2' }}
                            />
                          </MenuItem>
                        );
                      })}
                    </Menu>
                  </Box>
                </Box>

                <Section title="Description" hint="Full context for this task.">
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    placeholder="Describe the work, acceptance criteria, links…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => {
                      if ((task.description ?? '') !== description) {
                        void patch({ description }, 'Description saved');
                      }
                    }}
                  />
                </Section>

                <Section title="Subtasks">
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add subtask and press Enter"
                        value={subtaskTitle}
                        onChange={(e) => setSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void addSubtask();
                        }}
                      />
                      <IconButton
                        color="primary"
                        onClick={() => void addSubtask()}
                        disabled={!subtaskTitle.trim() || createTask.isPending}
                        sx={{
                          bgcolor: 'primary.main',
                          color: '#fff',
                          borderRadius: 2,
                          '&:hover': { bgcolor: 'primary.dark' },
                          '&.Mui-disabled': { bgcolor: '#E7E0D6', color: '#A8A29E' },
                        }}
                      >
                        <AddRounded />
                      </IconButton>
                    </Stack>

                    {subtasks.length > 0 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {doneCount}/{subtasks.length} done · {subtaskProgress}%
                          </Typography>
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => setHideDoneSubtasks((value) => !value)}
                            sx={{ minWidth: 0, px: 1, fontSize: 12 }}
                          >
                            {hideDoneSubtasks ? 'Show done' : 'Hide done'}
                          </Button>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={subtaskProgress}
                          sx={{
                            height: 6,
                            borderRadius: 999,
                            bgcolor: '#EDE6DB',
                            '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: '#1F4E79' },
                          }}
                        />
                      </Box>
                    )}

                    <Stack spacing={0.5}>
                      {visibleSubtasks.map((subtask) => {
                        const done = subtask.status?.category === 'COMPLETED';
                        return (
                          <Stack
                            key={subtask.id}
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{
                              px: 1,
                              py: 0.65,
                              borderRadius: 2,
                              bgcolor: done ? 'rgba(21,128,61,0.07)' : 'transparent',
                              '&:hover': { bgcolor: done ? 'rgba(21,128,61,0.1)' : '#FFFEFB' },
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => void toggleSubtask(subtask.id, !done)}
                              sx={{
                                width: 26,
                                height: 26,
                                bgcolor: done ? 'success.main' : '#fff',
                                color: done ? '#fff' : 'text.secondary',
                                border: done ? 'none' : '1.5px solid #D9D0C4',
                                '&:hover': { bgcolor: done ? 'success.dark' : '#F4F1EA' },
                              }}
                            >
                              <CheckRounded sx={{ fontSize: 15 }} />
                            </IconButton>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              noWrap
                              sx={{
                                flex: 1,
                                cursor: 'pointer',
                                textDecoration: done ? 'line-through' : 'none',
                                opacity: done ? 0.55 : 1,
                              }}
                              onClick={() => setActiveId(subtask.id)}
                            >
                              {subtask.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                              {subtask.key}
                            </Typography>
                          </Stack>
                        );
                      })}
                      {subtasks.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                          No subtasks — add one above.
                        </Typography>
                      )}
                      {subtasks.length > 0 && visibleSubtasks.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                          All done. Show completed to review.
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Section>

                <Section title="Details" hint="Type, urgency, and due date.">
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Type"
                      value={task.categoryId}
                      onChange={(e) => void patch({ categoryId: e.target.value }, 'Type updated')}
                    >
                      {(categories.data ?? []).map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Priority"
                      value={task.priority}
                      onChange={(e) => void patch({ priority: e.target.value }, 'Priority updated')}
                    >
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => (
                        <MenuItem key={priority} value={priority}>
                          {priority === 'LOW'
                            ? 'Low'
                            : priority === 'MEDIUM'
                              ? 'Medium'
                              : priority === 'HIGH'
                                ? 'High'
                                : 'Urgent'}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      type="date"
                      fullWidth
                      size="small"
                      label="Due"
                      InputLabelProps={{ shrink: true }}
                      value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                      onChange={(e) =>
                        void patch(
                          { dueDate: e.target.value || null },
                          e.target.value ? 'Due date set' : 'Due date cleared'
                        )
                      }
                    />
                  </Stack>
                </Section>

                <Section title="Time log">
                  <Stack spacing={1.75}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: 'rgba(31,78,121,0.06)',
                        border: '1px solid rgba(31,78,121,0.12)',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          Total on this task
                        </Typography>
                        <Typography
                          sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600, fontSize: 28, lineHeight: 1.1 }}
                        >
                          {formatMinutes(timeEntries.data?.totalMinutes ?? 0)}
                        </Typography>
                      </Box>
                      <Schedule sx={{ color: '#1F4E79', fontSize: 28, opacity: 0.7 }} />
                    </Stack>

                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.75, display: 'block' }}>
                        Duration
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                        {[15, 30, 45, 60, 90, 120].map((minutes) => {
                          const selected = selectedLogMinutes === minutes;
                          return (
                            <Button
                              key={minutes}
                              size="small"
                              variant={selected ? 'contained' : 'outlined'}
                              onClick={() => applyQuickMinutes(minutes)}
                              sx={{
                                minWidth: 52,
                                borderRadius: 999,
                                ...(selected
                                  ? {}
                                  : { bgcolor: '#FFFEFB', borderColor: '#E7E0D6', color: 'text.primary' }),
                              }}
                            >
                              {formatMinutes(minutes)}
                            </Button>
                          );
                        })}
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          type="number"
                          label="Hrs"
                          value={logHours}
                          onChange={(e) => setLogHours(e.target.value)}
                          inputProps={{ min: 0, max: 24 }}
                          sx={{ width: 90 }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Min"
                          value={logMinutes}
                          onChange={(e) => setLogMinutes(e.target.value)}
                          inputProps={{ min: 0, max: 59 }}
                          sx={{ width: 90 }}
                        />
                        <TextField
                          size="small"
                          type="date"
                          label="Date"
                          InputLabelProps={{ shrink: true }}
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                    </Box>

                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label="Work update"
                      placeholder="What did you get done?"
                      value={workUpdate}
                      onChange={(e) => setWorkUpdate(e.target.value)}
                      helperText="Saved on the time entry and posted as a work update"
                    />

                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      startIcon={<Schedule />}
                      onClick={() => void submitTimeLog()}
                      disabled={createTimeEntry.isPending || selectedLogMinutes < 1 || !workUpdate.trim()}
                    >
                      Log {selectedLogMinutes > 0 ? formatMinutes(selectedLogMinutes) : 'time'}
                    </Button>

                    <Stack spacing={0.75}>
                      {(timeEntries.data?.entries ?? []).slice(0, 5).map((entry) => (
                        <Box
                          key={entry.id}
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: '#FFFEFB',
                            border: '1px solid #EDE6DB',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700}>
                                {formatMinutes(entry.minutes)}
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  {entry.user?.firstName ?? 'Someone'} · {format(new Date(entry.workDate), 'MMM d')}
                                </Typography>
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                {entry.description || 'No update noted'}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              color="inherit"
                              onClick={() => void deleteTimeEntry.mutateAsync(entry.id)}
                            >
                              Undo
                            </Button>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Section>

                <Section title="Work updates">
                  <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                    {(task.comments ?? []).map((item) => (
                      <Stack key={item.id} direction="row" spacing={1.25} alignItems="flex-start">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 12 }}>
                          {item.user ? `${item.user.firstName[0]}${item.user.lastName[0]}` : '?'}
                        </Avatar>
                        <Box sx={{ flex: 1, bgcolor: '#FFFEFB', border: '1px solid #EDE6DB', borderRadius: 2, p: 1.25 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Teammate'}
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </Typography>
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.25 }}>
                            {item.content}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                    {(task.comments ?? []).length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Updates from time logs show up here.
                      </Typography>
                    )}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Post without logging time…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void addComment();
                      }}
                    />
                    <Button variant="outlined" onClick={() => void addComment()} disabled={!comment.trim()}>
                      Post
                    </Button>
                  </Stack>
                </Section>

                {task.parentTaskId && (
                  <Button onClick={() => setActiveId(task.parentTaskId!)}>Back to parent issue</Button>
                )}
              </Stack>
            )}
          </Box>

          {task && primaryAction && (
            <Box
              sx={{
                px: 3,
                py: 2,
                borderTop: '1px solid #E7E0D6',
                bgcolor: '#FFFCF7',
              }}
            >
              <Button
                fullWidth
                size="large"
                variant="contained"
                endIcon={<ArrowForward />}
                disabled={busy}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={1600}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

export function CreateTaskDialog({
  open,
  onClose,
  projectId,
  sprintId,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  sprintId?: string;
}) {
  const projects = useProjects();
  const categories = useCategories();
  const members = useMembers();
  const createTask = useCreateTask();
  const [form, setForm] = useState({
    projectId: projectId ?? '',
    title: '',
    description: '',
    categoryId: '',
    priority: 'MEDIUM',
    assigneeId: '',
    dueDate: '',
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      projectId: projectId ?? current.projectId ?? projects.data?.[0]?.id ?? '',
      categoryId: current.categoryId || categories.data?.[0]?.id || '',
    }));
  }, [projectId, projects.data, categories.data]);

  async function submit() {
    await createTask.mutateAsync({
      ...form,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || undefined,
      sprintId: sprintId || null,
    });
    onClose();
    setForm((current) => ({ ...current, title: '', description: '' }));
  }

  if (!open) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, bgcolor: '#F7F3EC' } }}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          New work
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
          What’s the next thing?
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Keep the title short. You can add details after.
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Title"
            placeholder="e.g. Fix login timeout on mobile"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            autoFocus
          />
          <TextField
            select
            label="Project"
            value={form.projectId}
            onChange={(event) => setForm({ ...form, projectId: event.target.value })}
          >
            {(projects.data ?? []).map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Type"
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
          >
            {(categories.data ?? []).map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Who should own this?"
            value={form.assigneeId}
            onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
          >
            <MenuItem value="">Decide later</MenuItem>
            {(members.data ?? []).map((member) => (
              <MenuItem key={member.userId} value={member.userId}>
                {member.user ? `${member.user.firstName} ${member.user.lastName}` : member.userId}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
            multiline
            minRows={3}
            placeholder="Optional details for this task"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <Button
            size="large"
            variant="contained"
            disabled={!form.title || !form.projectId || createTask.isPending}
            onClick={() => void submit()}
          >
            Create issue
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
