# Backend Architecture

## Structure

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── types/
│   ├── utils/
│   └── app.ts
│
├── tests/
├── .env.development
├── .env.production
└── package.json
```

## Request Flow

```text
HTTP Request
 ↓
Route
 ↓
Authentication / Authorization Middleware
 ↓
Validation Middleware
 ↓
Controller
 ↓
Service
 ↓
Mongoose Model
 ↓
MongoDB
```

## Responsibilities

### Routes
Define endpoints and middleware.

### Controllers
Translate HTTP requests into service calls and return HTTP responses.

### Services
Contain business rules and orchestration.

### Models
Define MongoDB/Mongoose persistence models.

### Validators
Validate request payloads/query parameters.

### Middlewares
Authentication, authorization, validation, error handling, rate limiting, etc.

## API Versioning

```text
/api/v1
```

Initial routes:

```text
/api/v1/auth
/api/v1/users
/api/v1/workspaces
/api/v1/projects
/api/v1/workflows
/api/v1/statuses
/api/v1/categories
/api/v1/tasks
```

Later:

```text
/api/v1/comments
/api/v1/attachments
/api/v1/milestones
/api/v1/dependencies
/api/v1/views
/api/v1/notifications
/api/v1/reports
```

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found"
  }
}
```

## Security
- JWT authentication
- Argon2 password hashing
- Helmet
- CORS
- Rate limiting
- request validation
- permission checks
- audit/activity records
