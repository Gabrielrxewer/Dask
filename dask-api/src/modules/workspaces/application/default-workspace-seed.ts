import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

type DefaultTypeSeed = {
  name: string;
  slug: string;
  description: string;
  color: string;
  icon?: string;
  acceptsParent: boolean;
  acceptsChecklist: boolean;
  acceptsDueDate: boolean;
  acceptsAssignee: boolean;
  acceptsTags: boolean;
  acceptsCustomFields: boolean;
};

type DefaultStateSeed = {
  name: string;
  slug: string;
  category?: string;
  color: string;
  isTerminal?: boolean;
};

type DefaultColumnSeed = {
  name: string;
  slug: string;
  wipLimit?: number;
  stateSlugs: string[];
};

type DefaultCustomFieldSeed = {
  name: string;
  slug: string;
  description?: string;
  type: 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'DATETIME' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'USER';
  required?: boolean;
  options?: Array<{ label: string; value: string; color?: string }>;
  scopeTypeSlugs: string[];
};

const defaultItemTypes: DefaultTypeSeed[] = [
  {
    name: 'Epic',
    slug: 'epic',
    description: 'Large initiative that groups features and stories.',
    color: '#6d28d9',
    icon: 'layers',
    acceptsParent: false,
    acceptsChecklist: false,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Feature',
    slug: 'feature',
    description: 'Functional capability that delivers business value.',
    color: '#0f766e',
    icon: 'package',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'User Story',
    slug: 'user-story',
    description: 'End-user behavior or need to be delivered.',
    color: '#16a34a',
    icon: 'bookmark',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Task',
    slug: 'task',
    description: 'Implementation task to complete a delivery.',
    color: '#0369a1',
    icon: 'check-square',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Bug',
    slug: 'bug',
    description: 'Defect requiring investigation and correction.',
    color: '#dc2626',
    icon: 'bug',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Improvement',
    slug: 'improvement',
    description: 'Enhancement over existing behavior.',
    color: '#b45309',
    icon: 'sparkles',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  }
];

const defaultWorkflowStates: DefaultStateSeed[] = [
  { name: 'Backlog', slug: 'backlog', category: 'todo', color: '#64748b' },
  { name: 'Todo', slug: 'todo', category: 'todo', color: '#475569' },
  { name: 'In Progress', slug: 'in-progress', category: 'doing', color: '#0d8df7' },
  { name: 'In Review', slug: 'in-review', category: 'doing', color: '#f59e0b' },
  { name: 'Done', slug: 'done', category: 'done', color: '#22c55e', isTerminal: true },
  { name: 'Blocked', slug: 'blocked', category: 'blocked', color: '#ef4444' }
];

const defaultColumns: DefaultColumnSeed[] = [
  { name: 'Backlog', slug: 'backlog', stateSlugs: ['backlog', 'todo'] },
  { name: 'Doing', slug: 'doing', stateSlugs: ['in-progress', 'blocked'], wipLimit: 10 },
  { name: 'Review', slug: 'review', stateSlugs: ['in-review'], wipLimit: 6 },
  { name: 'Done', slug: 'done', stateSlugs: ['done'] }
];

const defaultCustomFields: DefaultCustomFieldSeed[] = [
  {
    name: 'Severity',
    slug: 'severity',
    description: 'Business and technical severity level.',
    type: 'SELECT',
    options: [
      { label: 'Critical', value: 'critical', color: '#dc2626' },
      { label: 'High', value: 'high', color: '#f97316' },
      { label: 'Medium', value: 'medium', color: '#f59e0b' },
      { label: 'Low', value: 'low', color: '#22c55e' }
    ],
    scopeTypeSlugs: ['bug', 'task', 'user-story', 'feature', 'improvement']
  },
  {
    name: 'Story Points',
    slug: 'story-points',
    description: 'Relative effort estimation.',
    type: 'NUMBER',
    scopeTypeSlugs: ['feature', 'user-story', 'task', 'bug', 'improvement']
  },
  {
    name: 'Business Value',
    slug: 'business-value',
    description: 'Expected customer or business impact.',
    type: 'NUMBER',
    scopeTypeSlugs: ['epic', 'feature', 'user-story']
  },
  {
    name: 'Acceptance Criteria',
    slug: 'acceptance-criteria',
    description: 'Conditions for completion and validation.',
    type: 'LONG_TEXT',
    scopeTypeSlugs: ['feature', 'user-story', 'task', 'bug', 'improvement']
  }
];

const legacyTypeMap: Record<string, string> = {
  card: 'user-story',
  task: 'task',
  note: 'improvement'
};

const legacyStatusMap: Record<string, string> = {
  backlog: 'backlog',
  todo: 'todo',
  'to-do': 'todo',
  doing: 'in-progress',
  progress: 'in-progress',
  'in-progress': 'in-progress',
  inprogress: 'in-progress',
  review: 'in-review',
  'in-review': 'in-review',
  done: 'done',
  blocked: 'blocked'
};

const statusToColumnSlugMap: Record<string, string> = {
  backlog: 'backlog',
  todo: 'backlog',
  'in-progress': 'doing',
  'in-review': 'review',
  blocked: 'doing',
  done: 'done'
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function ensureWorkspaceDefaultConfiguration(
  prisma: PrismaExecutor,
  input: {
    workspaceId: string;
    ownerUserId?: string;
  }
): Promise<{ defaultBoardId: string }> {
  const seedResult = await seedWorkspaceConfigurationDefaults(prisma, input.workspaceId);
  await backfillLegacyItems(prisma, input.workspaceId, input.ownerUserId);
  return seedResult;
}

export async function seedWorkspaceConfigurationDefaults(
  prisma: PrismaExecutor,
  workspaceId: string
): Promise<{ defaultBoardId: string }> {
  const board = await ensureDefaultBoard(prisma, workspaceId);

  const typeBySlug = new Map<string, string>();
  for (const [index, typeSeed] of defaultItemTypes.entries()) {
    const type = await prisma.workItemType.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: typeSeed.slug
        }
      },
      create: {
        workspaceId,
        name: typeSeed.name,
        slug: typeSeed.slug,
        description: typeSeed.description,
        color: typeSeed.color,
        icon: typeSeed.icon,
        position: index,
        usageRules: toPrismaJson({ source: 'seed.default' }),
        acceptsParent: typeSeed.acceptsParent,
        acceptsChecklist: typeSeed.acceptsChecklist,
        acceptsDueDate: typeSeed.acceptsDueDate,
        acceptsAssignee: typeSeed.acceptsAssignee,
        acceptsTags: typeSeed.acceptsTags,
        acceptsCustomFields: typeSeed.acceptsCustomFields
      },
      update: {}
    });

    typeBySlug.set(typeSeed.slug, type.id);
  }

  const stateBySlug = new Map<string, string>();
  for (const [index, stateSeed] of defaultWorkflowStates.entries()) {
    const state = await prisma.workflowState.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: stateSeed.slug
        }
      },
      create: {
        workspaceId,
        name: stateSeed.name,
        slug: stateSeed.slug,
        category: stateSeed.category,
        color: stateSeed.color,
        position: index,
        isTerminal: Boolean(stateSeed.isTerminal)
      },
      update: {}
    });

    stateBySlug.set(stateSeed.slug, state.id);
  }

  const columnBySlug = new Map<string, string>();
  for (const [index, columnSeed] of defaultColumns.entries()) {
    const column = await prisma.boardColumn.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: columnSeed.slug
        }
      },
      create: {
        workspaceId,
        name: columnSeed.name,
        slug: columnSeed.slug,
        position: index,
        wipLimit: columnSeed.wipLimit
      },
      update: {}
    });

    columnBySlug.set(columnSeed.slug, column.id);

    await prisma.columnDefinition.upsert({
      where: {
        boardId_code: {
          boardId: board.id,
          code: columnSeed.slug
        }
      },
      create: {
        boardId: board.id,
        name: columnSeed.name,
        code: columnSeed.slug,
        position: index,
        settings: toPrismaJson({ source: 'workspace-default-seed', workspaceColumnId: column.id })
      },
      update: {}
    });
  }

  for (const columnSeed of defaultColumns) {
    const columnId = columnBySlug.get(columnSeed.slug);
    if (!columnId) {
      continue;
    }

    for (const [position, stateSlug] of columnSeed.stateSlugs.entries()) {
      const stateId = stateBySlug.get(stateSlug);
      if (!stateId) {
        continue;
      }

      await prisma.columnStateMapping.upsert({
        where: {
          columnId_stateId: {
            columnId,
            stateId
          }
        },
        create: {
          workspaceId,
          columnId,
          stateId,
          position
        },
        update: {}
      });
    }
  }

  await prisma.workspacePreferences.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultBoardMode: 'board',
      dateFormat: 'dd/mm/yyyy',
      visibleCardFieldIds: toPrismaJson(['story-points', 'severity', 'business-value'])
    },
    update: {}
  });

  for (const [index, customFieldSeed] of defaultCustomFields.entries()) {
    const customField = await prisma.customFieldDefinition.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: customFieldSeed.slug
        }
      },
      create: {
        workspaceId,
        name: customFieldSeed.name,
        slug: customFieldSeed.slug,
        description: customFieldSeed.description,
        type: customFieldSeed.type,
        required: Boolean(customFieldSeed.required),
        position: index
      },
      update: {}
    });

    for (const [optionIndex, option] of (customFieldSeed.options ?? []).entries()) {
      await prisma.customFieldOption.upsert({
        where: {
          fieldId_value: {
            fieldId: customField.id,
            value: option.value
          }
        },
        create: {
          fieldId: customField.id,
          label: option.label,
          value: option.value,
          color: option.color,
          position: optionIndex
        },
        update: {}
      });
    }

    for (const typeSlug of customFieldSeed.scopeTypeSlugs) {
      const typeId = typeBySlug.get(typeSlug);
      if (!typeId) {
        continue;
      }

      await prisma.customFieldScope.upsert({
        where: {
          fieldId_typeId: {
            fieldId: customField.id,
            typeId
          }
        },
        create: {
          fieldId: customField.id,
          typeId
        },
        update: {}
      });
    }
  }

  return {
    defaultBoardId: board.id
  };
}

async function ensureDefaultBoard(
  prisma: PrismaExecutor,
  workspaceId: string
): Promise<{ id: string }> {
  const existing = await prisma.board.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (existing) {
    return existing;
  }

  return prisma.board.create({
    data: {
      workspaceId,
      name: 'Main Board',
      description: 'Default board seeded automatically for this workspace.',
      config: toPrismaJson({ source: 'workspace-default-seed' })
    },
    select: { id: true }
  });
}

async function backfillLegacyItems(
  prisma: PrismaExecutor,
  workspaceId: string,
  ownerUserId?: string
): Promise<void> {
  const [types, states, columns, items] = await Promise.all([
    prisma.workItemType.findMany({
      where: { workspaceId },
      select: { id: true, slug: true }
    }),
    prisma.workflowState.findMany({
      where: { workspaceId },
      select: { id: true, slug: true }
    }),
    prisma.boardColumn.findMany({
      where: { workspaceId },
      select: { id: true, slug: true }
    }),
    prisma.item.findMany({
      where: {
        workspaceId,
        OR: [{ typeId: null }, { stateId: null }, { boardColumnId: null }]
      },
      select: {
        id: true,
        type: true,
        status: true,
        typeId: true,
        stateId: true,
        boardColumnId: true,
        columnId: true,
        createdBy: true
      }
    })
  ]);

  if (items.length === 0) {
    return;
  }

  const typeBySlug = new Map(types.map((entry) => [entry.slug, entry.id]));
  const stateBySlug = new Map(states.map((entry) => [entry.slug, entry.id]));
  const columnBySlug = new Map(columns.map((entry) => [entry.slug, entry.id]));

  for (const item of items) {
    const legacyType = normalizeKey(item.type);
    const legacyState = normalizeKey(item.status);

    const resolvedTypeSlug = legacyTypeMap[legacyType] ?? legacyType || 'task';
    const resolvedStateSlug = legacyStatusMap[legacyState] ?? legacyState || 'backlog';
    const resolvedColumnSlug = statusToColumnSlugMap[resolvedStateSlug] ?? 'backlog';

    const resolvedTypeId = item.typeId ?? typeBySlug.get(resolvedTypeSlug) ?? typeBySlug.get('task') ?? null;
    const resolvedStateId = item.stateId ?? stateBySlug.get(resolvedStateSlug) ?? stateBySlug.get('backlog') ?? null;
    const resolvedColumnId =
      item.boardColumnId ??
      columnBySlug.get(resolvedColumnSlug) ??
      columnBySlug.get('backlog') ??
      item.columnId ??
      null;

    await prisma.item.update({
      where: { id: item.id },
      data: {
        type: resolvedTypeSlug,
        status: resolvedStateSlug,
        typeId: resolvedTypeId,
        stateId: resolvedStateId,
        boardColumnId: resolvedColumnId,
        columnId: resolvedColumnId,
        updatedBy: ownerUserId ?? item.createdBy
      }
    });
  }
}
