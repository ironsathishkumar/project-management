'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import {
  useInviteMember,
  useMembers,
  useProjectMembers,
  useProjectRoles,
  useProjects,
  useRemoveMember,
  useUpdateMember,
} from '@/hooks/useApi';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  PersonAddOutlined,
  BlockOutlined,
  CheckCircleOutline,
  DeleteOutline,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

const WORKSPACE_ROLES = [
  { key: 'ADMIN', label: 'Admin' },
  { key: 'MEMBER', label: 'Member' },
  { key: 'VIEWER', label: 'Viewer' },
] as const;

function UsersContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const members = useMembers();
  const projects = useProjects();
  const inviteMember = useInviteMember();
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleKey: 'MEMBER',
  });

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const projectRoles = useProjectRoles(selectedProjectId || undefined);
  const projectMembers = useProjectMembers(selectedProjectId || undefined);
  const [assign, setAssign] = useState({ userId: '', projectRole: '' });
  const [roleForm, setRoleForm] = useState({ name: '', permissionLevel: 'MEMBER' });

  useEffect(() => {
    if (!selectedProjectId && projects.data?.[0]) {
      setSelectedProjectId(projects.data[0].id);
    }
  }, [projects.data, selectedProjectId]);

  useEffect(() => {
    if (projectRoles.data?.[0] && !assign.projectRole) {
      const preferred =
        projectRoles.data.find((role) => role.key === 'FULL_STACK') ?? projectRoles.data[0];
      setAssign((current) => ({ ...current, projectRole: preferred.key }));
    }
  }, [projectRoles.data, assign.projectRole]);

  const workspaceUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members.data ?? []).filter((member) => {
      if (roleFilter && member.role?.key !== roleFilter) return false;
      if (statusFilter && member.status !== statusFilter) return false;
      if (!q) return true;
      const name = `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.toLowerCase();
      const email = (member.user?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members.data, search, roleFilter, statusFilter]);

  const activeCount = (members.data ?? []).filter((m) => m.status === 'ACTIVE').length;
  const adminCount = (members.data ?? []).filter(
    (m) => m.role?.key === 'OWNER' || m.role?.key === 'ADMIN'
  ).length;

  async function onAddUser() {
    setError('');
    setMessage('');
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    try {
      await inviteMember.mutateAsync({
        email: form.email.trim(),
        roleKey: form.roleKey,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        password: form.password.trim() || undefined,
      });
      setMessage('User added to workspace');
      setForm({ email: '', firstName: '', lastName: '', password: '', roleKey: 'MEMBER' });
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to add user');
    }
  }

  async function onChangeRole(memberId: string, roleKey: string) {
    setError('');
    try {
      await updateMember.mutateAsync({ memberId, roleKey });
      setMessage('Workspace role updated');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to update role');
    }
  }

  async function onToggleStatus(memberId: string, status: string) {
    setError('');
    try {
      await updateMember.mutateAsync({
        memberId,
        status: status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      });
      setMessage(status === 'ACTIVE' ? 'User disabled' : 'User re-enabled');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to update status');
    }
  }

  async function onConfirmRemove() {
    if (!removeId) return;
    setError('');
    try {
      await removeMember.mutateAsync(removeId);
      setMessage('User removed from workspace');
      setRemoveId(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to remove user');
    }
  }

  async function assignToProject() {
    if (!selectedProjectId || !assign.userId || !assign.projectRole) return;
    setError('');
    try {
      await api(`/projects/${selectedProjectId}/members`, {
        method: 'POST',
        body: JSON.stringify(assign),
      });
      setMessage('Project access assigned');
      setAssign((current) => ({ ...current, userId: '' }));
      void queryClient.invalidateQueries({ queryKey: ['project-members', selectedProjectId] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to assign project role');
    }
  }

  async function updateProjectRole(memberId: string, projectRole: string) {
    await api(`/projects/${selectedProjectId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectRole }),
    });
    void queryClient.invalidateQueries({ queryKey: ['project-members', selectedProjectId] });
  }

  async function removeFromProject(memberId: string) {
    await api(`/projects/${selectedProjectId}/members/${memberId}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['project-members', selectedProjectId] });
    setMessage('Removed from project');
  }

  async function createProjectRole() {
    if (!selectedProjectId || !roleForm.name.trim()) return;
    await api(`/projects/${selectedProjectId}/roles`, {
      method: 'POST',
      body: JSON.stringify(roleForm),
    });
    setRoleForm({ name: '', permissionLevel: 'MEMBER' });
    void queryClient.invalidateQueries({ queryKey: ['project-roles', selectedProjectId] });
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">User management</Typography>
          <Typography color="text.secondary">
            Add people to this workspace, set roles, and control project access.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddOutlined />}
          onClick={() => {
            setError('');
            setAddOpen(true);
          }}
        >
          Add user
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        {[
          ['Members', members.data?.length ?? 0],
          ['Active', activeCount],
          ['Admins', adminCount],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {label}
              </Typography>
              <Typography variant="h4">{value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ mb: 2 }}
            alignItems={{ md: 'center' }}
          >
            <Typography fontWeight={700} sx={{ flex: 1 }}>
              Workspace members
            </Typography>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 200 }}
            />
            <TextField
              select
              size="small"
              label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All roles</MenuItem>
              <MenuItem value="OWNER">Owner</MenuItem>
              {WORKSPACE_ROLES.map((role) => (
                <MenuItem key={role.key} value={role.key}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="DISABLED">Disabled</MenuItem>
            </TextField>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Workspace role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workspaceUsers.map((member) => {
                const isOwner = member.role?.key === 'OWNER';
                const isSelf = member.userId === user?.id;
                return (
                  <TableRow key={member.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>
                        {member.user
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.userId}
                      </Typography>
                      {isSelf && (
                        <Typography variant="caption" color="text.secondary">
                          You
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{member.user?.email ?? '—'}</TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Chip size="small" color="primary" label="Owner" />
                      ) : (
                        <TextField
                          select
                          size="small"
                          value={member.role?.key ?? 'MEMBER'}
                          disabled={updateMember.isPending}
                          onChange={(e) => void onChangeRole(member.id, e.target.value)}
                          sx={{ minWidth: 130 }}
                        >
                          {WORKSPACE_ROLES.map((role) => (
                            <MenuItem key={role.key} value={role.key}>
                              {role.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={member.status}
                        color={member.status === 'ACTIVE' ? 'success' : 'default'}
                        variant={member.status === 'ACTIVE' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!isOwner && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={member.status === 'ACTIVE' ? 'Disable' : 'Enable'}>
                            <span>
                              <IconButton
                                size="small"
                                disabled={isSelf || updateMember.isPending}
                                onClick={() => void onToggleStatus(member.id, member.status)}
                              >
                                {member.status === 'ACTIVE' ? (
                                  <BlockOutlined fontSize="small" />
                                ) : (
                                  <CheckCircleOutline fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Remove from workspace">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={isSelf || removeMember.isPending}
                                onClick={() => setRemoveId(member.id)}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {workspaceUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No members match your filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography fontWeight={700} sx={{ mb: 2 }}>
            Project access
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              select
              label="Project"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setAssign({ userId: '', projectRole: '' });
              }}
              sx={{ minWidth: 220 }}
            >
              {(projects.data ?? []).map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="User"
              value={assign.userId}
              onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
              sx={{ minWidth: 200 }}
            >
              {(members.data ?? [])
                .filter((m) => m.status === 'ACTIVE')
                .map((member) => (
                  <MenuItem key={member.userId} value={member.userId}>
                    {member.user
                      ? `${member.user.firstName} ${member.user.lastName}`
                      : member.userId}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="Project role"
              value={assign.projectRole}
              onChange={(e) => setAssign({ ...assign, projectRole: e.target.value })}
              sx={{ minWidth: 200 }}
            >
              {(projectRoles.data ?? []).map((role) => (
                <MenuItem key={role.id} value={role.key}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => void assignToProject()}>
              Assign
            </Button>
          </Stack>

          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Project role</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(projectMembers.data ?? []).map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.user
                      ? `${member.user.firstName} ${member.user.lastName}`
                      : member.userId}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={member.projectRole}
                      onChange={(e) => void updateProjectRole(member.id, e.target.value)}
                      sx={{ minWidth: 200 }}
                    >
                      {(projectRoles.data ?? []).map((role) => (
                        <MenuItem key={role.id} value={role.key}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => void removeFromProject(member.id)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(projectMembers.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No project members yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Project roles
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {(projectRoles.data ?? []).map((role) => (
              <Chip
                key={role.id}
                label={`${role.name} · ${role.permissionLevel}`}
                sx={{ bgcolor: `${role.color}22`, color: role.color, fontWeight: 600 }}
              />
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="New role name"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              placeholder="QA Engineer"
              fullWidth
            />
            <TextField
              select
              label="Access level"
              value={roleForm.permissionLevel}
              onChange={(e) => setRoleForm({ ...roleForm, permissionLevel: e.target.value })}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="MANAGER">Manager</MenuItem>
              <MenuItem value="MEMBER">Member</MenuItem>
              <MenuItem value="VIEWER">Viewer</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={() => void createProjectRole()}>
              Add role
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Existing accounts are invited by email. For new people, enter name (and optional
              password — defaults to <code>ChangeMe123!</code>).
            </Typography>
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                fullWidth
                helperText="Required for new users"
              />
              <TextField
                label="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              fullWidth
              helperText="Only used when creating a new account"
            />
            <TextField
              select
              label="Workspace role"
              value={form.roleKey}
              onChange={(e) => setForm({ ...form, roleKey: e.target.value })}
            >
              {WORKSPACE_ROLES.map((role) => (
                <MenuItem key={role.key} value={role.key}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={inviteMember.isPending}
            onClick={() => void onAddUser()}
          >
            Add user
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(removeId)} onClose={() => setRemoveId(null)}>
        <DialogTitle>Remove user?</DialogTitle>
        <DialogContent>
          <Typography>
            They will lose workspace access and all project memberships. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={removeMember.isPending}
            onClick={() => void onConfirmRemove()}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function UsersPage() {
  return (
    <RequireAdmin>
      <UsersContent />
    </RequireAdmin>
  );
}
