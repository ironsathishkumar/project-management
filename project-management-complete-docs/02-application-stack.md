# Application Stack

## Frontend
- Next.js
- TypeScript
- App Router
- MUI
- TanStack Query
- React Hook Form
- Zod
- dnd-kit
- Recharts
- date-fns

## Rendering Strategy
Use a **server-first architecture**.

Server Components / server rendering:
- Dashboard
- Project pages
- Initial task/list data
- Reports
- Settings
- Read-heavy screens

Client Components only where interaction requires them:
- Kanban drag/drop
- Task drawer
- Interactive forms
- Dynamic filters
- Comments
- Optimistic updates

Do not make the whole application client-rendered.

## Backend
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT
- Argon2
- Zod
- Winston
- Swagger/OpenAPI
- Helmet
- CORS
- express-rate-limit

## State
- TanStack Query for server state
- React state for local UI state
- React Hook Form for forms
- No Redux initially

## API
REST API, versioned under `/api/v1`.

## Testing
- Jest
- Supertest
- Vitest
- React Testing Library
- Playwright

## Development
- Git
- ESLint
- Husky
- lint-staged
- pnpm
- Docker

## Initially excluded
- Redis
- GraphQL
- Tailwind CSS
- Socket.IO
- Microservices
- Kubernetes

These can be introduced only when an actual requirement justifies them.

## Storage
Use a storage abstraction rather than tightly coupling the application to one provider.

```text
Application
  ↓
Storage Service
  ↓
Provider
```

## Architecture Flow

```text
Browser
  ↓
Next.js Server / Client UI
  ↓
Express API
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Mongoose
  ↓
MongoDB
```
