# Project Management Functional Requirements

## Workspace
A workspace contains members, projects, workflows, categories, saved views, custom fields, and settings.

## Project
A project contains:
- Overview
- Board
- List
- Calendar
- Timeline
- Tasks
- Milestones
- Activity
- Settings

## Task
Required:
- title
- project
- status
- category

Optional:
- description
- assignee
- priority
- start date
- due date
- tags
- attachments
- subtasks
- dependencies
- custom fields

## Status
Statuses are dynamic and belong to workflows.

Suggested system categories:
- NOT_STARTED
- IN_PROGRESS
- COMPLETED
- CANCELLED

A status has:
- name
- category
- order
- color/icon metadata
- default/final flags as required

## Workflow
A workflow contains statuses and optionally allowed transitions.

Example:

```text
To Do → Development → Review → Testing → Done
```

## Category
Categories classify work.

Examples:
- Feature
- Bug
- Improvement
- Research
- Documentation
- Request

Categories are dynamic.

## Priority
Default:
- Low
- Medium
- High
- Urgent

## Tags
Flexible keywords such as:
- frontend
- backend
- authentication
- payment
- v2

## Subtasks
A task can contain smaller tasks.

## Dependencies
Initial types:
- Blocks
- Blocked By
- Related To

## Milestones
Major project targets.

## Implementation Tracking
A feature can be tracked through:

```text
Requirement
 → Design
 → Development
 → Code Review
 → Testing
 → UAT
 → Deployment
 → Completed
```

This may use workflow/status concepts rather than introducing a second unrelated status engine. Final modeling decision should be made during requirements review.

## Comments
Tasks support collaboration.

## Activity
Important mutations create activity records.

## Notifications
Initial events:
- assigned
- mentioned
- status changed
- comment added
- due soon
- overdue

## Search
Search projects, tasks, users, comments, and milestones.

## Reports
Initial:
- project progress
- task completion
- overdue tasks
- team workload
- status distribution
- category distribution
