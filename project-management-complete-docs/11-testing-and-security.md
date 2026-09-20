# Testing, Security & Quality

## Testing

### Unit
- Services
- Utilities
- Validators
- UI components

### Integration
- API endpoints
- Authentication
- Authorization
- Database interactions

### E2E
Use Playwright for critical user journeys.

Examples:
- Login
- Create workspace
- Create project
- Create task
- Move task on Kanban
- Filter tasks
- Complete task

## Security

### Authentication
JWT with access/refresh token strategy.

### Passwords
Argon2 hashing.

### Authorization
Every protected operation validates:
- authenticated user
- workspace membership
- project membership where needed
- permission

### HTTP Security
- Helmet
- CORS
- Rate limiting
- Input validation

### Data Security
- Never trust client-provided ownership IDs.
- Enforce tenant/workspace boundaries on the server.
- Do not expose password hashes.
- Avoid sensitive information in logs.

## Quality
- TypeScript strictness
- ESLint
- Automated tests
- Code review
- Consistent API errors
- API documentation
