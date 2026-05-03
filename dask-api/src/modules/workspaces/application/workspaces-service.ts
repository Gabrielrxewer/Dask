import { MembershipRole, WorkspaceKind } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateKey
} from '@/modules/workspaces/application/workspace-template-catalog';
import type { WorkspacesRepository } from '@/modules/workspaces/repositories/workspaces-repository';

const BUSINESS_WORKSPACE_CREATION_LIMIT = 3;

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
    const [subscriptionAccess, ownedWorkspaces] = await Promise.all([
      this.workspacesRepository.getUserSubscriptionAccess(input.ownerUserId),
      this.workspacesRepository.listUserWorkspaces(input.ownerUserId)
    ]);
    const hasCorporateAccess = process.env.NODE_ENV !== 'production'
      ? true
      : subscriptionAccess?.hasActiveSubscription === true &&
        subscriptionAccess.subscriptionPlan === 'BUSINESS';
    const isBusinessSubscriber =
      subscriptionAccess?.hasActiveSubscription === true &&
      subscriptionAccess.subscriptionPlan === 'BUSINESS';

    const template = getWorkspaceTemplateByKey(input.templateKey);
    if (input.templateKey && !template) {
      throw new AppError('Invalid workspace template', 422);
    }

    if (input.kind === WorkspaceKind.CORPORATE) {
      if (!hasCorporateAccess) {
        throw new AppError('Corporate workspace requires an active BUSINESS plan', 403);
      }

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

    if (isBusinessSubscriber) {
      const ownedWorkspaceCount = ownedWorkspaces.filter((workspace) => workspace.role === MembershipRole.OWNER).length;
      if (ownedWorkspaceCount >= BUSINESS_WORKSPACE_CREATION_LIMIT) {
        throw new AppError(
          `BUSINESS plan allows up to ${BUSINESS_WORKSPACE_CREATION_LIMIT} owned workspaces.`,
          422
        );
      }
    }

    const workspace = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const created = await this.workspacesRepository.createWorkspace(input, db);
      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: 'workspace.created',
          aggregateType: 'workspace',
          aggregateId: created.id,
          occurredAt: new Date(),
          payload: {
            workspaceId: created.id,
            organizationId: input.organizationId ?? null,
            kind: input.kind
          }
        },
        db
      );
      return created;
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

    const board = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const created = await this.workspacesRepository.createBoard({
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        name: input.name,
        description: input.description,
        config: input.config
      }, db);

      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: DomainEventNames.BoardCreated,
          aggregateType: 'board',
          aggregateId: created.id,
          occurredAt: new Date(),
          payload: {
            boardId: created.id,
            workspaceId: input.workspaceId
          }
        },
        db
      );

      return created;
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

    const template = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const created = await this.workspacesRepository.createTemplate({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        schema: input.schema,
        rules: input.rules
      }, db);

      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: DomainEventNames.TemplateCreated,
          aggregateType: 'template',
          aggregateId: created.id,
          occurredAt: new Date(),
          payload: {
            templateId: created.id,
            workspaceId: input.workspaceId
          }
        },
        db
      );
      return created;
    });
    return template;
  }

  public async listUserWorkspaces(userId: string) {
    const [workspaces, subscriptionAccess] = await Promise.all([
      this.workspacesRepository.listUserWorkspaces(userId),
      this.workspacesRepository.getUserSubscriptionAccess(userId)
    ]);
    const hasCorporateAccess = process.env.NODE_ENV !== 'production'
      ? true
      : subscriptionAccess?.hasActiveSubscription === true &&
        subscriptionAccess.subscriptionPlan === 'BUSINESS';

    if (hasCorporateAccess) {
      return workspaces;
    }

    return workspaces.filter((workspace) => workspace.role !== MembershipRole.OWNER);
  }

  public async getWorkspaceProfile(input: { workspaceId: string; userId: string }) {
    await this.ensureWorkspaceReadableByUser(input.workspaceId, input.userId);
    const workspace = await this.workspacesRepository.findWorkspaceById(input.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    const info =
      workspace.config && typeof workspace.config === 'object'
        ? ((workspace.config as Record<string, unknown>).info as Record<string, unknown> | undefined)
        : undefined;

    return {
      id: workspace.id,
      name: workspace.name,
      key: workspace.key,
      kind: workspace.kind,
      organizationId: workspace.organizationId,
      info: {
        description: typeof info?.description === 'string' ? info.description : '',
        company: typeof info?.company === 'string' ? info.company : '',
        website: typeof info?.website === 'string' ? info.website : ''
      }
    };
  }

  public async updateWorkspaceProfile(input: {
    workspaceId: string;
    userId: string;
    patch: {
      name?: string;
      key?: string;
      info?: { description?: string; company?: string; website?: string };
    };
  }) {
    await this.ensureWorkspaceConfigWritableByUser(input.workspaceId, input.userId);
    const current = await this.workspacesRepository.findWorkspaceById(input.workspaceId);
    if (!current) {
      throw new AppError('Workspace not found', 404);
    }

    const currentConfig =
      current.config && typeof current.config === 'object'
        ? (current.config as Record<string, unknown>)
        : {};
    const currentInfo =
      currentConfig.info && typeof currentConfig.info === 'object'
        ? (currentConfig.info as Record<string, unknown>)
        : {};

    const nextInfo = {
      ...currentInfo,
      ...(input.patch.info ?? {})
    };

    const nextConfig = {
      ...currentConfig,
      info: nextInfo
    };

    const updated = await this.workspacesRepository.updateWorkspace({
      workspaceId: input.workspaceId,
      name: input.patch.name,
      key: input.patch.key,
      config: nextConfig
    });

    return {
      id: updated.id,
      name: updated.name,
      key: updated.key,
      kind: updated.kind,
      organizationId: updated.organizationId,
      info: {
        description: typeof nextInfo.description === 'string' ? nextInfo.description : '',
        company: typeof nextInfo.company === 'string' ? nextInfo.company : '',
        website: typeof nextInfo.website === 'string' ? nextInfo.website : ''
      }
    };
  }

  public async deleteWorkspace(input: { workspaceId: string; userId: string }) {
    const role = await this.workspacesRepository.getWorkspaceRoleForUser(input.workspaceId, input.userId);

    if (!role) {
      throw new AppError('Workspace not found', 404);
    }

    if (role !== MembershipRole.OWNER) {
      throw new AppError('Forbidden', 403);
    }

    const workspace = await this.workspacesRepository.findWorkspaceById(input.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    await this.eventPublisher.runInTransaction(async (db, publisher) => {
      await this.workspacesRepository.deleteWorkspace(
        {
          workspaceId: input.workspaceId
        },
        db
      );

      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: 'workspace.deleted',
          aggregateType: 'workspace',
          aggregateId: workspace.id,
          occurredAt: new Date(),
          payload: {
            workspaceId: workspace.id,
            organizationId: workspace.organizationId ?? null,
            kind: workspace.kind,
            deletedByUserId: input.userId
          }
        },
        db
      );
    });
  }

  public async listWorkspaceBoards(input: { workspaceId: string; userId: string }) {
    await this.ensureWorkspaceReadableByUser(input.workspaceId, input.userId);
    return this.workspacesRepository.listBoardsByWorkspace(input.workspaceId);
  }

  public async listWorkspaceTemplates(input: { workspaceId: string; userId: string }) {
    await this.ensureWorkspaceReadableByUser(input.workspaceId, input.userId);
    return this.workspacesRepository.listTemplatesByWorkspace(input.workspaceId);
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

    if (role === MembershipRole.VIEWER || role === MembershipRole.CLIENT) {
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
