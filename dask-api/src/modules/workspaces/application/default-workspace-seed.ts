import { Prisma, type PrismaClient } from '@prisma/client';
import { SYSTEM_FIELD_SEEDS } from '@/modules/workspace-platform/application/field-platform';
import { isRecord, mapInputTypeToPrisma } from '@/modules/workspace-platform/application/shared';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateFieldBinding,
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
  variableKey?: string;
  variableLabel?: string;
  variableDescription?: string;
  type:
    | 'TEXT'
    | 'LONG_TEXT'
    | 'NUMBER'
    | 'DATE'
    | 'DATETIME'
    | 'BOOLEAN'
    | 'SELECT'
    | 'MULTI_SELECT'
    | 'USER'
    | 'CHECKLIST'
    | 'PRIORITY'
    | 'STATUS'
    | 'TAG'
    | 'SCHEDULE'
    | 'WORK_ITEM_TYPE';
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
  createTaskColumnSlugs?: string[];
  statusSource:
    | { kind: 'workflow_state' }
    | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  statuses: Array<{ id: string; label: string; dot: string }>;
};

type TemplateAutomationSeed = {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: Record<string, unknown>;
  action?: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  validations?: string[];
};

type SeededAutomationRuleSpec = {
  automationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  priority: number;
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

const CARD_FIELDS_SCHEMA_VERSION = 3;
const TEMPLATE_AUTOMATION_SCHEMA_VERSION = 6;

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

const commercialItemTypes: DefaultTypeSeed[] = [
  {
    name: 'Comercial',
    slug: 'commercial',
    description: 'Lead, oportunidade, proposta, contrato, cobranca e pagamento no mesmo work item.',
    color: '#0f766e',
    icon: 'briefcase-business',
    acceptsParent: true,
    acceptsChecklist: true,
    acceptsDueDate: true,
    acceptsAssignee: true,
    acceptsTags: true,
    acceptsCustomFields: true
  }
];

const commercialStates: DefaultStateSeed[] = [
  { name: 'Novo lead', slug: 'lead_new', category: 'entrada', color: '#0d8df7' },
  { name: 'Qualificacao', slug: 'lead_qualification', category: 'entrada', color: '#4f46e5' },
  { name: 'Oportunidade aberta', slug: 'opportunity_open', category: 'venda', color: '#0891b2' },
  { name: 'Proposta em preparacao', slug: 'proposal_preparing', category: 'venda', color: '#f59e0b' },
  { name: 'Proposta enviada', slug: 'proposal_sent', category: 'venda', color: '#d97706' },
  { name: 'Proposta aprovada', slug: 'proposal_approved', category: 'venda', color: '#16a34a' },
  { name: 'Contrato em preparacao', slug: 'contract_preparing', category: 'formalizacao', color: '#7c3aed' },
  { name: 'Contrato enviado', slug: 'contract_sent', category: 'formalizacao', color: '#6d28d9' },
  { name: 'Contrato aceito / assinado', slug: 'contract_accepted', category: 'formalizacao', color: '#22c55e' },
  { name: 'Cobranca gerada', slug: 'billing_created', category: 'financeiro', color: '#0369a1' },
  { name: 'Aguardando pagamento', slug: 'payment_waiting', category: 'financeiro', color: '#0f766e' },
  { name: 'Pago / Ativo', slug: 'paid_active', category: 'financeiro', color: '#15803d', isTerminal: true },
  { name: 'Perdido', slug: 'lost', category: 'finalizacao', color: '#dc2626', isTerminal: true },
  { name: 'Encerrado', slug: 'closed', category: 'finalizacao', color: '#64748b', isTerminal: true }
];

const commercialColumns: DefaultColumnSeed[] = commercialStates.map((state) => ({
  name: state.name,
  slug: state.slug,
  stateSlugs: [state.slug]
}));

const commercialTypeSlugs = commercialItemTypes.map((itemType) => itemType.slug);

const commercialCustomFields: DefaultCustomFieldSeed[] = [
  { name: 'Cliente vinculado', slug: 'customerId', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Contato vinculado', slug: 'contactId', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Nome do contato', slug: 'contactName', variableKey: 'contactName', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Email do contato', slug: 'contactEmail', variableKey: 'contactEmail', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Telefone do contato', slug: 'contactPhone', variableKey: 'contactPhone', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Empresa', slug: 'companyName', variableKey: 'companyName', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Nome do cliente', slug: 'clientName', variableKey: 'clientName', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Logo do cliente', slug: 'clientLogoUrl', variableKey: 'clientLogoUrl', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Origem', slug: 'source', variableKey: 'leadSource', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Interesse / escopo', slug: 'interest', variableKey: 'implementationScope', type: 'LONG_TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Valor estimado', slug: 'estimatedValue', variableKey: 'dealValue', type: 'NUMBER', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Probabilidade', slug: 'probability', type: 'NUMBER', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Previsao de fechamento', slug: 'expectedCloseDate', variableKey: 'expectedCloseDate', type: 'DATE', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Validade da proposta', slug: 'proposalValidity', variableKey: 'proposalValidity', type: 'DATE', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Condicoes comerciais', slug: 'paymentTerms', variableKey: 'paymentTerms', type: 'LONG_TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Proposta', slug: 'proposalId', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Contrato', slug: 'contractId', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs },
  { name: 'Ordem de cobranca', slug: 'billingOrderId', type: 'TEXT', scopeTypeSlugs: commercialTypeSlugs }
];

const commercialBoardViews: DefaultBoardViewSeed[] = [
  {
    key: 'entrada',
    name: 'Entrada',
    caption: 'Captura e qualificacao comercial',
    visibleBoardColumnSlugs: ['lead_new', 'lead_qualification'],
    createTaskColumnSlugs: ['lead_new'],
    allowedTaskTypes: commercialTypeSlugs,
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'lead_new', label: 'Novo lead', dot: '#0d8df7' },
      { id: 'lead_qualification', label: 'Qualificacao', dot: '#4f46e5' }
    ]
  },
  {
    key: 'venda',
    name: 'Venda',
    caption: 'Oportunidade e proposta comercial',
    visibleBoardColumnSlugs: ['opportunity_open', 'proposal_preparing', 'proposal_sent', 'proposal_approved'],
    createTaskColumnSlugs: [],
    allowedTaskTypes: commercialTypeSlugs,
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'opportunity_open', label: 'Oportunidade aberta', dot: '#0891b2' },
      { id: 'proposal_preparing', label: 'Proposta em preparacao', dot: '#f59e0b' },
      { id: 'proposal_sent', label: 'Proposta enviada', dot: '#d97706' },
      { id: 'proposal_approved', label: 'Proposta aprovada', dot: '#16a34a' }
    ]
  },
  {
    key: 'formalizacao',
    name: 'Formalizacao',
    caption: 'Contrato e aceite',
    visibleBoardColumnSlugs: ['contract_preparing', 'contract_sent', 'contract_accepted'],
    createTaskColumnSlugs: [],
    allowedTaskTypes: commercialTypeSlugs,
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'contract_preparing', label: 'Contrato em preparacao', dot: '#7c3aed' },
      { id: 'contract_sent', label: 'Contrato enviado', dot: '#6d28d9' },
      { id: 'contract_accepted', label: 'Contrato aceito / assinado', dot: '#22c55e' }
    ]
  },
  {
    key: 'financeiro',
    name: 'Financeiro',
    caption: 'Cobranca e pagamento',
    visibleBoardColumnSlugs: ['billing_created', 'payment_waiting', 'paid_active'],
    createTaskColumnSlugs: [],
    allowedTaskTypes: commercialTypeSlugs,
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'billing_created', label: 'Cobranca gerada', dot: '#0369a1' },
      { id: 'payment_waiting', label: 'Aguardando pagamento', dot: '#0f766e' },
      { id: 'paid_active', label: 'Pago / Ativo', dot: '#15803d' }
    ]
  },
  {
    key: 'finalizacao',
    name: 'Finalizacao',
    caption: 'Perdas e encerramentos',
    visibleBoardColumnSlugs: ['lost', 'closed'],
    createTaskColumnSlugs: [],
    allowedTaskTypes: commercialTypeSlugs,
    statusSource: { kind: 'workflow_state' },
    statuses: [
      { id: 'lost', label: 'Perdido', dot: '#dc2626' },
      { id: 'closed', label: 'Encerrado', dot: '#64748b' }
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
  },
  commercial_crm: {
    templateKey: 'commercial_crm',
    itemTypes: commercialItemTypes,
    workflowStates: commercialStates,
    columns: commercialColumns,
    customFields: commercialCustomFields,
    defaultBoardMode: 'entrada',
    defaultVisibleCardFields: [
      ...defaultSystemCardFieldIds,
      'customerId',
      'clientName',
      'companyName',
      'contactName',
      'estimatedValue',
      'proposalId',
      'contractId'
    ],
    defaultVisibleDetailFields: [
      ...defaultSystemDetailFieldIds,
      'customerId',
      'contactId',
      'contactName',
      'contactEmail',
      'contactPhone',
      'companyName',
      'clientName',
      'clientLogoUrl',
      'source',
      'interest',
      'estimatedValue',
      'probability',
      'expectedCloseDate',
      'proposalValidity',
      'paymentTerms',
      'proposalId',
      'contractId',
      'billingOrderId'
    ],
    defaultBoardViews: commercialBoardViews
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
  insight: 'insight',
  lead: 'commercial',
  deal: 'commercial',
  negocio: 'commercial',
  commercial: 'commercial'
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
  validated: 'validated',
  lead_new: 'lead_new',
  lead_qualification: 'lead_qualification',
  opportunity_open: 'opportunity_open',
  proposal_preparing: 'proposal_preparing',
  proposal_sent: 'proposal_sent',
  proposal_approved: 'proposal_approved',
  contract_preparing: 'contract_preparing',
  contract_sent: 'contract_sent',
  contract_accepted: 'contract_accepted',
  billing_created: 'billing_created',
  payment_waiting: 'payment_waiting',
  paid_active: 'paid_active',
  lost: 'lost',
  closed: 'closed'
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isWorkspaceTemplateKey(value: unknown): value is WorkspaceTemplateKey {
  return (
    value === 'software_delivery' ||
    value === 'product_discovery' ||
    value === 'operations_kanban' ||
    value === 'commercial_crm'
  );
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

type TemplateFieldLayoutMaps = {
  visibleCardFieldIds: string[];
  visibleFieldsByType: Record<string, string[]>;
  detailVisibleFieldsByType: Record<string, string[]>;
  detailFieldZoneByType: Record<string, Record<string, 'main' | 'side'>>;
};

function mapTemplateFieldTypeToSeed(type: unknown): DefaultCustomFieldSeed['type'] {
  switch (type) {
    case 'long_text':
      return 'LONG_TEXT';
    case 'number':
      return 'NUMBER';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'DATETIME';
    case 'boolean':
      return 'BOOLEAN';
    case 'select':
      return 'SELECT';
    case 'multi_select':
      return 'MULTI_SELECT';
    case 'user':
      return 'USER';
    case 'checklist':
      return 'CHECKLIST';
    case 'priority':
      return 'PRIORITY';
    case 'status':
      return 'STATUS';
    case 'tag':
      return 'TAG';
    case 'schedule':
      return 'SCHEDULE';
    case 'work_item_type':
      return 'WORK_ITEM_TYPE';
    default:
      return 'TEXT';
  }
}

function resolveTemplateFieldDefinitions(
  templateKey: WorkspaceTemplateKey | undefined,
  fallbackCustomFields: DefaultCustomFieldSeed[]
): DefaultCustomFieldSeed[] {
  const selectedTemplate = getWorkspaceTemplateByKey(templateKey);
  const schema = selectedTemplate?.schema;

  if (!isRecord(schema) || !Array.isArray(schema.fieldDefinitions)) {
    return fallbackCustomFields;
  }

  const definitions = schema.fieldDefinitions.reduce<DefaultCustomFieldSeed[]>((acc, rawDefinition) => {
    if (!isRecord(rawDefinition)) {
      return acc;
    }

    const slug = typeof rawDefinition.slug === 'string' ? rawDefinition.slug.trim() : '';
    const name = typeof rawDefinition.label === 'string' ? rawDefinition.label.trim() : '';
    const scopeTypeSlugs = Array.isArray(rawDefinition.scopeTypeIds)
      ? rawDefinition.scopeTypeIds.filter(
          (typeId): typeId is string => typeof typeId === 'string' && typeId.trim().length > 0
        )
      : [];

    if (!slug || !name || scopeTypeSlugs.length === 0) {
      return acc;
    }

    acc.push({
      name,
      slug,
      description:
        typeof rawDefinition.description === 'string' && rawDefinition.description.trim().length > 0
          ? rawDefinition.description
          : undefined,
      type: mapTemplateFieldTypeToSeed(rawDefinition.type),
      required: rawDefinition.required === true,
      variableKey:
        typeof rawDefinition.variableKey === 'string' && rawDefinition.variableKey.trim().length > 0
          ? rawDefinition.variableKey.trim()
          : undefined,
      variableLabel:
        typeof rawDefinition.variableLabel === 'string' && rawDefinition.variableLabel.trim().length > 0
          ? rawDefinition.variableLabel.trim()
          : undefined,
      variableDescription:
        typeof rawDefinition.variableDescription === 'string' && rawDefinition.variableDescription.trim().length > 0
          ? rawDefinition.variableDescription.trim()
          : undefined,
      options: Array.isArray(rawDefinition.options)
        ? rawDefinition.options.reduce<Array<{ label: string; value: string; color?: string }>>((optionsAcc, rawOption) => {
            if (!isRecord(rawOption)) {
              return optionsAcc;
            }

            const label = typeof rawOption.label === 'string' ? rawOption.label.trim() : '';
            const value = typeof rawOption.value === 'string' ? rawOption.value.trim() : '';
            if (!label || !value) {
              return optionsAcc;
            }

            optionsAcc.push({
              label,
              value,
              color: typeof rawOption.color === 'string' && rawOption.color.trim().length > 0 ? rawOption.color : undefined
            });
            return optionsAcc;
          }, [])
        : undefined,
      scopeTypeSlugs,
      settings: isRecord(rawDefinition.config) ? rawDefinition.config : undefined
    });

    return acc;
  }, []);

  return definitions.length > 0 ? definitions : fallbackCustomFields;
}

function buildFieldLayoutMapsFromTemplateBindings(input: {
  templateKey: WorkspaceTemplateKey | undefined;
  itemTypes: DefaultTypeSeed[];
  fallbackVisibleCardFieldIds: string[];
  fallbackDetailVisibleFieldIds: string[];
}): TemplateFieldLayoutMaps {
  const fallback: TemplateFieldLayoutMaps = {
    visibleCardFieldIds: [...input.fallbackVisibleCardFieldIds],
    visibleFieldsByType: buildDefaultFieldMapByType(input.itemTypes, input.fallbackVisibleCardFieldIds),
    detailVisibleFieldsByType: buildDefaultFieldMapByType(input.itemTypes, input.fallbackDetailVisibleFieldIds),
    detailFieldZoneByType: {}
  };

  const selectedTemplate = getWorkspaceTemplateByKey(input.templateKey);
  const schema = selectedTemplate?.schema;

  if (!isRecord(schema) || !Array.isArray(schema.fieldBindings)) {
    return fallback;
  }

  const typeSlugSet = new Set(input.itemTypes.map((itemType) => itemType.slug));
  const visibleFieldsByType = input.itemTypes.reduce<Record<string, string[]>>((acc, itemType) => {
    acc[itemType.slug] = [];
    return acc;
  }, {});
  const detailVisibleFieldsByType = input.itemTypes.reduce<Record<string, string[]>>((acc, itemType) => {
    acc[itemType.slug] = [];
    return acc;
  }, {});
  const detailFieldZoneByType = input.itemTypes.reduce<Record<string, Record<string, 'main' | 'side'>>>((acc, itemType) => {
    acc[itemType.slug] = {};
    return acc;
  }, {});

  const bindings = schema.fieldBindings
    .filter((binding): binding is WorkspaceTemplateFieldBinding => isRecord(binding))
    .map((binding) => ({
      fieldId: typeof binding.fieldId === 'string' ? binding.fieldId.trim() : '',
      typeId: typeof binding.typeId === 'string' ? binding.typeId.trim() : '',
      displayContext: binding.displayContext === 'detail' ? 'detail' : 'card',
      order: typeof binding.order === 'number' ? binding.order : 0,
      section: (binding.section === 'main' ? 'main' : 'side') as 'main' | 'side',
      isVisible: binding.isVisible !== false
    }))
    .filter((binding) => binding.fieldId.length > 0 && typeSlugSet.has(binding.typeId) && binding.isVisible)
    .sort((left, right) => {
      if (left.typeId !== right.typeId) {
        return left.typeId.localeCompare(right.typeId);
      }

      if (left.displayContext !== right.displayContext) {
        return left.displayContext.localeCompare(right.displayContext);
      }

      return left.order - right.order;
    });

  if (bindings.length === 0) {
    return fallback;
  }

  for (const binding of bindings) {
    if (binding.displayContext === 'card') {
      const list = visibleFieldsByType[binding.typeId] ?? [];
      if (!list.includes(binding.fieldId)) {
        list.push(binding.fieldId);
      }
      visibleFieldsByType[binding.typeId] = list;
      continue;
    }

    const list = detailVisibleFieldsByType[binding.typeId] ?? [];
    if (!list.includes(binding.fieldId)) {
      list.push(binding.fieldId);
    }
    detailVisibleFieldsByType[binding.typeId] = list;
    detailFieldZoneByType[binding.typeId] = {
      ...(detailFieldZoneByType[binding.typeId] ?? {}),
      [binding.fieldId]: binding.section
    };
  }

  for (const itemType of input.itemTypes) {
    if (visibleFieldsByType[itemType.slug].length === 0) {
      visibleFieldsByType[itemType.slug] = [...(fallback.visibleFieldsByType[itemType.slug] ?? [])];
    }

    if (detailVisibleFieldsByType[itemType.slug].length === 0) {
      detailVisibleFieldsByType[itemType.slug] = [...(fallback.detailVisibleFieldsByType[itemType.slug] ?? [])];
    }
  }

  const firstTypeSlug = input.itemTypes[0]?.slug;

  return {
    visibleCardFieldIds: firstTypeSlug
      ? [...(visibleFieldsByType[firstTypeSlug] ?? fallback.visibleCardFieldIds)]
      : fallback.visibleCardFieldIds,
    visibleFieldsByType,
    detailVisibleFieldsByType,
    detailFieldZoneByType
  };
}

function readStoredFieldMap(settings: unknown, key: 'visibleFieldsByType' | 'detailVisibleFieldsByType'): Record<string, string[]> {
  if (!isRecord(settings) || !isRecord(settings[key])) {
    return {};
  }

  return Object.entries(settings[key]).reduce<Record<string, string[]>>((acc, [typeSlug, fieldIds]) => {
    if (!Array.isArray(fieldIds)) {
      return acc;
    }

    acc[typeSlug] = fieldIds.filter((fieldId): fieldId is string => typeof fieldId === 'string' && fieldId.trim().length > 0);
    return acc;
  }, {});
}

function readStoredDetailZoneMap(settings: unknown): Record<string, Record<string, 'main' | 'side'>> {
  if (!isRecord(settings) || !isRecord(settings.detailFieldZoneByType)) {
    return {};
  }

  return Object.entries(settings.detailFieldZoneByType).reduce<Record<string, Record<string, 'main' | 'side'>>>(
    (acc, [typeSlug, zoneMap]) => {
      if (!isRecord(zoneMap)) {
        return acc;
      }

      acc[typeSlug] = Object.entries(zoneMap).reduce<Record<string, 'main' | 'side'>>((memo, [fieldSlug, zone]) => {
        if (zone === 'main') {
          memo[fieldSlug] = 'main';
          return memo;
        }

        memo[fieldSlug] = 'side';
        return memo;
      }, {});

      return acc;
    },
    {}
  );
}

function resolveSystemFieldDetailSection(fieldSlug: string): 'main' | 'side' {
  const systemField = SYSTEM_FIELD_SEEDS.find((field) => field.slug === fieldSlug);
  if (!systemField?.settings || typeof systemField.settings.detailSection !== 'string') {
    return 'side';
  }

  return systemField.settings.detailSection === 'main' ? 'main' : 'side';
}

async function seedFieldBindingsFromPreferences(input: {
  prisma: PrismaExecutor;
  workspaceId: string;
  typeSlugs: string[];
  typeIdBySlug: Map<string, string>;
  fieldIdBySlug: Map<string, string>;
  preferences: { visibleCardFieldIds: unknown; settings: unknown };
}) {
  const existingBindings = await input.prisma.workItemFieldBinding.findMany({
    where: { workspaceId: input.workspaceId },
    include: {
      field: {
        select: { slug: true }
      },
      type: {
        select: { slug: true }
      }
    }
  });

  const existingKeySet = new Set(
    existingBindings.map((binding) => `${binding.type.slug}:${binding.displayContext}:${binding.field.slug}`)
  );

  const settings = input.preferences.settings;
  const fallbackCardFieldIds = Array.isArray(input.preferences.visibleCardFieldIds)
    ? input.preferences.visibleCardFieldIds.filter((fieldId): fieldId is string => typeof fieldId === 'string')
    : defaultSystemCardFieldIds;
  const storedCardMap = readStoredFieldMap(settings, 'visibleFieldsByType');
  const storedDetailMap = readStoredFieldMap(settings, 'detailVisibleFieldsByType');
  const storedDetailZones = readStoredDetailZoneMap(settings);

  for (const typeSlug of input.typeSlugs) {
    const typeId = input.typeIdBySlug.get(typeSlug);
    if (!typeId) {
      continue;
    }

    const cardFieldSlugs = storedCardMap[typeSlug] ?? fallbackCardFieldIds;
    for (const [index, fieldSlug] of cardFieldSlugs.entries()) {
      const fieldId = input.fieldIdBySlug.get(fieldSlug);
      if (!fieldId) {
        continue;
      }

      const bindingKey = `${typeSlug}:card:${fieldSlug}`;
      if (existingKeySet.has(bindingKey)) {
        continue;
      }

      await input.prisma.workItemFieldBinding.create({
        data: {
          workspaceId: input.workspaceId,
          typeId,
          fieldId,
          displayContext: 'card',
          position: index,
          isVisible: true
        }
      });
      existingKeySet.add(bindingKey);
    }

    const detailFieldSlugs = storedDetailMap[typeSlug] ?? defaultSystemDetailFieldIds;
    for (const [index, fieldSlug] of detailFieldSlugs.entries()) {
      const fieldId = input.fieldIdBySlug.get(fieldSlug);
      if (!fieldId) {
        continue;
      }

      const bindingKey = `${typeSlug}:detail:${fieldSlug}`;
      if (existingKeySet.has(bindingKey)) {
        continue;
      }

      const section = storedDetailZones[typeSlug]?.[fieldSlug] ?? resolveSystemFieldDetailSection(fieldSlug);
      await input.prisma.workItemFieldBinding.create({
        data: {
          workspaceId: input.workspaceId,
          typeId,
          fieldId,
          displayContext: 'detail',
          position: index,
          section,
          isVisible: true
        }
      });
      existingKeySet.add(bindingKey);
    }
  }
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

function getTemplateAutomations(templateKey: WorkspaceTemplateKey | undefined): TemplateAutomationSeed[] {
  const selectedTemplate = getWorkspaceTemplateByKey(templateKey);
  const schema = selectedTemplate?.schema;

  if (!isRecord(schema) || !Array.isArray(schema.automations)) {
    return [];
  }

  return schema.automations.reduce<TemplateAutomationSeed[]>((acc, rawAutomation) => {
    if (!isRecord(rawAutomation) || typeof rawAutomation.id !== 'string' || rawAutomation.id.trim().length === 0) {
      return acc;
    }

    const actions = Array.isArray(rawAutomation.actions)
      ? rawAutomation.actions.filter((action): action is Record<string, unknown> => isRecord(action))
      : undefined;

    acc.push({
      id: rawAutomation.id.trim(),
      name: typeof rawAutomation.name === 'string' ? rawAutomation.name : undefined,
      description: typeof rawAutomation.description === 'string' ? rawAutomation.description : undefined,
      enabled: typeof rawAutomation.enabled === 'boolean' ? rawAutomation.enabled : false,
      trigger: isRecord(rawAutomation.trigger) ? rawAutomation.trigger : undefined,
      action: isRecord(rawAutomation.action) ? rawAutomation.action : undefined,
      actions,
      validations: Array.isArray(rawAutomation.validations)
        ? rawAutomation.validations.filter((validation): validation is string => typeof validation === 'string')
        : undefined
    });
    return acc;
  }, []);
}

function readAutomationString(source: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getAutomationName(automationId: string): string {
  switch (automationId) {
    case 'move_to_opportunity_on_qualification':
      return 'Mover para Oportunidade aberta apos qualificacao';
    case 'generate_proposal_on_proposal_preparing':
      return 'Gerar proposta ao mover para Proposta em preparacao';
    case 'mark_proposal_sent':
      return 'Marcar proposta como enviada';
    case 'generate_contract_on_proposal_approved':
      return 'Gerar contrato apos aprovacao da proposta';
    case 'mark_contract_sent':
      return 'Marcar contrato como enviado';
    case 'prepare_billing_on_contract_accepted':
      return 'Preparar cobranca apos aceite do contrato';
    case 'move_to_paid_active_on_payment_confirmed':
      return 'Mover para Pago / Ativo apos pagamento confirmado';
    default:
      return automationId.replace(/[_-]+/g, ' ');
  }
}

function normalizeTemplateAutomationActions(automation: TemplateAutomationSeed): Array<Record<string, unknown>> {
  const rawActions = automation.actions ?? (automation.action ? [automation.action] : []);

  return rawActions
    .filter((action) => typeof action.type === 'string')
    .map((action) => {
      const actionType = String(action.type);
      const nextAction: Record<string, unknown> = { ...action };
      if (
        automation.validations &&
        automation.validations.length > 0 &&
        (actionType === 'create_document' || actionType === 'update_document_status' || actionType === 'create_billing_order') &&
        !Array.isArray(nextAction.validations)
      ) {
        nextAction.validations = automation.validations;
      }
      return nextAction;
    });
}

function buildSeededAutomationRuleSpec(
  automation: TemplateAutomationSeed,
  index: number
): SeededAutomationRuleSpec | null {
  const trigger = automation.trigger;
  if (!trigger) {
    return null;
  }

  const rawTriggerType = readAutomationString(trigger, ['type']);
  const triggerSettings = {
    templateAutomationId: automation.id,
    templateAutomationVersion: TEMPLATE_AUTOMATION_SCHEMA_VERSION,
    templateTrigger: trigger
  };
  let normalizedTriggerType: string | null = null;
  let conditions: Record<string, unknown> | undefined;

  if (rawTriggerType === 'work_item_moved_to_column' || rawTriggerType === 'work_item_moved') {
    const column = readAutomationString(trigger, ['column', 'toColumn', 'toState']);
    normalizedTriggerType = 'item.moved';
    conditions = {
      itemTypeSlugs: ['commercial'],
      ...(column ? { toColumnKeys: [column], statuses: [column] } : {})
    };
  } else if (rawTriggerType === 'proposal_status_changed') {
    const status = readAutomationString(trigger, ['status']);
    normalizedTriggerType = status === 'sent' ? 'proposal.sent' : status === 'approved' ? 'proposal.approved' : null;
  } else if (rawTriggerType === 'contract_status_changed') {
    const status = readAutomationString(trigger, ['status']);
    normalizedTriggerType = status === 'accepted' || status === 'signed' ? 'contract.accepted' : null;
  } else if (rawTriggerType === 'billing_payment_confirmed') {
    normalizedTriggerType = 'billing.payment.confirmed';
  }

  const actions = normalizeTemplateAutomationActions(automation);
  if (!normalizedTriggerType || actions.length === 0) {
    return null;
  }

  return {
    automationId: automation.id,
    name: automation.name ?? getAutomationName(automation.id),
    description: automation.description,
    enabled: Boolean(automation.enabled),
    trigger: {
      type: normalizedTriggerType,
      settings: triggerSettings
    },
    conditions,
    actions,
    priority: 500 + index
  };
}

function extractTemplateAutomationId(trigger: Prisma.JsonValue): string | null {
  if (!isRecord(trigger) || !isRecord(trigger.settings)) {
    return null;
  }

  const automationId = trigger.settings.templateAutomationId;
  return typeof automationId === 'string' && automationId.length > 0 ? automationId : null;
}

function extractTemplateAutomationVersion(trigger: Prisma.JsonValue): number {
  if (!isRecord(trigger) || !isRecord(trigger.settings)) {
    return 0;
  }

  const version = trigger.settings.templateAutomationVersion;
  return typeof version === 'number' && Number.isFinite(version) ? version : 0;
}

async function seedTemplateAutomationRules(input: {
  prisma: PrismaExecutor;
  workspaceId: string;
  templateKey: WorkspaceTemplateKey;
}): Promise<void> {
  const automations = getTemplateAutomations(input.templateKey);
  if (automations.length === 0) {
    return;
  }

  const ruleSpecs = automations
    .map((automation, index) => buildSeededAutomationRuleSpec(automation, index))
    .filter((spec): spec is SeededAutomationRuleSpec => spec !== null);

  if (ruleSpecs.length === 0) {
    return;
  }

  const existingRules = await input.prisma.automationRule.findMany({
    where: { workspaceId: input.workspaceId },
    select: {
      id: true,
      name: true,
      trigger: true
    }
  });

  for (const spec of ruleSpecs) {
    const existing = existingRules.find((rule) => extractTemplateAutomationId(rule.trigger) === spec.automationId);
    const data = {
      name: spec.name,
      description: spec.description,
      triggerType: String(spec.trigger.type),
      trigger: toPrismaJson(spec.trigger),
      conditions: spec.conditions ? toPrismaJson(spec.conditions) : Prisma.JsonNull,
      actions: toPrismaJson(spec.actions),
      priority: spec.priority,
      version: 1
    };

    if (existing) {
      if (extractTemplateAutomationVersion(existing.trigger) >= TEMPLATE_AUTOMATION_SCHEMA_VERSION) {
        continue;
      }

      await input.prisma.automationRule.update({
        where: { id: existing.id },
        data
      });
      continue;
    }

    await input.prisma.automationRule.create({
      data: {
        workspaceId: input.workspaceId,
        ...data,
        enabled: spec.enabled
      }
    });
  }
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
  const seededTemplateCustomFields = resolveTemplateFieldDefinitions(templateKey, preset.customFields);
  const seededTemplateFieldLayouts = buildFieldLayoutMapsFromTemplateBindings({
    templateKey,
    itemTypes: preset.itemTypes,
    fallbackVisibleCardFieldIds: preset.defaultVisibleCardFields,
    fallbackDetailVisibleFieldIds: preset.defaultVisibleDetailFields
  });
  const defaultBoardMode = seededBoardViews[0]?.key ?? preset.defaultBoardMode;

  const preferences = await prisma.workspacePreferences.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultBoardMode,
      dateFormat: 'dd/mm/yyyy',
      visibleCardFieldIds: toPrismaJson(seededTemplateFieldLayouts.visibleCardFieldIds),
      settings: toPrismaJson({
        templateKey: preset.templateKey,
        cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION,
        visibleFieldsByType: seededTemplateFieldLayouts.visibleFieldsByType,
        detailVisibleFieldsByType: seededTemplateFieldLayouts.detailVisibleFieldsByType,
        detailFieldZoneByType: seededTemplateFieldLayouts.detailFieldZoneByType,
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
          createTaskColumnIds: (view.createTaskColumnSlugs ?? [])
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

  const fieldIdBySlug = new Map<string, string>();

  for (const [index, systemFieldSeed] of SYSTEM_FIELD_SEEDS.entries()) {
    const systemField = await prisma.customFieldDefinition.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: systemFieldSeed.slug
        }
      },
      create: {
        workspaceId,
        name: systemFieldSeed.name,
        slug: systemFieldSeed.slug,
        description: systemFieldSeed.description,
        type: mapInputTypeToPrisma(systemFieldSeed.type),
        isSystem: true,
        required: Boolean(systemFieldSeed.required),
        isEditable: systemFieldSeed.isEditable ?? true,
        isRemovable: systemFieldSeed.isRemovable ?? true,
        position: index,
        settings: toPrismaJson(systemFieldSeed.settings ?? { source: 'system' })
      },
      update: {
        position: index,
        isSystem: true,
        required: Boolean(systemFieldSeed.required),
        isEditable: systemFieldSeed.isEditable ?? true,
        isRemovable: systemFieldSeed.isRemovable ?? true,
        isActive: true,
        settings: toPrismaJson(systemFieldSeed.settings ?? { source: 'system' })
      }
    });

    fieldIdBySlug.set(systemFieldSeed.slug, systemField.id);
  }

  for (const [index, customFieldSeed] of seededTemplateCustomFields.entries()) {
    const templateFieldSettings = {
      ...(customFieldSeed.settings ?? {}),
      source: 'seed.default',
      templateKey: preset.templateKey
    };

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
        variableKey: customFieldSeed.variableKey,
        variableLabel: customFieldSeed.variableLabel,
        variableDescription: customFieldSeed.variableDescription,
        type: customFieldSeed.type,
        isSystem: false,
        required: Boolean(customFieldSeed.required),
        isEditable: true,
        isRemovable: true,
        position: SYSTEM_FIELD_SEEDS.length + index,
        settings: toPrismaJson(templateFieldSettings)
      },
      update: {
        position: SYSTEM_FIELD_SEEDS.length + index,
        isSystem: false,
        isActive: true,
        variableKey: customFieldSeed.variableKey,
        variableLabel: customFieldSeed.variableLabel,
        variableDescription: customFieldSeed.variableDescription,
        settings: toPrismaJson(templateFieldSettings)
      }
    });

    fieldIdBySlug.set(customFieldSeed.slug, customField.id);

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

  await seedFieldBindingsFromPreferences({
    prisma,
    workspaceId,
    typeSlugs: preset.itemTypes.map((itemType) => itemType.slug),
    typeIdBySlug: typeBySlug,
    fieldIdBySlug,
    preferences: {
      visibleCardFieldIds: preferences.visibleCardFieldIds,
      settings: preferences.settings
    }
  });

  await seedTemplateAutomationRules({
    prisma,
    workspaceId,
    templateKey: preset.templateKey
  });

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
