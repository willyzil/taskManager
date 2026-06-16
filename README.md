# Task Manager

A full-stack task management application similar to Asana with real-time collaboration features.

## Features

- User authentication and authorization
- Project management with progress tracking
- Task management with drag-and-drop Kanban board
- Real-time updates using WebSockets
- Email notifications on task assignment
- Responsive web interface

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Router v6
- Socket.io-client for real-time sync

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (primary database)
- Prisma ORM
- BullMQ + Redis (email job queue)
- Nodemailer (email dispatch)
- Socket.io (real-time WebSocket server)
- JWT authentication

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)

### Setup

1. Clone the repository
2. Install dependencies for both client and server:
   ```bash
   cd server && npm install
   cd client && npm install
   ```
3. Set up environment variables in `.env` files
4. Run database migrations:
   ```bash
   cd server
   npx prisma migrate dev --name init
   ```
5. Start the development servers:
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

## Project Structure

```
taskManager/
├── client/        # React + Vite frontend
├── server/        # Express backend
├── prisma/        # Schema + migrations
└── docker-compose.yml  # Postgres + Redis
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/projects` - Get projects
- `GET /api/projects/:id/tasks` - Get tasks for project
- `POST /api/projects/:id/tasks` - Create new task

## License

This project is licensed under the MIT License.