import { ROLE_KEYS } from '../config/constants';

export type MenuIcon =
  | 'dashboard'
  | 'folder'
  | 'people'
  | 'tasks'
  | 'calendar'
  | 'reports'
  | 'settings'
  | 'board'
  | 'backlog'
  | 'list'
  | 'timeline'
  | 'overview'
  | 'integrations';

export interface NavMenuItem {
  key: string;
  label: string;
  href: string;
  icon: MenuIcon;
  order: number;
}

function isAdminRole(roleKey: string) {
  return roleKey === ROLE_KEYS.OWNER || roleKey === ROLE_KEYS.ADMIN;
}

function workspaceMenus(roleKey: string): NavMenuItem[] {
  if (isAdminRole(roleKey)) {
    return [
      { key: 'home', label: 'Home', href: '/home', icon: 'dashboard', order: 10 },
      { key: 'projects', label: 'Projects', href: '/projects', icon: 'folder', order: 20 },
      { key: 'users', label: 'Users', href: '/users', icon: 'people', order: 30 },
      { key: 'tasks', label: 'My Tasks', href: '/tasks', icon: 'tasks', order: 40 },
      { key: 'calendar', label: 'Calendar', href: '/calendar', icon: 'calendar', order: 50 },
      { key: 'reports', label: 'Reports', href: '/reports', icon: 'reports', order: 60 },
      { key: 'integrations', label: 'Integrations', href: '/integrations', icon: 'integrations', order: 65 },
      { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings', order: 70 },
    ];
  }

  return [
    { key: 'projects', label: 'My projects', href: '/projects', icon: 'folder', order: 10 },
    { key: 'tasks', label: 'My Tasks', href: '/tasks', icon: 'tasks', order: 20 },
  ];
}

function projectMenus(projectId: string, roleKey: string): NavMenuItem[] {
  const base = `/projects/${projectId}`;
  const items: NavMenuItem[] = [
    { key: 'overview', label: 'Overview', href: `${base}/overview`, icon: 'overview', order: 10 },
    { key: 'board', label: 'Board', href: `${base}/board`, icon: 'board', order: 20 },
    { key: 'backlog', label: 'Backlog', href: `${base}/backlog`, icon: 'backlog', order: 30 },
    { key: 'list', label: 'List', href: `${base}/list`, icon: 'list', order: 40 },
    { key: 'calendar', label: 'Calendar', href: `${base}/calendar`, icon: 'calendar', order: 50 },
    { key: 'timeline', label: 'Timeline', href: `${base}/timeline`, icon: 'timeline', order: 60 },
  ];

  if (isAdminRole(roleKey)) {
    items.push({
      key: 'settings',
      label: 'Settings',
      href: `${base}/settings`,
      icon: 'settings',
      order: 70,
    });
  }

  return items;
}

/** Side-nav subset used inside a project context (board immersion). */
function projectSideMenus(projectId: string, roleKey: string): NavMenuItem[] {
  const base = `/projects/${projectId}`;
  const items: NavMenuItem[] = [
    { key: 'board', label: 'Board', href: `${base}/board`, icon: 'board', order: 10 },
    { key: 'backlog', label: 'Backlog', href: `${base}/backlog`, icon: 'backlog', order: 20 },
    { key: 'list', label: 'List', href: `${base}/list`, icon: 'list', order: 30 },
    { key: 'calendar', label: 'Calendar', href: `${base}/calendar`, icon: 'calendar', order: 40 },
  ];

  if (isAdminRole(roleKey)) {
    items.push({
      key: 'settings',
      label: 'Project settings',
      href: `${base}/settings`,
      icon: 'settings',
      order: 50,
    });
  }

  return items;
}

export const navigationService = {
  forContext(input: { roleKey: string; projectId?: string }) {
    const isAdmin = isAdminRole(input.roleKey);
    return {
      roleKey: input.roleKey,
      isAdmin,
      workspace: workspaceMenus(input.roleKey),
      project: input.projectId ? projectMenus(input.projectId, input.roleKey) : [],
      projectSide: input.projectId ? projectSideMenus(input.projectId, input.roleKey) : [],
    };
  },
};
