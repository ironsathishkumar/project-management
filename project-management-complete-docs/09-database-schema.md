# MongoDB Database Schema — Project Management

## Schema Principles

1. MongoDB is the primary database.
2. Mongoose is the ODM.
3. Public/application IDs should be stable UUID-style IDs.
4. MongoDB `_id` remains an internal persistence identifier.
5. Avoid large unbounded arrays on documents.
6. Use references for growing relationships.
7. Keep workspace/project ownership explicit.
8. Dynamic configuration should be data-driven, not hard-coded.
9. Index fields used frequently for lookup/filtering.
10. Database rules must reflect finalized business rules before implementation.

---

# 1. users

Purpose: authentication identity and user profile.

```text
users
├── _id
├── id                string, unique
├── firstName         string, required
├── lastName          string, required
├── email             string, required, unique
├── passwordHash      string, required
├── phoneNumber       string, optional
├── profileImage      string, optional
├── address           object, optional
├── dateOfBirth       date, optional
├── gender            string, optional
├── emergencyContact  object, optional
├── bloodGroup        string, optional
├── isActive          boolean
├── createdAt
└── updatedAt
```

Do not store workspace/project roles directly on the user if membership can vary by workspace/project.

---

# 2. workspaces

```text
workspaces
├── _id
├── id
├── name
├── slug
├── description
├── logo
├── ownerId
├── settings
├── isActive
├── createdAt
└── updatedAt
```

`ownerId` references `users.id`.

---

# 3. roles

Roles can be workspace/application scoped.

```text
roles
├── _id
├── id
├── workspaceId       optional for custom roles
├── name
├── key
├── description
├── isSystemRole
├── permissions[]
├── isActive
├── createdAt
└── updatedAt
```

System roles may include:
- OWNER
- ADMIN
- MEMBER
- VIEWER

---

# 4. workspaceMembers

Use a membership collection instead of embedding all members into the workspace.

```text
workspaceMembers
├── _id
├── id
├── workspaceId
├── userId
├── roleId
├── status
├── joinedAt
├── invitedAt
├── createdAt
└── updatedAt
```

Recommended unique index:

```text
workspaceId + userId
```

---

# 5. projects

```text
projects
├── _id
├── id
├── workspaceId
├── name
├── key
├── description
├── icon
├── status
├── ownerId
├── workflowId
├── startDate
├── dueDate
├── archivedAt
├── createdAt
└── updatedAt
```

Recommended project lifecycle status can be separate from task status if needed.

---

# 6. projectMembers

```text
projectMembers
├── _id
├── id
├── projectId
├── userId
├── roleId / projectRole
├── joinedAt
├── createdAt
└── updatedAt
```

Recommended unique index:

```text
projectId + userId
```

---

# 7. workflows

```text
workflows
├── _id
├── id
├── workspaceId
├── name
├── description
├── isDefault
├── isActive
├── createdAt
└── updatedAt
```

A workflow belongs to a workspace and can be assigned to projects.

---

# 8. statuses

```text
statuses
├── _id
├── id
├── workflowId
├── name
├── key
├── category
├── order
├── color
├── icon
├── isDefault
├── isFinal
├── isActive
├── createdAt
└── updatedAt
```

`category` should use stable system meanings:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
CANCELLED
```

Do not use the display name as business logic.

---

# 9. workflowTransitions

If controlled transitions are enabled:

```text
workflowTransitions
├── _id
├── id
├── workflowId
├── fromStatusId
├── toStatusId
├── isAllowed
├── createdAt
└── updatedAt
```

For simple workflows, transitions can be unrestricted.

---

# 10. categories

```text
categories
├── _id
├── id
├── workspaceId
├── name
├── key
├── description
├── color
├── icon
├── order
├── isActive
├── createdAt
└── updatedAt
```

Categories can later be scoped to a project if required.

---

# 11. tasks

```text
tasks
├── _id
├── id
├── workspaceId
├── projectId
├── parentTaskId       optional
├── title
├── description
├── statusId
├── categoryId
├── priority
├── assigneeId
├── creatorId
├── startDate
├── dueDate
├── completedAt
├── order
├── customFields       optional / schema strategy TBD
├── createdAt
└── updatedAt
```

Important:
- `statusId` references a status.
- `categoryId` references a category.
- `parentTaskId` supports subtasks.
- `assigneeId` initially represents one primary assignee.

---

# 12. tags

If tags are shared across workspace:

```text
tags
├── _id
├── id
├── workspaceId
├── name
├── key
├── color
├── createdAt
└── updatedAt
```

---

# 13. taskTags

Avoid a huge embedded tag array if tag relationships grow.

```text
taskTags
├── _id
├── id
├── taskId
├── tagId
└── createdAt
```

Unique index:

```text
taskId + tagId
```

---

# 14. subtasks

Two implementation options exist.

### Option A — Same tasks collection

Use:

```text
tasks.parentTaskId
```

This is the recommended initial approach.

```text
Parent Task
   |
   +-- Task where parentTaskId = parent.id
```

No separate `subtasks` collection is required initially.

---

# 15. dependencies

```text
taskDependencies
├── _id
├── id
├── workspaceId
├── taskId
├── dependsOnTaskId
├── type
├── createdBy
├── createdAt
└── updatedAt
```

Initial types:

```text
BLOCKS
BLOCKED_BY
RELATED_TO
```

Avoid storing both directions as separate records unless a specific design requires it.

---

# 16. milestones

```text
milestones
├── _id
├── id
├── workspaceId
├── projectId
├── name
├── description
├── status
├── startDate
├── dueDate
├── completedAt
├── ownerId
├── createdAt
└── updatedAt
```

Tasks can optionally reference `milestoneId`.

---

# 17. comments

```text
comments
├── _id
├── id
├── workspaceId
├── projectId
├── taskId
├── userId
├── parentCommentId     optional
├── content
├── editedAt
├── deletedAt
├── createdAt
└── updatedAt
```

---

# 18. activities

```text
activities
├── _id
├── id
├── workspaceId
├── projectId
├── taskId              optional
├── userId
├── action
├── entityType
├── entityId
├── metadata
├── createdAt
└── updatedAt
```

Examples:

```text
TASK_CREATED
TASK_UPDATED
TASK_STATUS_CHANGED
TASK_ASSIGNED
COMMENT_CREATED
PROJECT_CREATED
MEMBER_ADDED
```

Activity should be append-oriented.

---

# 19. notifications

```text
notifications
├── _id
├── id
├── userId
├── workspaceId
├── type
├── title
├── message
├── entityType
├── entityId
├── isRead
├── readAt
├── createdAt
└── updatedAt
```

---

# 20. savedViews

```text
savedViews
├── _id
├── id
├── workspaceId
├── projectId       optional
├── ownerId
├── name
├── viewType
├── filters
├── sorting
├── grouping
├── columns
├── isShared
├── createdAt
└── updatedAt
```

`viewType` examples:

```text
BOARD
LIST
CALENDAR
TIMELINE
```

---

# 21. customFields

Definition:

```text
customFields
├── _id
├── id
├── workspaceId
├── projectId       optional
├── name
├── key
├── fieldType
├── options
├── isRequired
├── order
├── isActive
├── createdAt
└── updatedAt
```

Potential types:

```text
TEXT
NUMBER
DATE
BOOLEAN
SELECT
MULTI_SELECT
USER
```

### Custom field values

The exact storage strategy should be finalized before implementation.

Possible approaches:
1. Embedded values in task documents.
2. Separate taskCustomFieldValues collection.
3. Flexible BSON object with controlled field definitions.

For scalability and filtering, a separate value model may be preferable if custom fields become heavily used.

Do not finalize this part without testing the expected query patterns.

---

# 22. attachments

```text
attachments
├── _id
├── id
├── workspaceId
├── projectId
├── taskId
├── uploadedBy
├── fileName
├── mimeType
├── size
├── storageProvider
├── storageKey
├── url / reference
├── createdAt
└── updatedAt
```

The application should use a storage abstraction.

---

# 23. Indexing Strategy

Initial indexes should cover common access patterns.

### users
```text
email unique
id unique
```

### workspaceMembers
```text
workspaceId + userId unique
userId
workspaceId
```

### projects
```text
workspaceId
workspaceId + key
ownerId
```

### projectMembers
```text
projectId + userId unique
userId
projectId
```

### workflows
```text
workspaceId
```

### statuses
```text
workflowId + order
workflowId
```

### categories
```text
workspaceId
```

### tasks
```text
workspaceId
projectId
projectId + statusId
projectId + categoryId
projectId + assigneeId
projectId + dueDate
workspaceId + updatedAt
```

Exact compound indexes should be validated using real query patterns and MongoDB explain plans.

---

# 24. Relationship Diagram

```text
User
 |
 +---- WorkspaceMember ---- Workspace
 |                             |
 |                             +---- Project
 |                                      |
 +---- ProjectMember -------------------+
                                        |
                                        +---- Workflow
                                        |       |
                                        |       +---- Status
                                        |
                                        +---- Category
                                        |
                                        +---- Task
                                               |
                    +--------------------------+--------------------+
                    |                          |                    |
                Subtasks                  Comments            Dependencies
                    |                          |
                 Tasks                       Users
                    |
              Tags / Attachments /
              Milestones / Activity
```

---

# 25. Important Schema Rules

### Do
- Reference growing relationships.
- Keep stable public IDs.
- Index common filters.
- Keep activity append-oriented.
- Keep workflows/statuses dynamic.
- Keep category/status meanings separate.

### Avoid
- Huge member arrays inside workspaces.
- Huge task arrays inside projects.
- Hard-coded status enums in task documents.
- Hard-coded category enums.
- Duplicating the same relationship in multiple collections.
- Creating a collection for every tiny concept without a query/use-case reason.

---

# 26. Schema Evolution Rule

The database schema is **not considered final until business rules are approved**.

Before implementation, verify:
- Role inheritance
- Project membership rules
- Workflow scope
- Category scope
- Task assignment rules
- Status transition rules
- Custom field query requirements
- Multi-workspace behavior
- Archive/delete behavior
- Tenant isolation
