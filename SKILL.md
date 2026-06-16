---
name: task-manager-full-stack
title: Task Manager Full Stack Implementation
category: devops
author: Hermes
---

# Task Manager Full Stack Implementation

A complete implementation of a full-stack Task Manager platform similar to Asana with the following features:

## Tech Stack
**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- shadcn/ui (component library)
- React Query (TanStack Query v5) for server state
- Zustand for client state
- React Router v6
- Socket.io-client for real-time sync

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (primary database)
- Prisma ORM
- BullMQ + Redis (email job queue)
- Nodemailer (email dispatch)
- Socket.io (real-time WebSocket server)
- JWT authentication (access + refresh tokens)
- Zod (validation)

## Core Data Model
- **User** — id, name, email, avatar, createdAt
- **Project** — id, name, description, ownerId, createdAt
- **ProjectMember** — projectId, userId, role (owner | contributor)
- **Task** — id, title, description, projectId, assigneeId, createdById, status, priority, dueDate, createdAt, updatedAt
- **Comment** — id, taskId, authorId, body, createdAt

Task statuses: `TODO | IN_PROGRESS | IN_REVIEW | DONE`
Task priorities: `LOW | MEDIUM | HIGH | URGENT`

## Features Implemented

### Authentication
- Register / Login with JWT
- Protected routes on frontend

### Projects
- Create a project with a name and description
- Project has an owner and contributors (invite by email)
- Each project shows a progress bar — calculated as (DONE tasks / total tasks) × 100
- Project dashboard lists all tasks grouped by status column (Kanban board)

### Tasks
- Create tasks inside a project, assign to a contributor
- Task fields: title, description, assignee, priority, due date, status
- On task assignment → fire a BullMQ job → send email to assignee via Nodemailer
- Drag tasks between status columns (React DnD)

### Real-time Sync
- All connected clients on the same project receive live updates via Socket.io when:
  - A task is created, updated, moved, or deleted
  - A comment is added
  - A member joins the project

### UI Layout
- Sidebar: list of projects the user owns or contributes to
- Main area: Kanban board with 4 columns (TODO / IN PROGRESS / IN REVIEW / DONE)
- Project header: name, owner, contributor avatars, progress bar
- Notifications bell for task assignments

## Implementation Status

### Completed:
1. Project structure with client and server
2. Prisma schema with all models and migrations
3. Backend API routes (auth, projects, tasks, comments, members)
4. Authentication system with JWT tokens
5. Frontend components (Login, Dashboard, Project Board)
6. Socket.io real-time communication
7. Email notification system
8. Docker Compose setup for Postgres + Redis

### Not yet implemented (in scope for future expansion):
1. Full authentication with refresh tokens
2. Email job queue with retry logic
3. Full UI for member management and project settings
4. Comments system in detail view
5. Task history tracking
6. Advanced filtering and search

## Deliverables
1. Complete project structure with all source files
2. Working backend API with database integration
3. Frontend with React components and routing
4. Real-time communication via Socket.io
5. Email notification system
6. Docker Compose for easy deployment
7. README with setup instructions