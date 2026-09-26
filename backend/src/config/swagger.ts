export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Project Tracker API',
    version: '1.0.0',
    description: 'REST API for the project management and implementation tracker',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      appApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': { post: { summary: 'Register', security: [], tags: ['Auth'] } },
    '/auth/login': { post: { summary: 'Login', security: [], tags: ['Auth'] } },
    '/auth/refresh': {
      post: {
        summary: 'Get a new access token using the httpOnly refresh cookie (rotates the refresh token)',
        security: [],
        tags: ['Auth'],
      },
    },
    '/auth/logout': { post: { summary: 'Sign out this session and clear the refresh cookie', security: [], tags: ['Auth'] } },
    '/auth/logout-all': { post: { summary: 'Sign out every session of the current user', tags: ['Auth'] } },
    '/auth/sessions': { get: { summary: 'List active sessions of the current user', tags: ['Auth'] } },
    '/auth/sessions/{sessionId}': { delete: { summary: 'Sign out one session', tags: ['Auth'] } },
    '/auth/me': { get: { summary: 'Current user', tags: ['Auth'] } },
    '/workspaces': {
      get: { summary: 'List workspaces', tags: ['Workspaces'] },
      post: { summary: 'Create workspace', tags: ['Workspaces'] },
    },
    '/projects': {
      get: { summary: 'List projects', tags: ['Projects'] },
      post: { summary: 'Create project', tags: ['Projects'] },
    },
    '/workflows': { get: { summary: 'List workflows', tags: ['Workflows'] } },
    '/categories': { get: { summary: 'List categories', tags: ['Categories'] } },
    '/tasks': {
      get: { summary: 'List tasks with filters', tags: ['Tasks'] },
      post: { summary: 'Create task', tags: ['Tasks'] },
    },
    '/reports/summary': { get: { summary: 'Workspace reports', tags: ['Reports'] } },
    '/search': { get: { summary: 'Global search', tags: ['Search'] } },
    '/imports/document/preview': { post: { summary: 'Preview a document import (admin)', tags: ['Imports'] } },
    '/imports/document/apply': { post: { summary: 'Apply a document import (admin)', tags: ['Imports'] } },
    '/integrations': {
      get: { summary: 'List connected apps (admin)', tags: ['Integrations'] },
      post: { summary: 'Connect an app and issue its API key (admin)', tags: ['Integrations'] },
    },
    '/integrations/{integrationId}/rotate': {
      post: { summary: 'Issue a new API key (admin)', tags: ['Integrations'] },
    },
    '/app/me': {
      get: { summary: 'Connected project and valid statuses', tags: ['App API'], security: [{ appApiKey: [] }] },
    },
    '/app/tasks': {
      get: { summary: 'List project tasks', tags: ['App API'], security: [{ appApiKey: [] }] },
      post: {
        summary: 'Create or update a task by externalKey',
        tags: ['App API'],
        security: [{ appApiKey: [] }],
      },
    },
    '/app/tasks/bulk': {
      post: { summary: 'Create or update up to 500 tasks', tags: ['App API'], security: [{ appApiKey: [] }] },
    },
    '/app/tasks/{ref}': {
      get: { summary: 'Get a task by key (BANK-4) or externalKey', tags: ['App API'], security: [{ appApiKey: [] }] },
      patch: {
        summary: 'Update status, title, description, priority or add a comment',
        tags: ['App API'],
        security: [{ appApiKey: [] }],
      },
    },
    '/app/tasks/{ref}/comments': {
      post: { summary: 'Comment on a task', tags: ['App API'], security: [{ appApiKey: [] }] },
    },
    '/app/document': {
      post: {
        summary: 'Sync the implementation document (multipart "file", ?dryRun=true to preview)',
        tags: ['App API'],
        security: [{ appApiKey: [] }],
      },
    },
  },
};
