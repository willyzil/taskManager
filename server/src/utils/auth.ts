import jwt from 'jsonwebtoken';
import { User } from '../models/user';

interface TokenPayload {
  id: string;
  name: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  console.error('Set a strong secret key and restart the server.');
  process.exit(1);
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    id: user.id,
    name: user.name,
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}