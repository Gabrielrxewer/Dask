import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateKey
} from '@/modules/workspaces/application/workspace-template-catalog';

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

type DefaultBoardViewSeed = {
  key: string;
  name: string;
  caption: string;
  compactCards?: boolean;
  allowedTaskTypes?: string[];
  statusSource:
    | { kind: 'workflow_state' }
    | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  statuses: Array<{ id: string; label: string; dot: string }>;
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
    name: 'Spike',
    slug: 'spike',
    description: 'Time-boxed technical research or exploration.',
    color: '#1f6586',
    icon: 'flask',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Incident',
    slug: 'incident',
    description: 'Operational disruption requiring action.',
    color: '#9b2034',
    icon: 'siren',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Hotfix',
    slug: 'hotfix',
    description: 'Urgent corrective delivery in production.',
    color: '#9b4d00',
    icon: 'wrench',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Chore',
    slug: 'chore',
    description: 'Maintenance task with low product impact.',
    color: '#4a5f75',
    icon: 'tool',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Research',
    slug: 'research',
    description: 'Research stream to support planning decisions.',
    color: '#384c9a',
    icon: 'search',
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
  { name: 'In Progress', slug: 'in-progress', category: 'doing', color: '#0d8df7' },
  { name: 'In Review', slug: 'in-review', category: 'doing', color: '#f59e0b' },
  { name: 'Done', slug: 'done', category: 'done', color: '#22c55e', isTerminal: true },
  { name: 'Blocked', slug: 'blocked', category: 'blocked', color: '#ef4444' }
];

const defaultColumns: DefaultColumnSeed[] = [
  { name: 'Backlog', slug: 'backlog', stateSlugs: ['backlog'] },
  { name: 'Doing', slug: 'doing', stateSlugs: ['in-progress', 'blocked'], wipLimit: 10 },
  { name: 'Review', slug: 'review', stateSlugs: ['in-review'], wipLimit: 6 },
  { name: 'Done', slug: 'done', stateSlugs: ['done'] }
];

const allScopeTypes = defaultItemTypes.map((itemType) => itemType.slug);

const defaultCustomFields: DefaultCustomFieldSeed[] = [
  {
    name: 'Story Points',
    slug: 'story-points',
    description: 'Relative effort estimation.',
    type: 'NUMBER',
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Severity',
    slug: 'severity',
    description: 'Business and technical severity level.',
    type: 'SELECT',
    options: [
      { label: 'Critical', value: 'Critical', color: '#dc2626' },
      { label: 'High', value: 'High', color: '#f97316' },
      { label: 'Medium', value: 'Medium', color: '#f59e0b' },
      { label: 'Low', value: 'Low', color: '#22c55e' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Status Planejamento',
    slug: 'planning-status',
    type: 'SELECT',
    options: [
      { label: 'Ideias', value: 'plan-ideas', color: '#8b9bb0' },
      { label: 'Planejado', value: 'plan-committed', color: '#1976d2' },
      { label: 'Construindo', value: 'plan-building', color: '#f59e0b' },
      { label: 'Pronto para entrega', value: 'plan-ready', color: '#22c55e' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Status QA',
    slug: 'qa-status',
    type: 'SELECT',
    options: [
      { label: 'Liberado para teste', value: 'qa-ready', color: '#4f8cff' },
      { label: 'Em teste', value: 'qa-testing', color: '#f59e0b' },
      { label: 'Aprovado', value: 'qa-approved', color: '#22c55e' },
      { label: 'Reprovado', value: 'qa-rejected', color: '#e53935' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Faixa Gerencial',
    slug: 'manager-lane',
    type: 'SELECT',
    options: [
      { label: 'Epicos', value: 'mgr-epics', color: '#7c3aed' },
      { label: 'Iniciativas', value: 'mgr-initiatives', color: '#0d8df7' },
      { label: 'Riscos', value: 'mgr-risks', color: '#ef4444' },
      { label: 'Entrega', value: 'mgr-delivery', color: '#16a34a' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Sprint',
    slug: 'sprint',
    type: 'TEXT',
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Componente',
    slug: 'component',
    type: 'TEXT',
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Ambiente',
    slug: 'environment',
    type: 'SELECT',
    options: [
      { label: 'Production', value: 'Production', color: '#dc2626' },
      { label: 'Staging', value: 'Staging', color: '#f59e0b' },
      { label: 'Development', value: 'Development', color: '#22c55e' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'QA Ready',
    slug: 'qa-ready',
    type: 'BOOLEAN',
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Impacto Cliente',
    slug: 'customer-impact',
    type: 'SELECT',
    options: [
      { label: 'Alto', value: 'Alto', color: '#dc2626' },
      { label: 'Medio', value: 'Medio', color: '#f59e0b' },
      { label: 'Baixo', value: 'Baixo', color: '#22c55e' }
    ],
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Release',
    slug: 'release',
    type: 'TEXT',
    scopeTypeSlugs: allScopeTypes
  },
  {
    name: 'Squad',
    slug: 'squad',
    type: 'TEXT',
    scopeTypeSlugs: allScopeTypes
  }
];

const defaultBoardViews: DefaultBoardViewSeed[] = [
  {
    key: 'dev',
    name: 'Execucao',
    caption: 'Fluxo operacional principal',
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
      { id: 'in-review', label: 'Review', dot: '#f59e0b' },
      { id: 'done', label: 'Done', dot: '#22c55e' }
    ]
  },
  {
    key: 'po',
    name: 'Planejamento',
    caption: 'Priorizacao e compromisso',
    statusSource: {
      kind: 'custom_field',
      fieldId: 'planning-status',
      fallbackByStatus: {
        done: 'plan-ready',
        'in-review': 'plan-building',
        'in-progress': 'plan-committed',
        backlog: 'plan-ideas'
      }
    },
    statuses: [
      { id: 'plan-ideas', label: 'Ideias', dot: '#8b9bb0' },
      { id: 'plan-committed', label: 'Planejado', dot: '#1976d2' },
      { id: 'plan-building', label: 'Construindo', dot: '#f59e0b' },
      { id: 'plan-ready', label: 'Pronto para entrega', dot: '#22c55e' }
    ]
  },
  {
    key: 'manager',
    name: 'Gestao',
    caption: 'Visao de capacidade e risco',
    statusSource: {
      kind: 'custom_field',
      fieldId: 'manager-lane',
      fallbackByStatus: {
        done: 'mgr-delivery',
        'in-review': 'mgr-initiatives',
        'in-progress': 'mgr-initiatives',
        backlog: 'mgr-epics'
      }
    },
    allowedTaskTypes: ['epic', 'user-story', 'improvement', 'research', 'spike', 'bug', 'incident', 'hotfix'],
    statuses: [
      { id: 'mgr-epics', label: 'Epicos', dot: '#7c3aed' },
      { id: 'mgr-initiatives', label: 'Iniciativas', dot: '#0d8df7' },
      { id: 'mgr-risks', label: 'Riscos', dot: '#ef4444' },
      { id: 'mgr-delivery', label: 'Entrega', dot: '#16a34a' }
    ]
  },
  {
    key: 'qa',
    name: 'Qualidade',
    caption: 'Validacao e conformidade',
    compactCards: true,
    statusSource: {
      kind: 'custom_field',
      fieldId: 'qa-status',
      fallbackByStatus: {
        done: 'qa-approved',
        'in-review': 'qa-testing',
        'in-progress': 'qa-testing',
        backlog: 'qa-ready'
      }
    },
    statuses: [
      { id: 'qa-ready', label: 'Liberado para teste', dot: '#4f8cff' },
      { id: 'qa-testing', label: 'Em teste', dot: '#f59e0b' },
      { id: 'qa-approved', label: 'Aprovado', dot: '#22c55e' },
      { id: 'qa-rejected', label: 'Reprovado', dot: '#e53935' }
    ]
  }
];

const legacyTypeMap: Record<string, string> = {
  card: 'user-story',
  task: 'task',
  note: 'improvement'
};

const legacyStatusMap: Record<string, string> = {
  backlog: 'backlog',
  todo: 'backlog',
  'to-do': 'backlog',
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

function getSeededBoardViews(templateKey?: WorkspaceTemplateKey): DefaultBoardViewSeed[] {
  const selectedTemplate = getWorkspaceTemplateByKey(templateKey);
  const schema = selectedTemplate?.schema;

  if (
    schema &&
    typeof schema === 'object' &&
    !Array.isArray(schema) &&
    Array.isArray((schema as Record<string, unknown>).boardViews)
  ) {
    return (schema as Record<string, unknown>).boardViews as DefaultBoardViewSeed[];
  }

  return defaultBoardViews;
}

export async function ensureWorkspaceDefaultConfiguration(
  prisma: PrismaExecutor,
  input: {
    workspaceId: string;
    ownerUserId?: string;
    templateKey?: WorkspaceTemplateKey;
  }
): Promise<{ defaultBoardId: string }> {
  const seedResult = await seedWorkspaceConfigurationDefaults(prisma, input.workspaceId, input.templateKey);
  await backfillLegacyItems(prisma, input.workspaceId, input.ownerUserId);
  return seedResult;
}

export async function seedWorkspaceConfigurationDefaults(
  prisma: PrismaExecutor,
  workspaceId: string,
  templateKey?: WorkspaceTemplateKey
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

  const seededBoardViews = getSeededBoardViews(templateKey);

  await prisma.workspacePreferences.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultBoardMode: 'dev',
      dateFormat: 'dd/mm/yyyy',
      visibleCardFieldIds: toPrismaJson(['story-points', 'severity', 'sprint', 'environment']),
      settings: toPrismaJson({
        boardViews: seededBoardViews.map((view, position) => ({
          key: view.key,
          name: view.name,
          caption: view.caption,
          compactCards: Boolean(view.compactCards),
          position,
          allowedTaskTypes: view.allowedTaskTypes ?? [],
          statusSource: view.statusSource,
          statuses: view.statuses,
          automations: {
            ruleIds: []
          }
        }))
      })
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

    const resolvedTypeSlug = (legacyTypeMap[legacyType] ?? legacyType) || 'user-story';
    const resolvedStateSlug = (legacyStatusMap[legacyState] ?? legacyState) || 'backlog';
    const resolvedColumnSlug = statusToColumnSlugMap[resolvedStateSlug] ?? 'backlog';

    const resolvedTypeId = item.typeId ?? typeBySlug.get(resolvedTypeSlug) ?? typeBySlug.get('user-story') ?? null;
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
