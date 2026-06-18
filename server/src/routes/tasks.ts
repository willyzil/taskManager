import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { getIo } from '../socket';
import { createActivityLog } from '../models/activity';

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

// Helper function to check if a user is a member of a project
async function isMember(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId } },
    },
  });

  if (!project) return false;

  return project.ownerId === userId || project.members.some(m => m.userId === userId);
}

// GET /api/tasks?projectId=xxx
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });

    const isProjectMember = await isMember(req.user!.id, projectId as string);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

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

    // Log activity
    await createActivityLog({
      projectId,
      userId: req.user!.id,
      action: 'TASK_CREATED',
      entityId: task.id,
      metadata: { title },
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/tasks/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, assigneeId } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, ownerId: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        priority: priority !== undefined ? priority : task.priority,
        dueDate: dueDate !== undefined ? new Date(dueDate) : task.dueDate,
        ...(assigneeId !== undefined && { assigneeId }),
      },
      include: taskInclude,
    });

    // Log activity
    const activityAction = assigneeId 
      ? 'TASK_ASSIGNED'
      : priority !== undefined && priority !== task.priority ? 'TASK_UPDATED' :
        dueDate !== undefined ? 'TASK_UPDATED' :
        title !== undefined ? 'TASK_UPDATED' :
        description !== undefined ? 'TASK_UPDATED' :
        'TASK_UPDATED';
    
    const activityMetadata: Record<string, any> = {
      title: updatedTask.title,
      ...(priority !== undefined && priority !== task.priority && { priority: updatedTask.priority }),
      ...(assigneeId !== undefined && assigneeId !== task.assigneeId && { assignee: updatedTask.assignee?.name }),
    };

    await createActivityLog({
      projectId: task.projectId,
      userId: req.user!.id,
      action: activityAction,
      entityId: updatedTask.id,
      metadata: activityMetadata,
    });

    // Emit real-time activity to every project member's user room
    const activityData = {
      action: activityAction,
      taskId: updatedTask.id,
      title: updatedTask.title,
      priority: activityMetadata.priority || task.priority,
      assignee: activityMetadata.assignee || null,
      userId: req.user!.id,
      userName: req.user?.name,
      userAvatar: req.user?.avatar,
      projectId: task.projectId,
      projectName: task.project.name,
      createdAt: new Date(),
    };

    const memberships = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      select: { userId: true },
    });
    const recipientIds = new Set([
      task.project.ownerId,
      ...memberships.map(m => m.userId),
    ]);
    const io = getIo();
    recipientIds.forEach(uid => io.to(`user:${uid}`).emit('activity:new', activityData));

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { select: { id: true } } },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
