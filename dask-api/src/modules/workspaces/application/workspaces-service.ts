import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import type { WorkspacesRepository } from '@/modules/workspaces/repositories/workspaces-repository';

export class WorkspacesService {
  public constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async createWorkspace(input: {
    organizationId: string;
    name: string;
    key: string;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }) {
    const workspace = await this.workspacesRepository.createWorkspace(input);
    await this.eventPublisher.publish({
      id: uuid(),
      name: 'workspace.created',
      aggregateType: 'workspace',
      aggregateId: workspace.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: workspace.id,
        organizationId: input.organizationId
      }
    });
    return workspace;
  }

  public async createBoard(input: {
    workspaceId: string;
    templateId?: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) {
    const board = await this.workspacesRepository.createBoard(input);
    await this.eventPublisher.publish({
      id: uuid(),
      name: DomainEventNames.BoardCreated,
      aggregateType: 'board',
      aggregateId: board.id,
      occurredAt: new Date(),
      payload: {
        boardId: board.id,
        workspaceId: input.workspaceId
      }
    });
    return board;
  }

  public async createTemplate(input: {
    workspaceId: string;
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }) {
    const template = await this.workspacesRepository.createTemplate(input);
    await this.eventPublisher.publish({
      id: uuid(),
      name: DomainEventNames.TemplateCreated,
      aggregateType: 'template',
      aggregateId: template.id,
      occurredAt: new Date(),
      payload: {
        templateId: template.id,
        workspaceId: input.workspaceId
      }
    });
    return template;
  }

  public async listUserWorkspaces(userId: string) {
    return this.workspacesRepository.listUserWorkspaces(userId);
  }

  public async listWorkspaceBoards(input: { workspaceId: string; userId: string }) {
    await this.ensureWorkspaceReadableByUser(input.workspaceId, input.userId);
    return this.workspacesRepository.listBoardsByWorkspace(input.workspaceId);
  }

  public async getBoardSnapshot(input: {
    workspaceId: string;
    boardId: string;
    userId: string;
    itemLimit?: number;
  }) {
    await this.ensureWorkspaceReadableByUser(input.workspaceId, input.userId);

    const snapshot = await this.workspacesRepository.findBoardSnapshot({
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      itemLimit: input.itemLimit ?? 100
    });

    if (!snapshot) {
      throw new AppError('Board not found', 404);
    }

    return snapshot;
  }

  private async ensureWorkspaceReadableByUser(workspaceId: string, userId: string): Promise<void> {
    const role = await this.workspacesRepository.getWorkspaceRoleForUser(workspaceId, userId);
    if (!role) {
      throw new AppError('Workspace not found', 404);
    }
  }
}
