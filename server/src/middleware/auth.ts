import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';

export interface AuthRequest extends Request {
  user?: { id: string; name: string; email: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}
