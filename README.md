# Project Tracker

Simple project management and implementation tracking. Built from the product docs in `project-management-complete-docs/`.

## Stack
- Frontend: Next.js App Router, TypeScript, MUI, TanStack Query
- Backend: Express, TypeScript, MongoDB, Mongoose, JWT, Argon2
- API: REST under `/api/v1`

## Run locally

```bash
pnpm install
pnpm dev
```

Optional MongoDB with Docker:

```bash
docker compose up -d mongo
```

If MongoDB is not running, the API starts an in-memory database and seeds demo data automatically.

- App: http://localhost:3000
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/docs

## Demo login
- Email: `owner@tracker.local`
- Password: `ChangeMe123!`

Additional seeded users: `member@tracker.local` and `viewer@tracker.local` (same password).

## What is included
- Auth, workspaces, members, roles and permissions
- Projects, workflows, dynamic statuses and categories
- Tasks, assignment, priorities, tags, comments, activity
- Kanban, list, calendar, timeline, my tasks
- Shared filter engine and saved views
- Reports, search, notifications
- Subtasks, dependencies, milestones, attachments
