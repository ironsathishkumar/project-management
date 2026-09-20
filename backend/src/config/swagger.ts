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
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': { post: { summary: 'Register', security: [], tags: ['Auth'] } },
    '/auth/login': { post: { summary: 'Login', security: [], tags: ['Auth'] } },
    '/auth/refresh': { post: { summary: 'Refresh tokens', security: [], tags: ['Auth'] } },
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
  },
};
