import bcrypt from 'bcryptjs';
import { prisma } from '../db';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<User | null> {
  try {
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
      },
    });
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

export async function verifyPassword(userEmail: string, password: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: userEmail,
      },
    });
    
    if (!user || !user.password) return false;
    
    return await bcrypt.compare(password, user.password);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    return true;
  } catch (error) {
    console.error('Error updating password:', error);
    return false;
  }
}
