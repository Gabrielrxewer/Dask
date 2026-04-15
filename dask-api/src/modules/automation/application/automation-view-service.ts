import { type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color.trim())) {
    return color.trim().toLowerCase();
  }

  return fallback;
}

type DefaultColumnSeed = {
  key: string;
  name: string;
  color: string;
  position: number;
  isTerminal?: boolean;
};

type DefaultViewSeed = {
  key: string;
  name: string;
  description: string;
  position: number;
  columns: DefaultColumnSeed[];
};

export class AutomationViewService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly workspaceConfigService: WorkspaceConfigService
  ) {}

  public async ensureDefaultViews(workspaceId: string): Promise<void> {
    const defaultViews = await this.resolveDefaultViewSeeds(workspaceId);

    for (const viewSeed of defaultViews) {
      const view = await this.prisma.automationView.upsert({
        where: {
          workspaceId_key: {
            workspaceId,
            key: viewSeed.key
          }
        },
        create: {
          workspaceId,
          key: viewSeed.key,
          name: viewSeed.name,
          description: viewSeed.description,
          position: viewSeed.position,
          isSystem: true,
          isActive: true
        },
        update: {
          isSystem: true
        }
      });

      for (const columnSeed of viewSeed.columns) {
        await this.prisma.automationViewColumn.upsert({
          where: {
            viewId_key: {
              viewId: view.id,
              key: columnSeed.key
            }
          },
          create: {
            workspaceId,
            viewId: view.id,
            key: columnSeed.key,
            name: columnSeed.name,
            color: columnSeed.color,
            position: columnSeed.position,
            isTerminal: Boolean(columnSeed.isTerminal)
          },
          update: {
            isTerminal: Boolean(columnSeed.isTerminal)
          }
        });
      }
    }
  }

  private async resolveDefaultViewSeeds(workspaceId: string): Promise<DefaultViewSeed[]> {
    const preferences = await this.prisma.workspacePreferences.findUnique({
      where: { workspaceId },
      select: { settings: true }
    });

    const settings =
      preferences?.settings && typeof preferences.settings === 'object' && !Array.isArray(preferences.settings)
        ? (preferences.settings as Record<string, unknown>)
        : null;

    const boardPerspectives = Array.isArray(settings?.perspectives)
      ? settings?.perspectives
      : Array.isArray(settings?.boardViews)
        ? settings?.boardViews
        : [];

    const parsed: DefaultViewSeed[] = [];
    for (const [index, entry] of boardPerspectives.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const view = entry as Record<string, unknown>;
      if (typeof view.key !== 'string' || typeof view.name !== 'string') {
        continue;
      }

      const rawStatuses = Array.isArray(view.statuses) ? view.statuses : [];
      const columns: DefaultColumnSeed[] = [];

      for (const [statusIndex, status] of rawStatuses.entries()) {
        if (!status || typeof status !== 'object' || Array.isArray(status)) {
          continue;
        }

        const statusRecord = status as Record<string, unknown>;
        if (
          typeof statusRecord.id !== 'string' ||
          typeof statusRecord.label !== 'string' ||
          typeof statusRecord.dot !== 'string'
        ) {
          continue;
        }

        columns.push({
          key: toSlug(statusRecord.id),
          name: statusRecord.label,
          color: normalizeHexColor(statusRecord.dot, '#64748b'),
          position: statusIndex,
          isTerminal: statusIndex === rawStatuses.length - 1
        });
      }

      if (columns.length === 0) {
        continue;
      }

      parsed.push({
        key: toSlug(view.key),
        name: view.name,
        description: typeof view.caption === 'string' ? view.caption : '',
        position: typeof view.position === 'number' ? view.position : index,
        columns
      });
    }

    parsed.sort((left, right) => left.position - right.position);

    if (parsed.length > 0) {
      return parsed;
    }

    return [
      {
        key: 'dev',
        name: 'Development',
        description: 'Execution flow for the engineering view.',
        position: 0,
        columns: [
          { key: 'backlog', name: 'Backlog', color: '#64748b', position: 0 },
          { key: 'in-progress', name: 'In Progress', color: '#0d8df7', position: 1 },
          { key: 'in-review', name: 'In Review', color: '#f59e0b', position: 2 },
          { key: 'done', name: 'Done', color: '#22c55e', position: 3, isTerminal: true }
        ]
      }
    ];
  }

  public async listViews(input: { workspaceId: string; userId: string }) {
    await this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId);
    await this.ensureDefaultViews(input.workspaceId);

    const views = await this.prisma.automationView.findMany({
      where: {
        workspaceId: input.workspaceId
      },
      include: {
        columns: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        },
        _count: {
          select: { placements: true }
        }
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return views.map((view) => this.serializeView(view));
  }

  public async createView(input: {
    workspaceId: string;
    userId: string;
    payload: {
      key: string;
      name: string;
      description?: string;
      position?: number;
      isActive?: boolean;
      settings?: Record<string, unknown>;
      columns?: Array<{
        key: string;
        name: string;
        color?: string;
        position?: number;
        isActive?: boolean;
        isTerminal?: boolean;
        settings?: Record<string, unknown>;
      }>;
    };
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const key = toSlug(input.payload.key || input.payload.name);
    if (!key) {
      throw new AppError('Invalid view key.', 422);
    }

    const view = await this.prisma.automationView.create({
      data: {
        workspaceId: input.workspaceId,
        key,
        name: input.payload.name,
        description: input.payload.description,
        position: input.payload.position ?? (await this.nextViewPosition(input.workspaceId)),
        isActive: input.payload.isActive ?? true,
        isSystem: false,
        settings: (input.payload.settings ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });

    const columns = input.payload.columns ?? [];

    for (const [index, column] of columns.entries()) {
      await this.prisma.automationViewColumn.create({
        data: {
          workspaceId: input.workspaceId,
          viewId: view.id,
          key: toSlug(column.key || column.name),
          name: column.name,
          color: normalizeHexColor(column.color, '#64748b'),
          position: column.position ?? index,
          isActive: column.isActive ?? true,
          isTerminal: column.isTerminal ?? false,
          settings: (column.settings ?? undefined) as Prisma.InputJsonValue | undefined
        }
      });
    }

    return this.getViewOrThrow(input.workspaceId, view.id);
  }

  public async updateView(input: {
    workspaceId: string;
    viewId: string;
    userId: string;
    payload: {
      name?: string;
      description?: string | null;
      position?: number;
      isActive?: boolean;
      settings?: Record<string, unknown>;
    };
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.automationView.findFirst({
      where: { id: input.viewId, workspaceId: input.workspaceId }
    });

    if (!current) {
      throw new AppError('View not found.', 404);
    }

    const settings =
      input.payload.settings !== undefined
        ? ((input.payload.settings ?? {}) as Prisma.InputJsonValue)
        : undefined;

    await this.prisma.automationView.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        description: input.payload.description,
        position: input.payload.position,
        isActive: input.payload.isActive,
        settings
      }
    });

    return this.getViewOrThrow(input.workspaceId, current.id);
  }

  public async listViewColumns(input: {
    workspaceId: string;
    viewId: string;
    userId: string;
  }) {
    await this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId);

    await this.ensureViewBelongsToWorkspace(input.workspaceId, input.viewId);

    const columns = await this.prisma.automationViewColumn.findMany({
      where: {
        workspaceId: input.workspaceId,
        viewId: input.viewId,
        isActive: true
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return columns.map((column) => this.serializeColumn(column));
  }

  public async createViewColumn(input: {
    workspaceId: string;
    viewId: string;
    userId: string;
    payload: {
      key: string;
      name: string;
      description?: string;
      color?: string;
      position?: number;
      isActive?: boolean;
      isTerminal?: boolean;
      settings?: Record<string, unknown>;
    };
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureViewBelongsToWorkspace(input.workspaceId, input.viewId);

    const key = toSlug(input.payload.key || input.payload.name);
    if (!key) {
      throw new AppError('Invalid view column key.', 422);
    }

    const column = await this.prisma.automationViewColumn.create({
      data: {
        workspaceId: input.workspaceId,
        viewId: input.viewId,
        key,
        name: input.payload.name,
        description: input.payload.description,
        color: normalizeHexColor(input.payload.color, '#64748b'),
        position: input.payload.position ?? (await this.nextViewColumnPosition(input.workspaceId, input.viewId)),
        isActive: input.payload.isActive ?? true,
        isTerminal: input.payload.isTerminal ?? false,
        settings: (input.payload.settings ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });

    return this.serializeColumn(column);
  }

  public async updateViewColumn(input: {
    workspaceId: string;
    viewId: string;
    columnId: string;
    userId: string;
    payload: {
      name?: string;
      description?: string | null;
      color?: string;
      position?: number;
      isActive?: boolean;
      isTerminal?: boolean;
      settings?: Record<string, unknown>;
    };
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureViewBelongsToWorkspace(input.workspaceId, input.viewId);

    const current = await this.prisma.automationViewColumn.findFirst({
      where: {
        id: input.columnId,
        workspaceId: input.workspaceId,
        viewId: input.viewId
      }
    });

    if (!current) {
      throw new AppError('View column not found.', 404);
    }

    const settings =
      input.payload.settings !== undefined
        ? ((input.payload.settings ?? {}) as Prisma.InputJsonValue)
        : undefined;

    const updated = await this.prisma.automationViewColumn.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        description: input.payload.description,
        color: input.payload.color
          ? normalizeHexColor(input.payload.color, current.color)
          : undefined,
        position: input.payload.position,
        isActive: input.payload.isActive,
        isTerminal: input.payload.isTerminal,
        settings
      }
    });

    return this.serializeColumn(updated);
  }

  public async listItemPlacements(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
  }) {
    await this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId);
    await this.ensureItemBelongsToWorkspace(input.workspaceId, input.itemId);

    const placements = await this.prisma.workItemViewPlacement.findMany({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId
      },
      include: {
        view: true,
        column: true
      },
      orderBy: [{ updatedAt: 'desc' }]
    });

    return placements.map((placement) => this.serializePlacement(placement));
  }

  public async upsertItemPlacement(input: {
    workspaceId: string;
    itemId: string;
    viewId: string;
    userId: string;
    payload: {
      columnId: string;
      position?: number;
      metadata?: Record<string, unknown>;
    };
  }) {
    await this.workspaceConfigService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    await this.ensureItemBelongsToWorkspace(input.workspaceId, input.itemId);
    await this.ensureViewBelongsToWorkspace(input.workspaceId, input.viewId);
    await this.ensureColumnBelongsToView(input.workspaceId, input.viewId, input.payload.columnId);

    const placement = await this.prisma.workItemViewPlacement.upsert({
      where: {
        itemId_viewId: {
          itemId: input.itemId,
          viewId: input.viewId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        viewId: input.viewId,
        columnId: input.payload.columnId,
        position: input.payload.position ?? 0,
        metadata: (input.payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        updatedBy: input.userId
      },
      update: {
        columnId: input.payload.columnId,
        position: input.payload.position,
        metadata:
          input.payload.metadata !== undefined
            ? ((input.payload.metadata ?? {}) as Prisma.InputJsonValue)
            : undefined,
        updatedBy: input.userId
      },
      include: {
        view: true,
        column: true
      }
    });

    return this.serializePlacement(placement);
  }

  public async removeItemPlacement(input: {
    workspaceId: string;
    itemId: string;
    viewId: string;
    userId: string;
  }) {
    await this.workspaceConfigService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    await this.prisma.workItemViewPlacement.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        viewId: input.viewId
      }
    });
  }

  public async resolveViewByReference(input: {
    workspaceId: string;
    viewId?: string;
    viewKey?: string;
  }) {
    if (input.viewId) {
      const byId = await this.prisma.automationView.findFirst({
        where: { id: input.viewId, workspaceId: input.workspaceId }
      });
      if (byId) {
        return byId;
      }
    }

    if (input.viewKey) {
      const byKey = await this.prisma.automationView.findFirst({
        where: {
          workspaceId: input.workspaceId,
          key: toSlug(input.viewKey)
        }
      });

      if (byKey) {
        return byKey;
      }
    }

    throw new AppError('Automation view not found.', 404);
  }

  public async resolveColumnByReference(input: {
    workspaceId: string;
    viewId: string;
    columnId?: string;
    columnKey?: string;
  }) {
    if (input.columnId) {
      const byId = await this.prisma.automationViewColumn.findFirst({
        where: {
          id: input.columnId,
          workspaceId: input.workspaceId,
          viewId: input.viewId
        }
      });

      if (byId) {
        return byId;
      }
    }

    if (input.columnKey) {
      const byKey = await this.prisma.automationViewColumn.findFirst({
        where: {
          workspaceId: input.workspaceId,
          viewId: input.viewId,
          key: toSlug(input.columnKey)
        }
      });

      if (byKey) {
        return byKey;
      }
    }

    throw new AppError('Automation view column not found.', 404);
  }

  private async getViewOrThrow(workspaceId: string, viewId: string) {
    const view = await this.prisma.automationView.findFirst({
      where: {
        id: viewId,
        workspaceId
      },
      include: {
        columns: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        },
        _count: {
          select: { placements: true }
        }
      }
    });

    if (!view) {
      throw new AppError('View not found.', 404);
    }

    return this.serializeView(view);
  }

  private async ensureViewBelongsToWorkspace(workspaceId: string, viewId: string): Promise<void> {
    const view = await this.prisma.automationView.findFirst({
      where: {
        id: viewId,
        workspaceId
      },
      select: { id: true }
    });

    if (!view) {
      throw new AppError('View not found.', 404);
    }
  }

  private async ensureColumnBelongsToView(
    workspaceId: string,
    viewId: string,
    columnId: string
  ): Promise<void> {
    const column = await this.prisma.automationViewColumn.findFirst({
      where: {
        id: columnId,
        workspaceId,
        viewId
      },
      select: { id: true }
    });

    if (!column) {
      throw new AppError('View column not found.', 404);
    }
  }

  private async ensureItemBelongsToWorkspace(workspaceId: string, itemId: string): Promise<void> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        workspaceId
      },
      select: { id: true }
    });

    if (!item) {
      throw new AppError('Work item not found.', 404);
    }
  }

  private async nextViewPosition(workspaceId: string): Promise<number> {
    const aggregate = await this.prisma.automationView.aggregate({
      where: { workspaceId },
      _max: { position: true }
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private async nextViewColumnPosition(workspaceId: string, viewId: string): Promise<number> {
    const aggregate = await this.prisma.automationViewColumn.aggregate({
      where: {
        workspaceId,
        viewId
      },
      _max: { position: true }
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private serializeView(view: {
    id: string;
    workspaceId: string;
    key: string;
    name: string;
    description: string | null;
    position: number;
    isSystem: boolean;
    isActive: boolean;
    settings: unknown;
    createdAt: Date;
    updatedAt: Date;
    columns: Array<{
      id: string;
      workspaceId: string;
      viewId: string;
      key: string;
      name: string;
      description: string | null;
      color: string;
      position: number;
      isActive: boolean;
      isTerminal: boolean;
      settings: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
    _count: {
      placements: number;
    };
  }) {
    return {
      id: view.id,
      workspaceId: view.workspaceId,
      key: view.key,
      name: view.name,
      description: view.description,
      position: view.position,
      isSystem: view.isSystem,
      isActive: view.isActive,
      settings: view.settings,
      placementsCount: view._count.placements,
      columns: view.columns.map((column) => this.serializeColumn(column)),
      createdAt: view.createdAt,
      updatedAt: view.updatedAt
    };
  }

  private serializeColumn(column: {
    id: string;
    workspaceId: string;
    viewId: string;
    key: string;
    name: string;
    description: string | null;
    color: string;
    position: number;
    isActive: boolean;
    isTerminal: boolean;
    settings: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: column.id,
      workspaceId: column.workspaceId,
      viewId: column.viewId,
      key: column.key,
      name: column.name,
      description: column.description,
      color: column.color,
      position: column.position,
      isActive: column.isActive,
      isTerminal: column.isTerminal,
      settings: column.settings,
      createdAt: column.createdAt,
      updatedAt: column.updatedAt
    };
  }

  private serializePlacement(placement: {
    id: string;
    workspaceId: string;
    itemId: string;
    viewId: string;
    columnId: string;
    position: number;
    metadata: unknown;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    view: {
      id: string;
      key: string;
      name: string;
    };
    column: {
      id: string;
      key: string;
      name: string;
      color: string;
    };
  }) {
    return {
      id: placement.id,
      workspaceId: placement.workspaceId,
      itemId: placement.itemId,
      viewId: placement.viewId,
      columnId: placement.columnId,
      position: placement.position,
      metadata: placement.metadata,
      updatedBy: placement.updatedBy,
      createdAt: placement.createdAt,
      updatedAt: placement.updatedAt,
      view: placement.view,
      column: placement.column
    };
  }
}
