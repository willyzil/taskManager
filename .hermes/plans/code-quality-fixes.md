# Code Quality Fixes - Implementation Plan

## Phase 1: Input Validation
### 1. Add Zod schemas for PATCH /api/tasks
- Create taskUpdateSchema with title, description, priority, status, dueDate, assigneeId
- Validate all PATCH requests through schema
- Return proper 400 errors on invalid input

### 2. Add input sanitization for text fields
- Create sanitize() helper for task titles and descriptions
- Strip HTML tags, trim, limit length
- Apply to all text inputs across routes

## Phase 2: Activity Log Fix
### 3. Fix activity log action determination
- Replace nested ternary with switch/if-else chain
- Add TASK_STATUS_CHANGED to ActivityType enum in schema
- Fix metadata logic for status changes

### 4. Add missing Prisma migration for TASK_STATUS_CHANGED
- Update schema.prisma enum
- Run prisma migrate

## Phase 3: Permissions & Security
### 5. Add task update permissions
- Only allow task updates if user is project owner OR task assignee OR task creator
- Return 403 for unauthorized users

### 6. Add rate limiting
- Install express-rate-limit
- Apply to auth endpoints (5/min)
- Apply to general API (30/min)

### 7. Add task comments API endpoints
- GET /api/tasks/:id/comments - list comments
- POST /api/tasks/:id/comments - add comment
- DELETE /api/tasks/:id/comments/:commentId - delete comment (author or project owner only)
- Add to activity log when comments created

## Phase 4: Code Cleanup
### 8. Remove debug console.log from tasks.ts
### 9. Fix model layer - exclude password from findUserByEmail
### 10. Add TypeScript types - replace `any` with proper interfaces
### 11. Add missing avatar field to taskInclude
### 12. Add WebSocket reconnection logic to SocketContext
