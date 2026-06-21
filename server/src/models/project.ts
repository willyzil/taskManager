import { prisma } from '../db';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description: string | null;
  ownerId: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  try {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        owner: {
          connect: {
            id: input.ownerId
          }
        }
      },
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

export async function findProjectById(id: string): Promise<Project | null> {
  try {
    const project = await prisma.project.findUnique({
      where: {
        id,
      },
    });

    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
    };
  } catch (error) {
    console.error('Error finding project:', error);
    return null;
  }
}

export async function findProjectsByOwnerId(ownerId: string): Promise<Project[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          {
            ownerId,
          },
          {
            members: {
              some: {
                userId: ownerId,
              },
            },
          },
        ],
      },
      include: {
        members: true,
      },
    });

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      members: project.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
      })),
    }));
  } catch (error) {
    console.error('Error finding projects by owner:', error);
    return [];
  }
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  try {
    const project = await prisma.project.update({
      where: {
        id,
      },
      data: {
        name: input.name,
        description: input.description,
      },
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
    };
  } catch (error) {
    console.error('Error updating project:', error);
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { projectId: id } }),
      prisma.comment.deleteMany({ where: { task: { projectId: id } } }),
      prisma.task.deleteMany({ where: { projectId: id } }),
      prisma.projectMember.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ]);
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}
