import type { CustomFieldInputType } from '@/modules/workspace-platform/application/shared';

export type WorkspaceTemplateKey = 'software_delivery' | 'product_discovery' | 'operations_kanban';

export type WorkspaceTemplateFieldOption = {
  label: string;
  value: string;
  color?: string;
};

export type WorkspaceTemplateFieldDefinition = {
  id: string;
  label: string;
  slug: string;
  description?: string;
  type: CustomFieldInputType;
  required?: boolean;
  options?: WorkspaceTemplateFieldOption[];
  scopeTypeIds: string[];
  config?: Record<string, unknown>;
};

export type WorkspaceTemplateFieldBinding = {
  fieldId: string;
  typeId: string;
  displayContext: 'card' | 'detail';
  order: number;
  section?: 'main' | 'side';
  isVisible?: boolean;
};

export type WorkspaceTemplatePerspective = {
  key: string;
  name: string;
  caption: string;
  statuses: Array<{ id: string; label: string; dot: string }>;
  statusSource: { kind: 'workflow_state' } | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  compactCards?: boolean;
  visibleBoardColumnSlugs?: string[];
  allowedTaskTypes?: string[];
};

export type WorkspaceTemplateSchema = {
  lanes: string[];
  issueTypes: string[];
  perspectives: WorkspaceTemplatePerspective[];
  fieldDefinitions?: WorkspaceTemplateFieldDefinition[];
  fieldBindings?: WorkspaceTemplateFieldBinding[];
};

export type WorkspaceTemplateDefinition = {
  key: WorkspaceTemplateKey;
  name: string;
  description: string;
  boardName: string;
  boardDescription: string;
  schema: WorkspaceTemplateSchema;
  rules: Record<string, unknown>;
};

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
  'sys:schedule',
  'sys:due-date'
];

const defaultDetailSectionByFieldId: Record<string, 'main' | 'side'> = {
  'sys:title': 'main',
  'sys:description': 'main',
  'sys:priority': 'main',
  'sys:type': 'side',
  'sys:status': 'side',
  'sys:created-by': 'side',
  'sys:assignee': 'side',
  'sys:tags': 'side',
  'sys:checklist': 'main',
  'sys:schedule': 'side',
  'sys:due-date': 'side'
};

function uniqueFieldIds(fieldIds: string[]): string[] {
  return Array.from(new Set(fieldIds.filter((fieldId) => typeof fieldId === 'string' && fieldId.trim().length > 0)));
}

function buildTemplateFieldBindings(input: {
  typeIds: string[];
  extraCardFieldIds?: string[];
  extraDetailFieldIds?: string[];
  detailSectionByFieldId?: Record<string, 'main' | 'side'>;
}): WorkspaceTemplateFieldBinding[] {
  const cardFieldIds = uniqueFieldIds([...defaultSystemCardFieldIds, ...(input.extraCardFieldIds ?? [])]);
  const detailFieldIds = uniqueFieldIds([...defaultSystemDetailFieldIds, ...(input.extraDetailFieldIds ?? [])]);

  return input.typeIds.flatMap((typeId) => [
    ...cardFieldIds.map((fieldId, order) => ({
      fieldId,
      typeId,
      displayContext: 'card' as const,
      order,
      isVisible: true
    })),
    ...detailFieldIds.map((fieldId, order) => ({
      fieldId,
      typeId,
      displayContext: 'detail' as const,
      order,
      section: input.detailSectionByFieldId?.[fieldId] ?? defaultDetailSectionByFieldId[fieldId] ?? 'side',
      isVisible: true
    }))
  ]);
}

const softwareDeliveryIssueTypes = ['bug', 'task', 'user-story', 'epic', 'spike'];
const productDiscoveryIssueTypes = ['opportunity', 'hypothesis', 'experiment', 'insight'];
const operationsIssueTypes = ['incident', 'request', 'maintenance', 'problem'];

const softwareDeliveryStatuses = [
  { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
  { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
  { id: 'in-review', label: 'Review', dot: '#f59e0b' },
  { id: 'done', label: 'Done', dot: '#22c55e' }
];

const productDiscoveryStatuses = [
  { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
  { id: 'discovery', label: 'Discovery', dot: '#0d8df7' },
  { id: 'experiment', label: 'Experiment', dot: '#f59e0b' },
  { id: 'validated', label: 'Validated', dot: '#22c55e' }
];

const operationsStatuses = [
  { id: 'queue', label: 'Queue', dot: '#8b9bb0' },
  { id: 'triage', label: 'Triage', dot: '#0d8df7' },
  { id: 'in-progress', label: 'In Progress', dot: '#f59e0b' },
  { id: 'resolved', label: 'Resolved', dot: '#22c55e' }
];

const softwareDeliveryFieldDefinitions: WorkspaceTemplateFieldDefinition[] = [
  {
    id: 'story-points',
    label: 'Story Points',
    slug: 'story-points',
    description: 'Relative effort estimation.',
    type: 'number',
    scopeTypeIds: softwareDeliveryIssueTypes
  },
  {
    id: 'severity',
    label: 'Severity',
    slug: 'severity',
    description: 'Business and technical severity level.',
    type: 'select',
    options: [
      { label: 'Critical', value: 'critical', color: '#dc2626' },
      { label: 'High', value: 'high', color: '#f97316' },
      { label: 'Medium', value: 'medium', color: '#f59e0b' },
      { label: 'Low', value: 'low', color: '#22c55e' }
    ],
    scopeTypeIds: softwareDeliveryIssueTypes
  }
];

const productDiscoveryFieldDefinitions: WorkspaceTemplateFieldDefinition[] = [
  {
    id: 'impact',
    label: 'Impact',
    slug: 'impact',
    description: 'Expected customer or business impact.',
    type: 'select',
    options: [
      { label: 'High', value: 'high', color: '#16a34a' },
      { label: 'Medium', value: 'medium', color: '#0d8df7' },
      { label: 'Low', value: 'low', color: '#f59e0b' }
    ],
    scopeTypeIds: productDiscoveryIssueTypes
  },
  {
    id: 'confidence',
    label: 'Confidence',
    slug: 'confidence',
    description: 'Level of confidence on the learning signal.',
    type: 'number',
    scopeTypeIds: productDiscoveryIssueTypes
  }
];

const operationsFieldDefinitions: WorkspaceTemplateFieldDefinition[] = [
  {
    id: 'severity',
    label: 'Severity',
    slug: 'severity',
    description: 'Operational severity level.',
    type: 'select',
    options: [
      { label: 'Critical', value: 'critical', color: '#dc2626' },
      { label: 'High', value: 'high', color: '#f97316' },
      { label: 'Medium', value: 'medium', color: '#f59e0b' },
      { label: 'Low', value: 'low', color: '#22c55e' }
    ],
    scopeTypeIds: operationsIssueTypes
  },
  {
    id: 'sla-hours',
    label: 'SLA (hours)',
    slug: 'sla-hours',
    description: 'Target time window to resolve the demand.',
    type: 'number',
    scopeTypeIds: operationsIssueTypes
  }
];

const softwareDeliveryFieldBindings = buildTemplateFieldBindings({
  typeIds: softwareDeliveryIssueTypes,
  extraCardFieldIds: ['story-points', 'severity'],
  extraDetailFieldIds: ['story-points', 'severity']
});

const productDiscoveryFieldBindings = buildTemplateFieldBindings({
  typeIds: productDiscoveryIssueTypes,
  extraCardFieldIds: ['impact'],
  extraDetailFieldIds: ['impact', 'confidence']
});

const operationsFieldBindings = buildTemplateFieldBindings({
  typeIds: operationsIssueTypes,
  extraCardFieldIds: ['severity'],
  extraDetailFieldIds: ['severity', 'sla-hours']
});

export const workspaceTemplateCatalog: WorkspaceTemplateDefinition[] = [
  {
    key: 'software_delivery',
    name: 'Entrega de software',
    description: 'Backlog, execucao, revisao e pronto. Uma base objetiva para times de produto e engenharia.',
    boardName: 'Entrega',
    boardDescription: 'Fluxo simples para planejar, executar e validar entregas.',
    schema: {
      lanes: ['backlog', 'doing', 'review', 'done'],
      issueTypes: softwareDeliveryIssueTypes,
      perspectives: [
        {
          key: 'dev',
          name: 'DEV',
          caption: 'Fluxo operacional principal',
          statuses: softwareDeliveryStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['backlog', 'doing', 'review', 'done']
        },
        {
          key: 'qa',
          name: 'QA',
          caption: 'Validacao e conformidade',
          statuses: softwareDeliveryStatuses,
          statusSource: { kind: 'workflow_state' },
          compactCards: true,
          visibleBoardColumnSlugs: ['review', 'done']
        },
        {
          key: 'management',
          name: 'GESTAO',
          caption: 'Acompanhamento executivo',
          statuses: softwareDeliveryStatuses,
          statusSource: { kind: 'workflow_state' },
          allowedTaskTypes: softwareDeliveryIssueTypes,
          visibleBoardColumnSlugs: ['doing', 'review', 'done']
        }
      ],
      fieldDefinitions: softwareDeliveryFieldDefinitions,
      fieldBindings: softwareDeliveryFieldBindings
    },
    rules: {
      wipLimits: { doing: 10, review: 6 },
      doneState: 'done'
    }
  },
  {
    key: 'product_discovery',
    name: 'Descoberta de produto',
    description: 'Oportunidades, hipoteses, experimentos e aprendizados sem excesso de etapas.',
    boardName: 'Descoberta',
    boardDescription: 'Organize ideias, testes e aprendizados de produto.',
    schema: {
      lanes: ['backlog', 'discovery', 'experiment', 'validated'],
      issueTypes: productDiscoveryIssueTypes,
      perspectives: [
        {
          key: 'discovery',
          name: 'DISCOVERY',
          caption: 'Ideias, hipoteses e experimentos em validacao',
          statuses: productDiscoveryStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['backlog', 'discovery', 'experiment', 'validated']
        },
        {
          key: 'product',
          name: 'PRODUCT',
          caption: 'Visao de impacto e confianca das iniciativas',
          statuses: productDiscoveryStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['discovery', 'experiment', 'validated']
        }
      ],
      fieldDefinitions: productDiscoveryFieldDefinitions,
      fieldBindings: productDiscoveryFieldBindings
    },
    rules: {
      doneState: 'validated',
      defaultPriority: 'medium'
    }
  },
  {
    key: 'operations_kanban',
    name: 'Operacoes',
    description: 'Fila, triagem, execucao e resolucao para rotinas operacionais.',
    boardName: 'Operacoes',
    boardDescription: 'Controle demandas operacionais com clareza.',
    schema: {
      lanes: ['queue', 'triage', 'execution', 'resolved'],
      issueTypes: operationsIssueTypes,
      perspectives: [
        {
          key: 'ops',
          name: 'OPS',
          caption: 'Controle operacional e fila de atendimento',
          statuses: operationsStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['queue', 'triage', 'execution', 'resolved']
        },
        {
          key: 'leadership',
          name: 'LEADERSHIP',
          caption: 'Visao de risco e capacidade operacional',
          statuses: operationsStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['triage', 'execution', 'resolved']
        }
      ],
      fieldDefinitions: operationsFieldDefinitions,
      fieldBindings: operationsFieldBindings
    },
    rules: {
      doneState: 'resolved',
      slaTracking: true
    }
  }
];

export function getWorkspaceTemplateByKey(
  templateKey: string | undefined
): WorkspaceTemplateDefinition | null {
  if (!templateKey) {
    return null;
  }

  return workspaceTemplateCatalog.find((template) => template.key === templateKey) ?? null;
}
