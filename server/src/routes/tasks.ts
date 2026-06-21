import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { getIo } from '../socket';
import { createActivityLog } from '../models/activity';
import { z } from 'zod';

// Input sanitization helper
function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 500);
}

// Zod schema for task updates
const taskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().min(1).optional(),
});

const router = express.Router();

const taskInclude = {
  assignee: { select: { id: true, name: true, avatar: true } },
  creator: { select: { id: true, name: true, avatar: true } },
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

    // Validate input
    const validated = taskUpdateSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validated.error.errors,
      });
    }

    const { title, description, priority, dueDate, assigneeId, status } = validated.data;

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

    // Permission check: only task creator, assignee, or project owner can update
    const isCreator = task.createdById === req.user!.id;
    const isAssignee = task.assigneeId === req.user!.id;
    const isOwner = task.project.ownerId === req.user!.id;

    if (!isCreator && !isAssignee && !isOwner) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    // Sanitize text inputs
    const sanitizedTitle = title !== undefined ? sanitize(title) : undefined;
    const sanitizedDesc = description !== undefined ? sanitize(description) : description;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: sanitizedTitle !== undefined ? sanitizedTitle : task.title,
        description: sanitizedDesc !== undefined ? sanitizedDesc : task.description,
        priority: priority !== undefined ? priority : task.priority,
        dueDate: dueDate !== undefined ? new Date(dueDate) : task.dueDate,
        ...(assigneeId !== undefined && { assigneeId }),
        ...(status !== undefined && { status }),
      },
      include: taskInclude,
    });

    // Determine activity type properly
    let activityAction: 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' = 'TASK_UPDATED';

    if (status !== undefined) {
      activityAction = 'TASK_STATUS_CHANGED';
    } else if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
      activityAction = 'TASK_ASSIGNED';
    } else if (title !== undefined && title !== task.title) {
      activityAction = 'TASK_UPDATED';
    } else if (description !== undefined && description !== task.description) {
      activityAction = 'TASK_UPDATED';
    } else if (priority !== undefined && priority !== task.priority) {
      activityAction = 'TASK_UPDATED';
    } else if (dueDate !== undefined) {
      activityAction = 'TASK_UPDATED';
    }

    const activityMetadata: Record<string, any> = {};

    if (title !== undefined && title !== task.title) {
      activityMetadata.title = updatedTask.title;
    }
    if (priority !== undefined && priority !== task.priority) {
      activityMetadata.priority = updatedTask.priority;
    }
    if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
      activityMetadata.assignee = updatedTask.assignee?.name;
    }
    if (status !== undefined && status !== task.status) {
      activityMetadata.status = updatedTask.status;
    }

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
      status: activityMetadata.status || task.status,
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
    console.log('Emitting activity to users:', Array.from(recipientIds));
    const io = getIo();
    recipientIds.forEach(uid => io.to(`user:${uid}`).emit('activity:new', activityData));

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Zod schema for comment creation
const commentCreateSchema = z.object({
  body: z.string().min(1).max(5000),
});

// GET /api/tasks/:taskId/comments
router.get('/:taskId/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, ownerId: true } } },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, comments });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;

    const validated = commentCreateSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validated.error.errors,
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    const comment = await prisma.comment.create({
      data: {
        taskId,
        authorId: req.user!.id,
        body: sanitize(validated.data.body),
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Log activity
    await createActivityLog({
      projectId: task.projectId,
      userId: req.user!.id,
      action: 'COMMENT_ADDED',
      entityId: comment.id,
      metadata: { taskId },
    });

    // Emit activity
    const io = getIo();
    const activityData = {
      action: 'COMMENT_ADDED',
      taskId,
      body: comment.body,
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
    const recipientIds = new Set([task.project.ownerId, ...memberships.map(m => m.userId)]);
    recipientIds.forEach(uid => io.to(`user:${uid}`).emit('activity:new', activityData));

    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete('/:taskId/comments/:commentId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { taskId, commentId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (comment.taskId !== taskId) return res.status(400).json({ success: false, message: 'Comment does not belong to this task' });

    // Only comment author or project owner can delete
    if (comment.authorId !== req.user!.id && task.project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isProjectMember = await isMember(req.user!.id, task.projectId);
    if (!isProjectMember) return res.status(403).json({ success: false, message: 'Forbidden' });

    // Emit activity before deleting
    const activityData = {
      action: 'TASK_DELETED',
      taskId: task.id,
      title: task.title,
      userId: req.user!.id,
      userName: req.user?.name,
      userAvatar: req.user?.avatar,
      projectId: task.projectId,
      projectName: task.project.name,
      createdAt: new Date(),
    };

    await prisma.activityLog.create({
      data: {
        projectId: task.projectId,
        userId: req.user!.id,
        action: 'TASK_DELETED',
        entityId: task.id,
        metadata: { title: task.title },
      },
    });

    const memberships = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      select: { userId: true },
    });
    const recipientIds = new Set([task.project.ownerId, ...memberships.map(m => m.userId)]);
    const io = getIo();
    recipientIds.forEach(uid => io.to(`user:${uid}`).emit('activity:new', activityData));

    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
