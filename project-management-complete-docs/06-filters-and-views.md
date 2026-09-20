# Dynamic Filters, Sorting, Grouping & Saved Views

## Goal
Create one reusable filtering system that powers Board, List, My Tasks, Reports, and Saved Views where applicable.

## Filter Fields
Potential fields:
- project
- status
- status category
- category
- priority
- assignee
- creator
- tag
- due date
- start date
- created date
- updated date
- milestone
- custom field

## Operators

### Text
- is
- is not
- contains
- does not contain
- is empty
- is not empty

### Selection
- is
- is not
- is any of
- is none of

### Date
- before
- after
- between
- today
- this week
- this month
- overdue

### Number
- equals
- greater than
- less than
- between

## Filter Groups

Example:

```text
(
  Status = In Progress
  OR
  Status = Testing
)
AND
Priority = High
```

The UI should remain visual and simple.

## Sorting
- Priority
- Due Date
- Created Date
- Updated Date
- Status
- Assignee
- Category

Ascending / descending.

## Grouping
- Status
- Category
- Priority
- Assignee
- Milestone

## Saved View
A saved view contains:
- filter rules
- sorting
- grouping
- visible columns
- view type

Examples:
- My Tasks
- My High Priority Tasks
- Due This Week
- Open Bugs
- Blocked Tasks
- Recently Completed

## Important Rule
Do not build separate filter engines for each screen.

```text
              Filter Engine
                   |
       +-----------+-----------+
       |           |           |
     Board       List      My Tasks
       |           |           |
       +-----------+-----------+
                   |
                Reports
```
