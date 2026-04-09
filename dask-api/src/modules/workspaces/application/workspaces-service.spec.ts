import { describe, expect, it, vi, type Mocked } from 'vitest';
import { MembershipRole } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import type { EventPublisher } from '@/core/events/event-publisher';
import type {
  BoardSnapshot,
  WorkspacesRepository
} from '@/modules/workspaces/repositories/workspaces-repository';

function makeRepository(): Mocked<WorkspacesRepository> {
  return {
    createWorkspace: vi.fn(),
    createBoard: vi.fn(),
    createTemplate: vi.fn(),
    listUserWorkspaces: vi.fn(),
    getWorkspaceRoleForUser: vi.fn(),
    listBoardsByWorkspace: vi.fn(),
    findBoardSnapshot: vi.fn()
  };
}

function makeEventPublisher(): Pick<EventPublisher, 'publish'> {
  return {
    publish: vi.fn().mockResolvedValue(undefined)
  };
}

function makeSnapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    board: {
      id: 'board-1',
      workspaceId: 'workspace-1',
      templateId: null,
      name: 'Main Board',
      description: null,
      config: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    },
    columns: [],
    items: [],
    ...overrides
  };
}

describe('WorkspacesService - read module', () => {
  it('lists user workspaces', async () => {
    const repo = makeRepository();
    repo.listUserWorkspaces.mockResolvedValue([
      {
        id: 'workspace-1',
        organizationId: 'org-1',
        name: 'Core Workspace',
        key: 'CORE',
        role: MembershipRole.OWNER,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }
    ]);

    const service = new WorkspacesService(repo, makeEventPublisher() as EventPublisher);
    const result = await service.listUserWorkspaces('user-1');

    expect(result).toHaveLength(1);
    expect(repo.listUserWorkspaces).toHaveBeenCalledWith('user-1');
  });

  it('denies board listing when user has no workspace membership', async () => {
    const repo = makeRepository();
    repo.getWorkspaceRoleForUser.mockResolvedValue(null);
    const service = new WorkspacesService(repo, makeEventPublisher() as EventPublisher);

    await expect(
      service.listWorkspaceBoards({ workspaceId: 'workspace-1', userId: 'user-1' })
    ).rejects.toMatchObject<AppError>({
      message: 'Workspace not found',
      statusCode: 404
    });
  });

  it('returns workspace board list when user has access', async () => {
    const repo = makeRepository();
    repo.getWorkspaceRoleForUser.mockResolvedValue(MembershipRole.MEMBER);
    repo.listBoardsByWorkspace.mockResolvedValue([
      {
        id: 'board-1',
        workspaceId: 'workspace-1',
        templateId: null,
        name: 'Main Board',
        description: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        itemCount: 10,
        columnCount: 4
      }
    ]);

    const service = new WorkspacesService(repo, makeEventPublisher() as EventPublisher);
    const result = await service.listWorkspaceBoards({
      workspaceId: 'workspace-1',
      userId: 'user-1'
    });

    expect(result).toHaveLength(1);
    expect(repo.listBoardsByWorkspace).toHaveBeenCalledWith('workspace-1');
  });

  it('returns board snapshot when user has access', async () => {
    const repo = makeRepository();
    repo.getWorkspaceRoleForUser.mockResolvedValue(MembershipRole.ADMIN);
    repo.findBoardSnapshot.mockResolvedValue(makeSnapshot());

    const service = new WorkspacesService(repo, makeEventPublisher() as EventPublisher);
    const result = await service.getBoardSnapshot({
      workspaceId: 'workspace-1',
      boardId: 'board-1',
      userId: 'user-1',
      itemLimit: 80
    });

    expect(result.board.id).toBe('board-1');
    expect(repo.findBoardSnapshot).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      boardId: 'board-1',
      itemLimit: 80
    });
  });

  it('returns 404 when snapshot board does not exist', async () => {
    const repo = makeRepository();
    repo.getWorkspaceRoleForUser.mockResolvedValue(MembershipRole.MEMBER);
    repo.findBoardSnapshot.mockResolvedValue(null);

    const service = new WorkspacesService(repo, makeEventPublisher() as EventPublisher);

    await expect(
      service.getBoardSnapshot({
        workspaceId: 'workspace-1',
        boardId: 'board-missing',
        userId: 'user-1'
      })
    ).rejects.toMatchObject<AppError>({
      message: 'Board not found',
      statusCode: 404
    });
  });
});
