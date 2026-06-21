import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { createServer } from 'http';
import { connect } from './db';
import { initSocket } from './socket';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import memberRoutes from './routes/members';
import notificationRoutes from './routes/notifications';
import userRoutes from './routes/users';
import activityRoutes from './routes/activity';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// General rate limiter: 60 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter: 10 requests per 15 minutes (prevents brute force without locking out)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(express.json());

connect();

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', generalLimiter, projectRoutes);
app.use('/api/projects/:projectId/members', generalLimiter, memberRoutes);
app.use('/api/tasks', generalLimiter, taskRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);
app.use('/api/users', generalLimiter, userRoutes);
app.use('/api/activity', generalLimiter, activityRoutes);

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
