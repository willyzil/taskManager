import { prisma } from '../db';

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  action: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' | 'TASK_DELETED' | 'COMMENT_ADDED' | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'MEMBER_INVITED';
  entityId?: string;
  metadata: unknown;
  createdAt: Date;
  user?: { id: string; name: string; avatar?: string | null };
  project?: { id: string; name: string };
}

export interface CreateActivityLogInput {
  projectId: string;
  userId: string;
  action: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' | 'TASK_DELETED' | 'COMMENT_ADDED' | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'MEMBER_INVITED';
  entityId?: string;
  metadata: Record<string, unknown> | null;
}

export async function createActivityLog(input: CreateActivityLogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        action: input.action,
        entityId: input.entityId || null,
        metadata: input.metadata as any,
      },
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw error;
  }
}

export async function getActivityLogs(projectId?: string, userId?: string, limit = 20): Promise<ActivityLog[]> {
  try {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;

    return await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        project: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    console.error('Error getting activity logs:', error);
    return [];
  }
}
