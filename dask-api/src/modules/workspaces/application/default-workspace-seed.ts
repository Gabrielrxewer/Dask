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
  settings?: Record<string, unknown>;
};

type DefaultBoardViewSeed = {
  key: string;
  name: string;
  caption: string;
  compactCards?: boolean;
  allowedTaskTypes?: string[];
  visibleBoardColumnSlugs?: string[];
  statusSource:
    | { kind: 'workflow_state' }
    | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  statuses: Array<{ id: string; label: string; dot: string }>;
};

type TemplateSeedPreset = {
  templateKey: WorkspaceTemplateKey;
  itemTypes: DefaultTypeSeed[];
  workflowStates: DefaultStateSeed[];
  columns: DefaultColumnSeed[];
  customFields: DefaultCustomFieldSeed[];
  defaultBoardMode: string;
  defaultVisibleCardFields: string[];
  defaultVisibleDetailFields: string[];
  defaultBoardViews: DefaultBoardViewSeed[];
};

const CARD_FIELDS_SCHEMA_VERSION = 2;

const defaultSystemCardFieldIds = [
  'sys:type',
  'sys:priority',
  'sys:status',
  'sys:title',
  'sys:description',
  'sys:created-by',
  'sys:assignee',
  'sys:due-date'
];

const defaultSystemDetailFieldIds = [
  'sys:type',
  'sys:priority',
  'sys:status',
  'sys:title',
  'sys:description',
  'sys:created-by',
  'sys:assignee',
  'sys:tags',
  'sys:checklist',
  'sys:due-date'
];

const softwareDeliveryItemTypes: DefaultTypeSeed[] = [
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
    name: 'Epic',
    slug: 'epic',
    description: 'Large initiative that groups work items.',
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
  }
];

const softwareDeliveryStates: DefaultStateSeed[] = [
  { name: 'Backlog', slug: 'backlog', category: 'todo', color: '#64748b' },
  { name: 'In Progress', slug: 'in-progress', category: 'doing', color: '#0d8df7' },
  { name: 'In Review', slug: 'in-review', category: 'doing', color: '#f59e0b' },
  { name: 'Done', slug: 'done', category: 'done', color: '#22c55e', isTerminal: true },
  { name: 'Blocked', slug: 'blocked', category: 'blocked', color: '#ef4444' }
];

const softwareDeliveryColumns: DefaultColumnSeed[] = [
  { name: 'Backlog', slug: 'backlog', stateSlugs: ['backlog'] },
  { name: 'Doing', slug: 'doing', stateSlugs: ['in-progress', 'blocked'], wipLimit: 10 },
  { name: 'Review', slug: 'review', stateSlugs: ['in-review'], wipLimit: 6 },
  { name: 'Done', slug: 'done', stateSlugs: ['done'] }
];

const softwareDeliveryTypeSlugs = softwareDeliveryItemTypes.map((itemType) => itemType.slug);

const softwareDeliveryCustomFields: DefaultCustomFieldSeed[] = [
  {
    name: 'Story Points',
    slug: 'story-points',
    description: 'Relative effort estimation.',
    type: 'NUMBER',
    scopeTypeSlugs: softwareDeliveryTypeSlugs
  },
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
    scopeTypeSlugs: softwareDeliveryTypeSlugs
  }
];

const softwareDeliveryBoardViews: DefaultBoardViewSeed[] = [
  {
    key: 'dev',
    name: 'DEV',
    caption: 'Fluxo operacional principal',
    visibleBoardColumnSlugs: ['backlog', 'doing', 'review', 'done'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
      { id: 'in-review', label: 'Review', dot: '#f59e0b' },
      { id: 'done', label: 'Done', dot: '#22c55e' }
    ]
  },
  {
    key: 'qa',
    name: 'QA',
    caption: 'Validacao e conformidade',
    compactCards: true,
    visibleBoardColumnSlugs: ['review', 'done'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
      { id: 'in-review', label: 'Review', dot: '#f59e0b' },
      { id: 'done', label: 'Done', dot: '#22c55e' }
    ]
  },
  {
    key: 'management',
    name: 'GESTAO',
    caption: 'Acompanhamento executivo',
    visibleBoardColumnSlugs: ['doing', 'review', 'done'],
    allowedTaskTypes: ['bug', 'task', 'user-story', 'epic', 'spike'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
      { id: 'in-review', label: 'Review', dot: '#f59e0b' },
      { id: 'done', label: 'Done', dot: '#22c55e' }
    ]
  }
];

const productDiscoveryItemTypes: DefaultTypeSeed[] = [
  {
    name: 'Opportunity',
    slug: 'opportunity',
    description: 'Problem area worth exploring.',
    color: '#7c3aed',
    icon: 'target',
    acceptsParent: false,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Hypothesis',
    slug: 'hypothesis',
    description: 'Assumption to validate with evidence.',
    color: '#0d8df7',
    icon: 'lightbulb',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Experiment',
    slug: 'experiment',
    description: 'Experiment plan or execution work item.',
    color: '#f59e0b',
    icon: 'flask',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Insight',
    slug: 'insight',
    description: 'Learning captured from discovery.',
    color: '#16a34a',
    icon: 'sparkles',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  }
];

const productDiscoveryStates: DefaultStateSeed[] = [
  { name: 'Backlog', slug: 'backlog', category: 'todo', color: '#64748b' },
  { name: 'Discovery', slug: 'discovery', category: 'doing', color: '#0d8df7' },
  { name: 'Experiment', slug: 'experiment', category: 'doing', color: '#f59e0b' },
  { name: 'Validated', slug: 'validated', category: 'done', color: '#22c55e', isTerminal: true }
];

const productDiscoveryColumns: DefaultColumnSeed[] = [
  { name: 'Backlog', slug: 'backlog', stateSlugs: ['backlog'] },
  { name: 'Discovery', slug: 'discovery', stateSlugs: ['discovery'], wipLimit: 8 },
  { name: 'Experiment', slug: 'experiment', stateSlugs: ['experiment'], wipLimit: 6 },
  { name: 'Validated', slug: 'validated', stateSlugs: ['validated'] }
];

const productDiscoveryTypeSlugs = productDiscoveryItemTypes.map((itemType) => itemType.slug);

const productDiscoveryCustomFields: DefaultCustomFieldSeed[] = [
  {
    name: 'Confidence',
    slug: 'confidence',
    description: 'Confidence score for the current hypothesis.',
    type: 'NUMBER',
    scopeTypeSlugs: productDiscoveryTypeSlugs
  },
  {
    name: 'Impact',
    slug: 'impact',
    description: 'Expected impact level for product outcomes.',
    type: 'SELECT',
    options: [
      { label: 'High', value: 'high', color: '#dc2626' },
      { label: 'Medium', value: 'medium', color: '#f59e0b' },
      { label: 'Low', value: 'low', color: '#22c55e' }
    ],
    scopeTypeSlugs: productDiscoveryTypeSlugs
  }
];

const productDiscoveryBoardViews: DefaultBoardViewSeed[] = [
  {
    key: 'discovery',
    name: 'DISCOVERY',
    caption: 'Ideias, hipoteses e experimentos em validacao',
    visibleBoardColumnSlugs: ['backlog', 'discovery', 'experiment', 'validated'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'discovery', label: 'Discovery', dot: '#0d8df7' },
      { id: 'experiment', label: 'Experiment', dot: '#f59e0b' },
      { id: 'validated', label: 'Validated', dot: '#22c55e' }
    ]
  },
  {
    key: 'product',
    name: 'PRODUCT',
    caption: 'Visao de impacto e confianca das iniciativas',
    visibleBoardColumnSlugs: ['discovery', 'experiment', 'validated'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
      { id: 'discovery', label: 'Discovery', dot: '#0d8df7' },
      { id: 'experiment', label: 'Experiment', dot: '#f59e0b' },
      { id: 'validated', label: 'Validated', dot: '#22c55e' }
    ]
  }
];

const operationsKanbanItemTypes: DefaultTypeSeed[] = [
  {
    name: 'Incident',
    slug: 'incident',
    description: 'Operational disruption requiring fast response.',
    color: '#dc2626',
    icon: 'siren',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Request',
    slug: 'request',
    description: 'Operational request from internal or external users.',
    color: '#0369a1',
    icon: 'inbox',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Maintenance',
    slug: 'maintenance',
    description: 'Preventive or corrective maintenance task.',
    color: '#f59e0b',
    icon: 'wrench',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  },
  {
    name: 'Problem',
    slug: 'problem',
    description: 'Root-cause investigation and structural fix.',
    color: '#7c3aed',
    icon: 'search',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  }
];

const operationsKanbanStates: DefaultStateSeed[] = [
  { name: 'Queue', slug: 'queue', category: 'todo', color: '#64748b' },
  { name: 'Triage', slug: 'triage', category: 'doing', color: '#0d8df7' },
  { name: 'In Progress', slug: 'in-progress', category: 'doing', color: '#f59e0b' },
  { name: 'Resolved', slug: 'resolved', category: 'done', color: '#22c55e', isTerminal: true },
  { name: 'Blocked', slug: 'blocked', category: 'blocked', color: '#ef4444' }
];

const operationsKanbanColumns: DefaultColumnSeed[] = [
  { name: 'Queue', slug: 'queue', stateSlugs: ['queue'] },
  { name: 'Triage', slug: 'triage', stateSlugs: ['triage', 'blocked'], wipLimit: 12 },
  { name: 'Execution', slug: 'execution', stateSlugs: ['in-progress'], wipLimit: 8 },
  { name: 'Resolved', slug: 'resolved', stateSlugs: ['resolved'] }
];

const operationsKanbanTypeSlugs = operationsKanbanItemTypes.map((itemType) => itemType.slug);

const operationsKanbanCustomFields: DefaultCustomFieldSeed[] = [
  {
    name: 'Severity',
    slug: 'severity',
    description: 'Operational severity of the work item.',
    type: 'SELECT',
    options: [
      { label: 'P1 Critical', value: 'p1', color: '#dc2626' },
      { label: 'P2 High', value: 'p2', color: '#f97316' },
      { label: 'P3 Medium', value: 'p3', color: '#f59e0b' },
      { label: 'P4 Low', value: 'p4', color: '#22c55e' }
    ],
    scopeTypeSlugs: operationsKanbanTypeSlugs
  },
  {
    name: 'SLA Hours',
    slug: 'sla-hours',
    description: 'Target SLA in hours for completion.',
    type: 'NUMBER',
    scopeTypeSlugs: operationsKanbanTypeSlugs
  }
];

const operationsKanbanBoardViews: DefaultBoardViewSeed[] = [
  {
    key: 'ops',
    name: 'OPS',
    caption: 'Controle operacional e fila de atendimento',
    visibleBoardColumnSlugs: ['queue', 'triage', 'execution', 'resolved'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'queue', label: 'Queue', dot: '#8b9bb0' },
      { id: 'triage', label: 'Triage', dot: '#0d8df7' },
      { id: 'in-progress', label: 'In Progress', dot: '#f59e0b' },
      { id: 'resolved', label: 'Resolved', dot: '#22c55e' }
    ]
  },
  {
    key: 'leadership',
    name: 'LEADERSHIP',
    caption: 'Visao de risco e capacidade operacional',
    visibleBoardColumnSlugs: ['triage', 'execution', 'resolved'],
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'queue', label: 'Queue', dot: '#8b9bb0' },
      { id: 'triage', label: 'Triage', dot: '#0d8df7' },
      { id: 'in-progress', label: 'In Progress', dot: '#f59e0b' },
      { id: 'resolved', label: 'Resolved', dot: '#22c55e' }
    ]
  }
];

const templateSeedPresets: Record<WorkspaceTemplateKey, TemplateSeedPreset> = {
  software_delivery: {
    templateKey: 'software_delivery',
    itemTypes: softwareDeliveryItemTypes,
    workflowStates: softwareDeliveryStates,
    columns: softwareDeliveryColumns,
    customFields: softwareDeliveryCustomFields,
    defaultBoardMode: 'dev',
    defaultVisibleCardFields: [...defaultSystemCardFieldIds, 'story-points', 'severity'],
    defaultVisibleDetailFields: [...defaultSystemDetailFieldIds, 'story-points', 'severity'],
    defaultBoardViews: softwareDeliveryBoardViews
  },
  product_discovery: {
    templateKey: 'product_discovery',
    itemTypes: productDiscoveryItemTypes,
    workflowStates: productDiscoveryStates,
    columns: productDiscoveryColumns,
    customFields: productDiscoveryCustomFields,
    defaultBoardMode: 'discovery',
    defaultVisibleCardFields: [...defaultSystemCardFieldIds, 'impact'],
    defaultVisibleDetailFields: [...defaultSystemDetailFieldIds, 'impact', 'confidence'],
    defaultBoardViews: productDiscoveryBoardViews
  },
  operations_kanban: {
    templateKey: 'operations_kanban',
    itemTypes: operationsKanbanItemTypes,
    workflowStates: operationsKanbanStates,
    columns: operationsKanbanColumns,
    customFields: operationsKanbanCustomFields,
    defaultBoardMode: 'ops',
    defaultVisibleCardFields: [...defaultSystemCardFieldIds, 'severity'],
    defaultVisibleDetailFields: [...defaultSystemDetailFieldIds, 'severity', 'sla-hours'],
    defaultBoardViews: operationsKanbanBoardViews
  }
};

const legacyTypeMap: Record<string, string> = {
  card: 'user-story',
  note: 'task',
  story: 'user-story',
  incident: 'incident',
  bug: 'bug',
  request: 'request',
  maintenance: 'maintenance',
  problem: 'problem',
  opportunity: 'opportunity',
  hypothesis: 'hypothesis',
  experiment: 'experiment',
  insight: 'insight'
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
  blocked: 'blocked',
  queue: 'queue',
  triage: 'triage',
  resolved: 'resolved',
  discovery: 'discovery',
  validated: 'validated'
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isWorkspaceTemplateKey(value: unknown): value is WorkspaceTemplateKey {
  return value === 'software_delivery' || value === 'product_discovery' || value === 'operations_kanban';
}

async function resolveStoredTemplateKey(
  prisma: PrismaExecutor,
  workspaceId: string
): Promise<WorkspaceTemplateKey | undefined> {
  const preferences = await prisma.workspacePreferences.findUnique({
    where: { workspaceId },
    select: { settings: true }
  });

  if (!preferences?.settings || typeof preferences.settings !== 'object' || Array.isArray(preferences.settings)) {
    return undefined;
  }

  const templateKey = (preferences.settings as Record<string, unknown>).templateKey;
  return isWorkspaceTemplateKey(templateKey) ? templateKey : undefined;
}

function resolveTemplatePreset(templateKey?: WorkspaceTemplateKey): TemplateSeedPreset {
  if (!templateKey) {
    return templateSeedPresets.software_delivery;
  }

  return templateSeedPresets[templateKey] ?? templateSeedPresets.software_delivery;
}

function buildDefaultFieldMapByType(
  itemTypes: DefaultTypeSeed[],
  fieldIds: string[]
): Record<string, string[]> {
  return itemTypes.reduce<Record<string, string[]>>((acc, itemType) => {
    acc[itemType.slug] = [...fieldIds];
    return acc;
  }, {});
}

function buildStatusToColumnSlugMap(columns: DefaultColumnSeed[]): Record<string, string> {
  return columns.reduce<Record<string, string>>((acc, column) => {
    for (const stateSlug of column.stateSlugs) {
      if (!acc[stateSlug]) {
        acc[stateSlug] = column.slug;
      }
    }
    return acc;
  }, {});
}

function getSeededBoardViews(
  templateKey: WorkspaceTemplateKey | undefined,
  fallbackBoardViews: DefaultBoardViewSeed[]
): DefaultBoardViewSeed[] {
  const selectedTemplate = getWorkspaceTemplateByKey(templateKey);
  const schema = selectedTemplate?.schema;

  if (
    schema &&
    typeof schema === 'object' &&
    !Array.isArray(schema) &&
    Array.isArray((schema as Record<string, unknown>).perspectives)
  ) {
    return (schema as Record<string, unknown>).perspectives as DefaultBoardViewSeed[];
  }

  if (
    schema &&
    typeof schema === 'object' &&
    !Array.isArray(schema) &&
    Array.isArray((schema as Record<string, unknown>).boardViews)
  ) {
    return (schema as Record<string, unknown>).boardViews as DefaultBoardViewSeed[];
  }

  return fallbackBoardViews;
}

export async function ensureWorkspaceDefaultConfiguration(
  prisma: PrismaExecutor,
  input: {
    workspaceId: string;
    ownerUserId?: string;
    templateKey?: WorkspaceTemplateKey;
  }
): Promise<{ defaultBoardId: string }> {
  const resolvedTemplateKey = input.templateKey ?? (await resolveStoredTemplateKey(prisma, input.workspaceId));
  const preset = resolveTemplatePreset(resolvedTemplateKey);
  const seedResult = await seedWorkspaceConfigurationDefaults(
    prisma,
    input.workspaceId,
    resolvedTemplateKey
  );

  await backfillLegacyItems(prisma, input.workspaceId, input.ownerUserId, preset);
  return seedResult;
}

export async function seedWorkspaceConfigurationDefaults(
  prisma: PrismaExecutor,
  workspaceId: string,
  templateKey?: WorkspaceTemplateKey
): Promise<{ defaultBoardId: string }> {
  const preset = resolveTemplatePreset(templateKey);
  const board = await ensureDefaultBoard(prisma, workspaceId);

  const typeBySlug = new Map<string, string>();
  for (const [index, typeSeed] of preset.itemTypes.entries()) {
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
        usageRules: toPrismaJson({ source: 'seed.default', templateKey: preset.templateKey }),
        acceptsParent: typeSeed.acceptsParent,
        acceptsChecklist: typeSeed.acceptsChecklist,
        acceptsDueDate: typeSeed.acceptsDueDate,
        acceptsAssignee: typeSeed.acceptsAssignee,
        acceptsTags: typeSeed.acceptsTags,
        acceptsCustomFields: typeSeed.acceptsCustomFields
      },
      update: {
        position: index,
        isActive: true
      }
    });

    typeBySlug.set(typeSeed.slug, type.id);
  }

  const stateBySlug = new Map<string, string>();
  for (const [index, stateSeed] of preset.workflowStates.entries()) {
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
      update: {
        position: index,
        isActive: true,
        isTerminal: Boolean(stateSeed.isTerminal)
      }
    });

    stateBySlug.set(stateSeed.slug, state.id);
  }

  const columnBySlug = new Map<string, string>();
  for (const [index, columnSeed] of preset.columns.entries()) {
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
      update: {
        position: index,
        isActive: true,
        wipLimit: columnSeed.wipLimit ?? null
      }
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
        settings: toPrismaJson({
          source: 'workspace-default-seed',
          workspaceColumnId: column.id,
          templateKey: preset.templateKey
        })
      },
      update: {
        name: columnSeed.name,
        position: index,
        settings: toPrismaJson({
          source: 'workspace-default-seed',
          workspaceColumnId: column.id,
          templateKey: preset.templateKey
        })
      }
    });
  }

  for (const columnSeed of preset.columns) {
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
        update: {
          position
        }
      });
    }
  }

  const seededBoardViews = getSeededBoardViews(templateKey, preset.defaultBoardViews);
  const defaultBoardMode = seededBoardViews[0]?.key ?? preset.defaultBoardMode;

  await prisma.workspacePreferences.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultBoardMode,
      dateFormat: 'dd/mm/yyyy',
      visibleCardFieldIds: toPrismaJson(preset.defaultVisibleCardFields),
      settings: toPrismaJson({
        templateKey: preset.templateKey,
        cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION,
        visibleFieldsByType: buildDefaultFieldMapByType(
          preset.itemTypes,
          preset.defaultVisibleCardFields
        ),
        detailVisibleFieldsByType: buildDefaultFieldMapByType(
          preset.itemTypes,
          preset.defaultVisibleDetailFields
        ),
        perspectives: seededBoardViews.map((view, position) => ({
          key: view.key,
          name: view.name,
          caption: view.caption,
          compactCards: Boolean(view.compactCards),
          position,
          allowedTaskTypes: view.allowedTaskTypes ?? [],
          visibleBoardColumnIds: (view.visibleBoardColumnSlugs ?? preset.columns.map((column) => column.slug))
            .map((slug) => columnBySlug.get(slug))
            .filter((value): value is string => Boolean(value)),
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

  for (const [index, customFieldSeed] of preset.customFields.entries()) {
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
        position: index,
        settings: customFieldSeed.settings
          ? toPrismaJson(customFieldSeed.settings)
          : undefined
      },
      update: {
        position: index,
        isActive: true,
        settings:
          customFieldSeed.settings !== undefined
            ? toPrismaJson(customFieldSeed.settings)
            : undefined
      }
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
        update: {
          label: option.label,
          color: option.color,
          position: optionIndex,
          isActive: true
        }
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
  ownerUserId: string | undefined,
  preset: TemplateSeedPreset
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
  const validTypeIds = new Set(types.map((entry) => entry.id));
  const validStateIds = new Set(states.map((entry) => entry.id));
  const validColumnIds = new Set(columns.map((entry) => entry.id));

  const defaultTypeSlug = preset.itemTypes[0]?.slug ?? types[0]?.slug;
  const defaultStateSlug = preset.workflowStates[0]?.slug ?? states[0]?.slug;
  const defaultColumnSlug = preset.columns[0]?.slug ?? columns[0]?.slug;

  if (!defaultTypeSlug || !defaultStateSlug || !defaultColumnSlug) {
    return;
  }

  const typeSlugSet = new Set(types.map((entry) => entry.slug));
  const stateSlugSet = new Set(states.map((entry) => entry.slug));
  const statusToColumnSlugMap = buildStatusToColumnSlugMap(preset.columns);

  for (const item of items) {
    const legacyType = normalizeKey(item.type);
    const legacyState = normalizeKey(item.status);

    const mappedTypeSlug = legacyTypeMap[legacyType] ?? legacyType;
    const mappedStateSlug = legacyStatusMap[legacyState] ?? legacyState;

    const resolvedTypeSlug = typeSlugSet.has(mappedTypeSlug)
      ? mappedTypeSlug
      : defaultTypeSlug;
    const resolvedStateSlug = stateSlugSet.has(mappedStateSlug)
      ? mappedStateSlug
      : defaultStateSlug;

    const mappedColumnSlug = statusToColumnSlugMap[resolvedStateSlug] ?? defaultColumnSlug;

    const resolvedTypeId =
      item.typeId && validTypeIds.has(item.typeId)
        ? item.typeId
        : typeBySlug.get(resolvedTypeSlug) ?? typeBySlug.get(defaultTypeSlug) ?? null;

    const resolvedStateId =
      item.stateId && validStateIds.has(item.stateId)
        ? item.stateId
        : stateBySlug.get(resolvedStateSlug) ?? stateBySlug.get(defaultStateSlug) ?? null;

    const resolvedColumnId =
      item.boardColumnId && validColumnIds.has(item.boardColumnId)
        ? item.boardColumnId
        : columnBySlug.get(mappedColumnSlug) ??
          columnBySlug.get(defaultColumnSlug) ??
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
