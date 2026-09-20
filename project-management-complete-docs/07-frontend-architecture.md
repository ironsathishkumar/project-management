# Frontend Architecture

## Recommended Structure

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── (authenticated)/
│   │       ├── layout.tsx
│   │       ├── dashboard/
│   │       ├── projects/
│   │       ├── tasks/
│   │       ├── calendar/
│   │       ├── reports/
│   │       └── settings/
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── project/
│   │   ├── task/
│   │   ├── board/
│   │   ├── filters/
│   │   └── forms/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── workflows/
│   │   ├── categories/
│   │   └── views/
│   │
│   ├── hooks/
│   ├── lib/
│   ├── providers/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── styles/
│
├── .env.development
├── .env.production
└── package.json
```

## Rendering Rule
Server components by default. Add `use client` only where browser interaction/state requires it.

## Data Rule
Prefer server fetching for initial/read-heavy data. Use TanStack Query for interactive mutations and client-managed server state.

## UI Rule
Use MUI theme and component overrides. No Tailwind.

## Task Drawer
Keep task editing contextual so users can update a task without losing the board/list context.
