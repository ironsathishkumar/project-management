# Development Roadmap

## Phase 0 — Product Definition
Finalize:
- Vision
- Roles
- Permissions
- Workspace
- Project
- Workflow
- Status
- Category
- Task
- Filters
- Views
- User journeys

No production coding until the core business rules are approved.

## Phase 1 — Foundation
- Repository
- Frontend
- Backend
- MongoDB
- Environment
- Logging
- Error handling
- Authentication
- Testing setup

## Phase 2 — Workspace
- Workspace
- Members
- Roles
- Permissions

## Phase 3 — Projects
- Project CRUD
- Project members
- Project settings

## Phase 4 — Workflow
- Workflow CRUD
- Dynamic statuses
- Status categories
- Ordering
- Optional transitions

## Phase 5 — Tasks
- Task CRUD
- Category
- Priority
- Tags
- Assignment
- Dates

## Phase 6 — Views
- Kanban
- List
- My Tasks
- Calendar

## Phase 7 — Filtering
- Dynamic filters
- Sorting
- Grouping
- Saved views

## Phase 8 — Collaboration
- Comments
- Attachments
- Activity
- Notifications

## Phase 9 — Planning
- Subtasks
- Dependencies
- Milestones
- Timeline
- Implementation tracking

## Phase 10 — Analytics
- Dashboard
- Reports
- Workload
- Progress

## Phase 11 — Central Platform
Later integrate:
- Application management
- Features
- Plans
- Pricing
- Usage
- Subscriptions
- Revenue
- Application analytics

## Development Style

Build vertically by feature:

```text
Feature
 ↓
Backend
 ↓
API
 ↓
Frontend
 ↓
UI
 ↓
Tests
 ↓
Complete
```

Do not build the entire backend first and postpone frontend integration until the end.
