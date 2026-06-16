import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connect } from './db';
import { initSocket } from './socket';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import memberRoutes from './routes/members';
import notificationRoutes from './routes/notifications';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);

app.use(cors());
app.use(express.json());

connect();

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/members', memberRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Task Manager API is running on port ' + PORT });
});

app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

const server = createServer(app);
initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export { app };
