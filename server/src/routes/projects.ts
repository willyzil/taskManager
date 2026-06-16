import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createProject, findProjectsByOwnerId, findProjectById, updateProject, deleteProject } from '../models/project';

const router = express.Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projects = await findProjectsByOwnerId(req.user!.id);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const project = await findProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const project = await createProject({ name, description: description || null, ownerId: req.user!.id });
    if (!project) return res.status(500).json({ success: false, message: 'Failed to create project' });
    res.status(201).json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const project = await updateProject(req.params.id, { name, description });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ok = await deleteProject(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
