'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useNavigation, useNotifications, useProjects } from '@/hooks/useApi';
import { isWorkspaceAdmin } from '@/lib/permissions';
import { getLastProjectId, setLastProjectId } from '@/lib/projectPreference';
import type { NavMenuIcon, NavMenuItem } from '@/types';
import {
  AssignmentOutlined,
  CalendarMonthOutlined,
  DashboardOutlined,
  FolderOutlined,
  HubOutlined,
  InsightsOutlined,
  Inventory2Outlined,
  DevicesOutlined,
  LogoutOutlined,
  NotificationsNoneOutlined,
  PeopleOutlined,
  SearchOutlined,
  SettingsOutlined,
  TimelineOutlined,
  ViewKanbanOutlined,
  ViewListOutlined,
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';

const DRAWER_WIDTH = 260;

function menuIcon(icon: NavMenuIcon) {
  const props = { fontSize: 'small' as const };
  switch (icon) {
    case 'dashboard':
    case 'overview':
      return <DashboardOutlined {...props} />;
    case 'folder':
      return <FolderOutlined {...props} />;
    case 'people':
      return <PeopleOutlined {...props} />;
    case 'tasks':
    case 'list':
      return icon === 'list' ? <ViewListOutlined {...props} /> : <AssignmentOutlined {...props} />;
    case 'calendar':
      return <CalendarMonthOutlined {...props} />;
    case 'reports':
      return <InsightsOutlined {...props} />;
    case 'settings':
      return <SettingsOutlined {...props} />;
    case 'board':
      return <ViewKanbanOutlined {...props} />;
    case 'backlog':
      return <Inventory2Outlined {...props} />;
    case 'timeline':
      return <TimelineOutlined {...props} />;
    case 'integrations':
      return <HubOutlined {...props} />;
    default:
      return <FolderOutlined {...props} />;
  }
}

function sortMenus(items: NavMenuItem[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const { user, workspaces, workspace, setWorkspaceId, logout, logoutEverywhere, loading } = useAuth();
  const notifications = useNotifications();
  const projects = useProjects();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [rememberedProjectId, setRememberedProjectId] = useState('');

  const routeProjectId = typeof params.projectId === 'string' ? params.projectId : undefined;
  const isProjectRoute = pathname.startsWith('/projects/') && Boolean(routeProjectId);
  const isBoardRoute = Boolean(routeProjectId && pathname.endsWith('/board'));
  const isBacklogRoute = Boolean(routeProjectId && pathname.endsWith('/backlog'));
  const isImmersiveRoute = isBoardRoute || isBacklogRoute;
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);
  const selectedProjectId = routeProjectId ?? rememberedProjectId;
  const navigation = useNavigation(routeProjectId);

  const unread = useMemo(
    () => (notifications.data ?? []).filter((item) => !item.isRead).length,
    [notifications.data]
  );

  const selectedProject = useMemo(
    () => (projects.data ?? []).find((project) => project.id === selectedProjectId) ?? null,
    [projects.data, selectedProjectId]
  );

  const sideNav = useMemo(() => {
    const data = navigation.data;
    if (!data) return [] as NavMenuItem[];
    if (isProjectRoute && routeProjectId) {
      return sortMenus(data.projectSide);
    }
    return sortMenus(data.workspace);
  }, [navigation.data, isProjectRoute, routeProjectId]);

  const workspaceHomeHref = useMemo(() => {
    const home = navigation.data?.workspace.find((item) => item.key === 'home');
    return home?.href ?? '/projects';
  }, [navigation.data]);

  const projectsListHref = useMemo(() => {
    const projectsItem = navigation.data?.workspace.find((item) => item.key === 'projects');
    return projectsItem?.href ?? '/projects';
  }, [navigation.data]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!workspace?.id || !projects.data) return;
    const list = projects.data;
    const stored = getLastProjectId(workspace.id);
    const validStored = stored && list.some((project) => project.id === stored) ? stored : null;

    if (routeProjectId) {
      setLastProjectId(workspace.id, routeProjectId);
      setRememberedProjectId(routeProjectId);
      return;
    }

    if (list.length === 1) {
      const onlyId = list[0].id;
      setLastProjectId(workspace.id, onlyId);
      setRememberedProjectId(onlyId);
      if (!isAdmin && (pathname === '/home' || pathname === '/projects' || pathname === '/')) {
        router.replace(`/projects/${onlyId}/board`);
      }
      return;
    }

    if (validStored) {
      setRememberedProjectId(validStored);
      if (!isAdmin && (pathname === '/home' || pathname === '/')) {
        router.replace(`/projects/${validStored}/board`);
      }
    }
  }, [workspace?.id, projects.data, routeProjectId, pathname, router, isAdmin]);

  if (loading || !user) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#F4F1EA' }}>
        Loading workspace…
      </div>
    );
  }

  function openProjectBoard(projectId: string) {
    if (workspace?.id) setLastProjectId(workspace.id, projectId);
    setRememberedProjectId(projectId);
    router.push(`/projects/${projectId}/board`);
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#17324D',
            color: '#F8EFE4',
            borderRight: 0,
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <Typography variant="h5" sx={{ color: '#F4E4C1' }}>
            Project Tracker
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(248,239,228,0.72)', mt: 0.5 }}>
            {isAdmin ? 'Admin workspace' : 'Your projects'}
          </Typography>
        </Box>

        <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {isAdmin && (
            <>
              <Typography variant="caption" sx={{ color: 'rgba(248,239,228,0.55)', px: 0.5 }}>
                Workspace
              </Typography>
              <Select
                fullWidth
                size="small"
                value={workspace?.id ?? ''}
                onChange={(event) => setWorkspaceId(event.target.value)}
                sx={{
                  color: '#F8EFE4',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '.MuiOutlinedInput-notchedOutline': { border: 0 },
                  '.MuiSvgIcon-root': { color: '#F8EFE4' },
                }}
              >
                {workspaces.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </>
          )}

          <Typography variant="caption" sx={{ color: 'rgba(248,239,228,0.55)', px: 0.5, mt: 0.5 }}>
            {isAdmin ? 'Project' : 'Your project'}
          </Typography>
          <Select
            fullWidth
            size="small"
            displayEmpty
            value={selectedProjectId}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                if (isAdmin) router.push('/projects');
                return;
              }
              openProjectBoard(value);
            }}
            renderValue={(value) => {
              if (!value) return isAdmin ? 'All projects' : 'Select a project';
              const project = (projects.data ?? []).find((item) => item.id === value);
              return project ? `${project.key} · ${project.name}` : 'Select a project';
            }}
            sx={{
              color: '#F8EFE4',
              bgcolor: 'rgba(255,255,255,0.08)',
              '.MuiOutlinedInput-notchedOutline': { border: 0 },
              '.MuiSvgIcon-root': { color: '#F8EFE4' },
            }}
          >
            {isAdmin && (
              <MenuItem value="">
                <em>All projects</em>
              </MenuItem>
            )}
            {(projects.data ?? []).map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.key} · {project.name}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 2 }}>
          {isProjectRoute && selectedProject && (
            <Typography
              variant="caption"
              sx={{ color: 'rgba(248,239,228,0.55)', px: 1.5, pt: 1, display: 'block' }}
            >
              {selectedProject.key} · delivery
            </Typography>
          )}
          <List dense>
            {sideNav.map((item) => {
              const selected =
                pathname === item.href ||
                (item.href !== '/projects' && pathname.startsWith(`${item.href}`));
              return (
                <ListItemButton
                  key={item.key}
                  component={Link}
                  href={item.href}
                  selected={selected}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    color: '#F8EFE4',
                    '&.Mui-selected': { bgcolor: 'rgba(244,228,193,0.16)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>{menuIcon(item.icon)}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              );
            })}
          </List>

          {isProjectRoute && (
            <>
              <Divider sx={{ borderColor: 'rgba(248,239,228,0.12)', my: 1.5, mx: 1 }} />
              <List dense>
                <ListItemButton
                  component={Link}
                  href={projectsListHref}
                  sx={{ borderRadius: 2, color: '#F8EFE4' }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>
                    <FolderOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={isAdmin ? 'All projects' : 'My projects'} />
                </ListItemButton>
                {navigation.data?.workspace.some((item) => item.key === 'home') && (
                  <ListItemButton
                    component={Link}
                    href={workspaceHomeHref}
                    sx={{ borderRadius: 2, color: '#F8EFE4' }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>
                      <DashboardOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Workspace home" />
                  </ListItemButton>
                )}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: '#FFFCF7',
            color: 'text.primary',
            borderBottom: '1px solid #E7E0D6',
            flexShrink: 0,
          }}
        >
          <Toolbar sx={{ gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                bgcolor: '#F4F1EA',
                flex: 1,
                maxWidth: 420,
              }}
            >
              <SearchOutlined fontSize="small" color="action" />
              <InputBase
                fullWidth
                placeholder="Search…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && query.trim().length >= 2) {
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  }
                }}
              />
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton component={Link} href="/notifications">
              <Badge badgeContent={unread} color="error">
                <NotificationsNoneOutlined />
              </Badge>
            </IconButton>
            <IconButton onClick={(event) => setAnchor(event.currentTarget)}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#17324D', fontSize: 14 }}>
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </Avatar>
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem disabled>
                {user.firstName} {user.lastName}
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchor(null);
                  void logout();
                }}
              >
                <ListItemIcon>
                  <LogoutOutlined fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchor(null);
                  void logoutEverywhere();
                }}
              >
                <ListItemIcon>
                  <DevicesOutlined fontSize="small" />
                </ListItemIcon>
                Sign out of all devices
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: isImmersiveRoute ? 'hidden' : 'auto',
            bgcolor: '#F4F1EA',
            p: isImmersiveRoute ? 0 : { xs: 2, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
