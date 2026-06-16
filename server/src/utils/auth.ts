import jwt from 'jsonwebtoken';
import { User } from '../models/user';

interface TokenPayload {
  id: string;
  name: string;
  email: string;
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    id: user.id,
    name: user.name,
    email: user.email
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'taskmanager', {
    expiresIn: '7d'
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'taskmanager') as TokenPayload;
  } catch (error) {
    return null;
  }
}