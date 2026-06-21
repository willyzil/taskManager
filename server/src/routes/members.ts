import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { getIo } from '../socket';

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/members
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const [project, members] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        include: { owner: { select: { id: true, name: true, email: true } } },
      }),
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const result = [
      { id: project.owner.id, name: project.owner.name, email: project.owner.email, role: 'owner' },
      ...members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
    ];

    res.json({ success: true, members: result });
  } catch (error) {
    console.error('Error getting members:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/members — invite by email
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const [invitedUser, project] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.project.findUnique({ where: { id: projectId } }),
    ]);

    if (!invitedUser) return res.status(404).json({ success: false, message: 'No user found with that email' });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can invite members' });
    }
    if (project.ownerId === invitedUser.id) {
      return res.status(400).json({ success: false, message: 'That user is already the project owner' });
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId, userId: invitedUser.id },
    });
    if (existing) return res.status(400).json({ success: false, message: 'User is already a member' });

    await prisma.projectMember.create({
      data: { projectId, userId: invitedUser.id, role: 'contributor' },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: invitedUser.id,
        type: 'project_invited',
        message: `You were added to project "${project.name}"`,
        projectId,
      },
    });

    getIo().to(`user:${invitedUser.id}`).emit('notification', notification);

    res.json({
      success: true,
      member: { id: invitedUser.id, name: invitedUser.name, email: invitedUser.email, role: 'contributor' },
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
