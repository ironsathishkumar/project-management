# Users, Roles & Permissions

## Default Roles

### Owner
Highest application/workspace authority.

### Admin
Manages workspace configuration, members, projects, and permitted settings.

### Member
Creates and works on tasks and collaborates.

### Viewer
Read-only access.

## Role Model
Roles should be permission collections rather than hard-coded behavior.

```text
User
 ↓
Workspace Membership
 ↓
Role
 ↓
Permissions
```

## Suggested Permission Groups

### Workspace
- workspace.view
- workspace.update
- workspace.delete

### Members
- member.view
- member.invite
- member.update
- member.remove

### Projects
- project.view
- project.create
- project.update
- project.archive
- project.delete

### Tasks
- task.view
- task.create
- task.update
- task.delete
- task.assign
- task.move
- task.comment

### Workflow
- workflow.view
- workflow.create
- workflow.update
- workflow.delete

### Categories
- category.view
- category.create
- category.update
- category.delete

### Reports
- report.view

## Project-Level Membership
A user may have different project access within the same workspace.

```text
User: Sathish
Workspace Role: Member

Project A: Manager
Project B: Member
Project C: Viewer
```

The effective permission should be calculated from workspace/project membership according to finalized rules.

## Authorization Rule
The backend must always verify:
1. User identity
2. Workspace membership
3. Project membership where applicable
4. Permission
5. Requested action
