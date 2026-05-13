import type { CustomFieldInputType } from '@/modules/workspace-platform/application/shared';

export type WorkspaceTemplateKey = 'software_delivery' | 'product_discovery' | 'operations_kanban' | 'commercial_crm';

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
  variableKey?: string;
  variableLabel?: string;
  variableDescription?: string;
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
  analyticsRole?: 'prospecting' | 'funnel' | 'terminal' | 'client';
  statuses: Array<{ id: string; label: string; dot: string }>;
  statusSource: { kind: 'workflow_state' } | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  compactCards?: boolean;
  visibleBoardColumnSlugs?: string[];
  createTaskColumnSlugs?: string[];
  allowedTaskTypes?: string[];
};

export type WorkspaceTemplateSchema = {
  lanes: string[];
  issueTypes: string[];
  perspectives: WorkspaceTemplatePerspective[];
  fieldDefinitions?: WorkspaceTemplateFieldDefinition[];
  fieldBindings?: WorkspaceTemplateFieldBinding[];
  automations?: Array<Record<string, unknown>>;
  automationNativeWorkflowKeys?: string[];
  automationRecipeIds?: string[];
  documentBindings?: Array<Record<string, unknown>>;
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
  baseCardFieldIds?: string[];
  baseDetailFieldIds?: string[];
  extraCardFieldIds?: string[];
  extraDetailFieldIds?: string[];
  detailSectionByFieldId?: Record<string, 'main' | 'side'>;
}): WorkspaceTemplateFieldBinding[] {
  const cardFieldIds = uniqueFieldIds([...(input.baseCardFieldIds ?? defaultSystemCardFieldIds), ...(input.extraCardFieldIds ?? [])]);
  const detailFieldIds = uniqueFieldIds([...(input.baseDetailFieldIds ?? defaultSystemDetailFieldIds), ...(input.extraDetailFieldIds ?? [])]);

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

const prospectIssueTypes = ['prospect'];
const commercialIssueTypes = ['prospect', 'commercial'];
const commercialFunnelIssueTypes = ['commercial'];

const commercialStatuses = [
  { id: 'prospect', label: 'Prospect', dot: '#2563eb' },
  { id: 'contact_started', label: 'Contato iniciado', dot: '#0891b2' },
  { id: 'follow_up', label: 'Follow-up', dot: '#f59e0b' },
  { id: 'commercial_intake', label: 'Entrada comercial', dot: '#0d8df7' },
  { id: 'commercial_qualification', label: 'Qualificacao', dot: '#4f46e5' },
  { id: 'opportunity_open', label: 'Oportunidade aberta', dot: '#0891b2' },
  { id: 'proposal_preparing', label: 'Proposta em preparacao', dot: '#f59e0b' },
  { id: 'proposal_sent', label: 'Proposta enviada', dot: '#d97706' },
  { id: 'proposal_approved', label: 'Proposta aprovada', dot: '#16a34a' },
  { id: 'contract_preparing', label: 'Contrato em preparacao', dot: '#7c3aed' },
  { id: 'contract_sent', label: 'Contrato enviado', dot: '#6d28d9' },
  { id: 'contract_accepted', label: 'Contrato aceito / assinado', dot: '#22c55e' },
  { id: 'billing_created', label: 'Cobranca gerada', dot: '#0369a1' },
  { id: 'payment_waiting', label: 'Aguardando pagamento', dot: '#0f766e' },
  { id: 'payment_overdue', label: 'Pagamento em atraso', dot: '#dc2626' },
  { id: 'paid_active', label: 'Pago / Ativo', dot: '#15803d' },
  { id: 'lost', label: 'Perdido', dot: '#dc2626' },
  { id: 'closed', label: 'Encerrado', dot: '#64748b' }
];

const commercialFieldDefinitions: WorkspaceTemplateFieldDefinition[] = [
  {
    id: 'customerId',
    label: 'Cliente vinculado',
    slug: 'customerId',
    description: 'Selecione um cliente existente para preencher os dados automaticamente.',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'customer_selector',
      entityType: 'customer'
    }
  },
  {
    id: 'contactId',
    label: 'Contato vinculado',
    slug: 'contactId',
    description: 'Contato mestre vinculado, quando existir.',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'entity_reference',
      entityType: 'contact',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  },
  {
    id: 'contactName',
    label: 'Nome do contato',
    slug: 'contactName',
    variableKey: 'contactName',
    variableLabel: 'Nome do contato',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contactEmail',
    label: 'Email do contato',
    slug: 'contactEmail',
    variableKey: 'contactEmail',
    variableLabel: 'Email do contato',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'email'
    }
  },
  {
    id: 'contactPhone',
    label: 'Telefone do contato',
    slug: 'contactPhone',
    variableKey: 'contactPhone',
    variableLabel: 'Telefone do contato',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'phone'
    }
  },
  {
    id: 'companyName',
    label: 'Empresa',
    slug: 'companyName',
    variableKey: 'companyName',
    variableLabel: 'Empresa',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'clientName',
    label: 'Nome do cliente',
    slug: 'clientName',
    variableKey: 'clientName',
    variableLabel: 'Nome do cliente',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'clientLogoUrl',
    label: 'Logo do cliente',
    slug: 'clientLogoUrl',
    variableKey: 'clientLogoUrl',
    variableLabel: 'Logo do cliente',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'url'
    }
  },
  {
    id: 'source',
    label: 'Origem',
    slug: 'source',
    variableKey: 'commercialSource',
    variableLabel: 'Origem comercial',
    type: 'select',
    scopeTypeIds: commercialIssueTypes,
    options: [
      { label: 'Indicacao', value: 'referral', color: '#0d9488' },
      { label: 'Site', value: 'website', color: '#2563eb' },
      { label: 'WhatsApp', value: 'whatsapp', color: '#16a34a' },
      { label: 'Instagram', value: 'instagram', color: '#db2777' },
      { label: 'Outbound', value: 'outbound', color: '#7c3aed' },
      { label: 'Evento', value: 'event', color: '#f59e0b' },
      { label: 'Parceiro', value: 'partner', color: '#0891b2' },
      { label: 'Outro', value: 'other', color: '#64748b' }
    ]
  },
  {
    id: 'interest',
    label: 'Interesse / escopo',
    slug: 'interest',
    variableKey: 'implementationScope',
    variableLabel: 'Escopo de implementacao',
    variableDescription: 'Nome do item selecionado no catalogo de cobranca; usado em propostas e contratos.',
    type: 'catalog_select',
    scopeTypeIds: commercialIssueTypes,
    config: {
      entityType: 'billing_catalog_item'
    }
  },
  {
    id: 'estimatedValue',
    label: 'Valor estimado',
    slug: 'estimatedValue',
    variableKey: 'dealValue',
    variableLabel: 'Valor da proposta',
    type: 'number',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'currency',
      currency: 'BRL',
      min: 0,
      step: 100
    }
  },
  {
    id: 'probability',
    label: 'Probabilidade',
    slug: 'probability',
    type: 'number',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'percentage',
      min: 0,
      max: 100,
      step: 5
    }
  },
  {
    id: 'expectedCloseDate',
    label: 'Previsao de fechamento',
    slug: 'expectedCloseDate',
    variableKey: 'expectedCloseDate',
    variableLabel: 'Previsao de fechamento',
    type: 'date',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'proposalValidity',
    label: 'Validade da proposta',
    slug: 'proposalValidity',
    variableKey: 'proposalValidity',
    variableLabel: 'Validade da proposta',
    type: 'date',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'paymentTerms',
    label: 'Condicoes comerciais',
    slug: 'paymentTerms',
    variableKey: 'paymentTerms',
    variableLabel: 'Condicoes comerciais',
    type: 'long_text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'outOfScope',
    label: 'Fora do escopo',
    slug: 'outOfScope',
    variableKey: 'outOfScope',
    variableLabel: 'Itens fora do escopo',
    type: 'long_text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'clientLegalName',
    label: 'Razao social / nome legal',
    slug: 'clientLegalName',
    variableKey: 'clientLegalName',
    variableLabel: 'Razao social do cliente',
    variableDescription: 'Nome legal completo para contratos.',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'clientDocument',
    label: 'CPF / CNPJ',
    slug: 'clientDocument',
    variableKey: 'clientDocument',
    variableLabel: 'Documento do cliente (CPF ou CNPJ)',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'document'
    }
  },
  {
    id: 'clientAddress',
    label: 'Endereco completo',
    slug: 'clientAddress',
    variableKey: 'clientAddress',
    variableLabel: 'Endereco completo do cliente',
    variableDescription: 'Logradouro, numero, complemento, cidade, estado, CEP.',
    type: 'long_text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contractStartDate',
    label: 'Inicio do contrato',
    slug: 'contractStartDate',
    variableKey: 'contractStartDate',
    variableLabel: 'Data de inicio do contrato',
    type: 'date',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contractDuration',
    label: 'Vigencia do contrato',
    slug: 'contractDuration',
    variableKey: 'contractDuration',
    variableLabel: 'Vigencia em meses',
    type: 'select',
    scopeTypeIds: commercialIssueTypes,
    options: [
      { label: '1 mes', value: '1', color: '#64748b' },
      { label: '3 meses', value: '3', color: '#64748b' },
      { label: '6 meses', value: '6', color: '#0891b2' },
      { label: '12 meses', value: '12', color: '#0d8df7' },
      { label: '24 meses', value: '24', color: '#4f46e5' },
      { label: 'Indeterminado', value: 'indeterminate', color: '#64748b' }
    ]
  },
  {
    id: 'proposalId',
    label: 'Proposta',
    slug: 'proposalId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'entity_reference',
      entityType: 'proposal',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  },
  {
    id: 'contractId',
    label: 'Contrato',
    slug: 'contractId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'entity_reference',
      entityType: 'contract',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  },
  {
    id: 'billingOrderId',
    label: 'Ordem de cobranca',
    slug: 'billingOrderId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'entity_reference',
      entityType: 'billing_order',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  },
  {
    id: 'billingStatus',
    label: 'Status da cobranca',
    slug: 'billingStatus',
    type: 'select',
    scopeTypeIds: commercialIssueTypes,
    options: [
      { label: 'Gerada / pendente', value: 'pending', color: '#0369a1' },
      { label: 'Paga', value: 'paid', color: '#15803d' },
      { label: 'Em atraso', value: 'overdue', color: '#d97706' },
      { label: 'Falhou', value: 'failed', color: '#dc2626' },
      { label: 'Cancelada', value: 'canceled', color: '#64748b' },
      { label: 'Estornada', value: 'refunded', color: '#7c3aed' },
      { label: 'Assinatura ativa', value: 'subscription_active', color: '#15803d' },
      { label: 'Assinatura cancelada', value: 'subscription_canceled', color: '#64748b' }
    ],
    config: {
      semantic: 'billing_status',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  },
  {
    id: 'billingCheckoutUrl',
    label: 'Link da cobranca',
    slug: 'billingCheckoutUrl',
    type: 'text',
    scopeTypeIds: commercialIssueTypes,
    config: {
      semantic: 'url',
      formVisible: false,
      readOnlyAfterCreate: true
    }
  }
];

const prospectFieldBindings = buildTemplateFieldBindings({
  typeIds: prospectIssueTypes,
  baseCardFieldIds: ['sys:status', 'sys:title', 'sys:description', 'sys:assignee'],
  baseDetailFieldIds: ['sys:status', 'sys:title', 'sys:description', 'sys:assignee'],
  extraCardFieldIds: ['companyName', 'contactName', 'source'],
  extraDetailFieldIds: ['contactName', 'contactEmail', 'contactPhone', 'companyName', 'source', 'expectedCloseDate'],
  detailSectionByFieldId: {
    contactName: 'main',
    contactEmail: 'main',
    contactPhone: 'main',
    companyName: 'main',
    source: 'main',
    expectedCloseDate: 'side',
    'sys:status': 'side',
    'sys:assignee': 'side'
  }
});

const commercialFunnelFieldBindings = buildTemplateFieldBindings({
  typeIds: commercialFunnelIssueTypes,
  baseCardFieldIds: ['sys:status', 'sys:title', 'sys:description', 'sys:assignee'],
  baseDetailFieldIds: ['sys:status', 'sys:title', 'sys:description', 'sys:assignee'],
  extraCardFieldIds: ['clientName', 'companyName', 'contactName', 'estimatedValue', 'source', 'billingStatus'],
  extraDetailFieldIds: [
    'customerId',
    'contactName',
    'contactEmail',
    'contactPhone',
    'companyName',
    'clientName',
    'clientLogoUrl',
    'clientLegalName',
    'clientDocument',
    'clientAddress',
    'source',
    'interest',
    'estimatedValue',
    'probability',
    'expectedCloseDate',
    'proposalValidity',
    'contractStartDate',
    'contractDuration',
    'billingOrderId',
    'billingStatus',
    'billingCheckoutUrl',
    'paymentTerms',
    'outOfScope'
  ],
  detailSectionByFieldId: {
    customerId: 'side',
    contactName: 'main',
    contactEmail: 'main',
    contactPhone: 'main',
    companyName: 'main',
    clientName: 'main',
    clientLogoUrl: 'main',
    clientLegalName: 'main',
    clientDocument: 'main',
    clientAddress: 'main',
    source: 'main',
    interest: 'main',
    paymentTerms: 'main',
    outOfScope: 'main',
    estimatedValue: 'side',
    probability: 'side',
    expectedCloseDate: 'side',
    proposalValidity: 'side',
    contractStartDate: 'side',
    contractDuration: 'side',
    billingOrderId: 'side',
    billingStatus: 'side',
    billingCheckoutUrl: 'side',
    'sys:status': 'side',
    'sys:assignee': 'side'
  }
});

const commercialFieldBindings = [...prospectFieldBindings, ...commercialFunnelFieldBindings];

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
  },
  {
    key: 'commercial_crm',
    name: 'Comercial / CRM Operacional',
    description: 'Entrada comercial, proposta, contrato, cobranca e ativacao com WorkItems como registro operacional.',
    boardName: 'Comercial',
    boardDescription: 'Fluxo comercial configuravel integrado ao board, documentos e futuras automacoes financeiras.',
    schema: {
      lanes: commercialStatuses.map((status) => status.id),
      issueTypes: commercialIssueTypes,
      perspectives: [
        {
          key: 'prospeccao',
          name: 'Prospecao',
          caption: 'Contatos antes da entrada comercial',
          analyticsRole: 'prospecting',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['prospect', 'contact_started', 'follow_up', 'commercial_intake'],
          createTaskColumnSlugs: ['prospect'],
          allowedTaskTypes: prospectIssueTypes
        },
        {
          key: 'entrada',
          name: 'Entrada',
          caption: 'Captura e qualificacao comercial',
          analyticsRole: 'funnel',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['commercial_intake', 'commercial_qualification'],
          createTaskColumnSlugs: ['commercial_intake'],
          allowedTaskTypes: commercialFunnelIssueTypes
        },
        {
          key: 'venda',
          name: 'Venda',
          caption: 'Oportunidade e proposta comercial',
          analyticsRole: 'funnel',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['opportunity_open', 'proposal_preparing', 'proposal_sent', 'proposal_approved'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialFunnelIssueTypes
        },
        {
          key: 'formalizacao',
          name: 'Formalizacao',
          caption: 'Contrato e aceite',
          analyticsRole: 'funnel',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['contract_preparing', 'contract_sent', 'contract_accepted'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialFunnelIssueTypes
        },
        {
          key: 'financeiro',
          name: 'Financeiro',
          caption: 'Cobranca e pagamento',
          analyticsRole: 'funnel',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['billing_created', 'payment_waiting', 'payment_overdue', 'paid_active'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialFunnelIssueTypes
        },
        {
          key: 'finalizacao',
          name: 'Finalizacao',
          caption: 'Perdas e encerramentos',
          analyticsRole: 'terminal',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['lost', 'closed'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialFunnelIssueTypes
        },
        {
          key: 'cliente',
          name: 'Cliente',
          caption: 'Visao do cliente',
          analyticsRole: 'client',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['contract_sent', 'contract_accepted', 'billing_created', 'payment_waiting', 'payment_overdue', 'paid_active'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialFunnelIssueTypes
        }
      ],
      fieldDefinitions: commercialFieldDefinitions,
      fieldBindings: commercialFieldBindings,
      automationNativeWorkflowKeys: [
        'commercial.intake',
        'commercial.hot_opportunity',
        'commercial.first_contact',
        'commercial.no_response_followup',
        'commercial.proposal_drafting',
        'commercial.proposal_approved_to_contract',
        'commercial.contract_accepted_to_billing',
        'commercial.payment_confirmed_to_active_customer',
        'commercial.overdue_charge'
      ],
      documentBindings: [
        { id: 'commercial_proposal', kind: 'proposal', linkedEntityType: 'work_item' },
        { id: 'commercial_contract', kind: 'contract', linkedEntityType: 'work_item' },
        { id: 'commercial_wiki', kind: 'wiki', linkedEntityType: 'work_item' }
      ]
    },
    rules: {
      defaultState: 'prospect',
      commercialEntryState: 'commercial_intake',
      doneState: 'paid_active',
      lostState: 'lost',
      documentBindings: {
        proposal: 'commercial_proposal',
        contract: 'commercial_contract'
      },
      billingExtension: {
        createBillingOrderAction: 'create_billing_order',
        billingOrderFieldId: 'billingOrderId'
      }
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
