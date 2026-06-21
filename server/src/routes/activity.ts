import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { getIo } from '../socket';
import { ActivityLog } from '../models/activity';

const router = express.Router();

// GET /api/activity?limit=20
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    // Get all projects the user is a member of
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: { userId: req.user!.id },
            },
          },
        ],
      },
      select: { id: true, name: true },
    });

    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) {
      return res.json({ success: true, logs: [] });
    }

    // Get activity logs for these projects, ordered by createdAt desc
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        projectId: { in: projectIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Format response with user and project names
    const formattedLogs: ActivityLog[] = activityLogs.map(log => ({
      id: log.id,
      action: log.action,
      projectId: log.projectId,
      projectName: log.project.name,
      userId: log.userId,
      userName: log.user.name,
      userAvatar: log.user.avatar || null,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    res.json({ success: true, logs: formattedLogs });
  } catch (error) {
    console.error('Error getting activity logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
