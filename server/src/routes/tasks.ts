import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { getIo } from '../socket';

const router = express.Router();

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
};

async function notifyAssignee(assigneeId: string, taskTitle: string, taskId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const notification = await prisma.notification.create({
    data: {
      userId: assigneeId,
      type: 'task_assigned',
      message: `You were assigned "${taskTitle}" in project "${project?.name}"`,
      projectId,
      taskId,
    },
  });
  getIo().to(`user:${assigneeId}`).emit('notification', notification);
}

// GET /api/tasks?projectId=xxx
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
    const tasks = await prisma.task.findMany({
      where: { projectId: projectId as string },
      include: taskInclude,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/tasks
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, projectId, priority, dueDate, assigneeId } = req.body;
    if (!title || !projectId) {
      return res.status(400).json({ success: false, message: 'title and projectId are required' });
    }
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        projectId,
        createdById: req.user!.id,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        ...(assigneeId && { assigneeId }),
      },
      include: taskInclude,
    });

    if (assigneeId && assigneeId !== req.user!.id) {
      await notifyAssignee(assigneeId, title, task.id, projectId);
    }

    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, title, description, priority, dueDate, assigneeId } = req.body;

    const current = await prisma.task.findUnique({ where: { id: req.params.id } });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      },
      include: taskInclude,
    });

    // Notify if assignee changed to someone else (and isn't the person making the change)
    if (assigneeId && assigneeId !== current?.assigneeId && assigneeId !== req.user!.id) {
      await notifyAssignee(assigneeId, task.title, task.id, task.projectId);
    }

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
