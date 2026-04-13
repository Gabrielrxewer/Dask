import { MembershipRole, WorkspaceKind } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateKey
} from '@/modules/workspaces/application/workspace-template-catalog';
import type { WorkspacesRepository } from '@/modules/workspaces/repositories/workspaces-repository';

export class WorkspacesService {
  public constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async createWorkspace(input: {
    organizationId?: string;
    kind: WorkspaceKind;
    name: string;
    key: string;
    templateKey?: WorkspaceTemplateKey;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }) {
    const template = getWorkspaceTemplateByKey(input.templateKey);
    if (input.templateKey && !template) {
      throw new AppError('Invalid workspace template', 422);
    }

    if (input.kind === WorkspaceKind.CORPORATE) {
      if (!input.organizationId) {
        throw new AppError('organizationId is required for corporate workspace', 422);
      }

      const organizationRole = await this.workspacesRepository.getOrganizationRoleForUser(
        input.organizationId,
        input.ownerUserId
      );

      if (!organizationRole) {
        throw new AppError('Organization not found', 404);
      }

      if (!(organizationRole === MembershipRole.OWNER || organizationRole === MembershipRole.ADMIN)) {
        throw new AppError('Forbidden', 403);
      }
    }

    if (input.kind === WorkspaceKind.PERSONAL && input.organizationId) {
      throw new AppError('Personal workspace must not be linked to an organization', 422);
    }

    const workspace = await this.workspacesRepository.createWorkspace(input);
    await this.eventPublisher.publish({
      id: uuid(),
      name: 'workspace.created',
      aggregateType: 'workspace',
      aggregateId: workspace.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: workspace.id,
        organizationId: input.organizationId ?? null,
        kind: input.kind
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
    userId: string;
  }) {
    await this.ensureWorkspaceBoardWritableByUser(input.workspaceId, input.userId);

    const board = await this.workspacesRepository.createBoard({
      workspaceId: input.workspaceId,
      templateId: input.templateId,
      name: input.name,
      description: input.description,
      config: input.config
    });
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
    userId: string;
  }) {
    await this.ensureWorkspaceConfigWritableByUser(input.workspaceId, input.userId);

    const template = await this.workspacesRepository.createTemplate({
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      schema: input.schema,
      rules: input.rules
    });
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

  private async ensureWorkspaceBoardWritableByUser(workspaceId: string, userId: string): Promise<void> {
    const role = await this.workspacesRepository.getWorkspaceRoleForUser(workspaceId, userId);

    if (!role) {
      throw new AppError('Workspace not found', 404);
    }

    if (role === MembershipRole.VIEWER) {
      throw new AppError('Forbidden', 403);
    }
  }

  private async ensureWorkspaceConfigWritableByUser(workspaceId: string, userId: string): Promise<void> {
    const role = await this.workspacesRepository.getWorkspaceRoleForUser(workspaceId, userId);

    if (!role) {
      throw new AppError('Workspace not found', 404);
    }

    if (!(role === MembershipRole.OWNER || role === MembershipRole.ADMIN)) {
      throw new AppError('Forbidden', 403);
    }
  }
}
