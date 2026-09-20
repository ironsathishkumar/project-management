import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { ensureSystemRoles } from '../src/services/role.service';

describe('API foundation', () => {
  let mongo: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await ensureSystemRoles();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('registers, creates a workspace, project and task', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Test',
      lastName: 'Owner',
      email: 'owner@test.local',
      password: 'Password123!',
    });
    expect(register.status).toBe(201);
    const token = register.body.data.accessToken as string;

    const workspace = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme' });
    expect(workspace.status).toBe(201);
    const workspaceId = workspace.body.data.id as string;

    const projects = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);
    expect(projects.status).toBe(200);

    const createdProject = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Delivery' });
    expect(createdProject.status).toBe(201);

    const categories = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);
    expect(categories.status).toBe(200);
    const categoryId = categories.body.data[0].id as string;

    const task = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        projectId: createdProject.body.data.id,
        title: 'Ship MVP',
        categoryId,
      });
    expect(task.status).toBe(201);
    expect(task.body.data.title).toBe('Ship MVP');
  });
});
