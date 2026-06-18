import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let _io: Server;

export function getIo(): Server {
  return _io;
}

export function initSocket(server: HttpServer): Server {
  _io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  _io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      socket.join(`project:${userId}`);
    });

    // Listen for activity:new events and broadcast to project rooms
    socket.on('activity:new', (data: { projectId: string; activity: any }) => {
      const { projectId, activity } = data;
      getIo().to(`project:${projectId}`).emit('activity:new', activity);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return _io;
}
