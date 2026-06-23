import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { z } from 'zod';

const router = express.Router({ mergeParams: true });

const tagCreateSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// GET /api/projects/:projectId/tags — list all tags for a project
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;

    const isProjectMember = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId: req.user!.id } } },
    });

    if (!isProjectMember || (isProjectMember.ownerId !== req.user!.id && isProjectMember.members.length === 0)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const tags = await prisma.tag.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/tags — create a tag
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const validated = tagCreateSchema.safeParse(req.body);

    if (!validated.success) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: validated.error.errors });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can create tags' });
    }

    // Check duplicate name (case-insensitive)
    const existing = await prisma.tag.findFirst({
      where: { projectId, name: { equals: validated.data.name, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A tag with this name already exists' });
    }

    const tag = await prisma.tag.create({
      data: { projectId, name: validated.data.name, color: validated.data.color },
    });

    res.status(201).json({ success: true, tag });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/projects/:projectId/tags/:id — update a tag
router.patch('/:tagId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId, tagId } = req.params;
    const validated = tagCreateSchema.safeParse(req.body);

    if (!validated.success) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: validated.error.errors });
    }

    const tag = await prisma.tag.findFirst({ where: { id: tagId, projectId } });
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can update tags' });
    }

    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: { name: validated.data.name, color: validated.data.color },
    });

    res.json({ success: true, tag: updated });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/tags/:id — delete a tag
router.delete('/:tagId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId, tagId } = req.params;

    const tag = await prisma.tag.findFirst({ where: { id: tagId, projectId } });
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can delete tags' });
    }

    await prisma.tag.delete({ where: { id: tagId } });

    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
