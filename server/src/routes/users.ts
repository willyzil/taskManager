import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = express.Router();

// GET /api/users/search?q=xxx
router.get('/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ success: true, users: [] });
    }
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { id: req.user!.id },
      },
      select: { id: true, name: true, email: true },
      take: 6,
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
