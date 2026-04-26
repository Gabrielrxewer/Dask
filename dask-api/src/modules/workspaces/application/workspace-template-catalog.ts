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

const commercialIssueTypes = ['commercial'];

const commercialStatuses = [
  { id: 'lead_new', label: 'Novo lead', dot: '#0d8df7' },
  { id: 'lead_qualification', label: 'Qualificacao', dot: '#4f46e5' },
  { id: 'opportunity_open', label: 'Oportunidade aberta', dot: '#0891b2' },
  { id: 'proposal_preparing', label: 'Proposta em preparacao', dot: '#f59e0b' },
  { id: 'proposal_sent', label: 'Proposta enviada', dot: '#d97706' },
  { id: 'proposal_approved', label: 'Proposta aprovada', dot: '#16a34a' },
  { id: 'contract_preparing', label: 'Contrato em preparacao', dot: '#7c3aed' },
  { id: 'contract_sent', label: 'Contrato enviado', dot: '#6d28d9' },
  { id: 'contract_accepted', label: 'Contrato aceito / assinado', dot: '#22c55e' },
  { id: 'billing_created', label: 'Cobranca gerada', dot: '#0369a1' },
  { id: 'payment_waiting', label: 'Aguardando pagamento', dot: '#0f766e' },
  { id: 'paid_active', label: 'Pago / Ativo', dot: '#15803d' },
  { id: 'lost', label: 'Perdido', dot: '#dc2626' },
  { id: 'closed', label: 'Encerrado', dot: '#64748b' }
];

const commercialFieldDefinitions: WorkspaceTemplateFieldDefinition[] = [
  {
    id: 'customerId',
    label: 'Cliente vinculado',
    slug: 'customerId',
    description: 'Customer mestre vinculado ao work item comercial.',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contactId',
    label: 'Contato vinculado',
    slug: 'contactId',
    description: 'Contato mestre vinculado, quando existir.',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
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
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contactPhone',
    label: 'Telefone do contato',
    slug: 'contactPhone',
    variableKey: 'contactPhone',
    variableLabel: 'Telefone do contato',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
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
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'source',
    label: 'Origem',
    slug: 'source',
    variableKey: 'leadSource',
    variableLabel: 'Origem do lead',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'interest',
    label: 'Interesse / escopo',
    slug: 'interest',
    variableKey: 'implementationScope',
    variableLabel: 'Escopo de implementacao',
    type: 'long_text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'estimatedValue',
    label: 'Valor estimado',
    slug: 'estimatedValue',
    variableKey: 'dealValue',
    variableLabel: 'Valor da proposta',
    type: 'number',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'probability',
    label: 'Probabilidade',
    slug: 'probability',
    type: 'number',
    scopeTypeIds: commercialIssueTypes
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
    id: 'proposalId',
    label: 'Proposta',
    slug: 'proposalId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'contractId',
    label: 'Contrato',
    slug: 'contractId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  },
  {
    id: 'billingOrderId',
    label: 'Ordem de cobranca',
    slug: 'billingOrderId',
    type: 'text',
    scopeTypeIds: commercialIssueTypes
  }
];

const commercialFieldBindings = buildTemplateFieldBindings({
  typeIds: commercialIssueTypes,
  extraCardFieldIds: ['customerId', 'clientName', 'companyName', 'contactName', 'estimatedValue', 'proposalId', 'contractId'],
  extraDetailFieldIds: [
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
  detailSectionByFieldId: {
    interest: 'main',
    paymentTerms: 'main'
  }
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
          key: 'entrada',
          name: 'Entrada',
          caption: 'Captura e qualificacao comercial',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['lead_new', 'lead_qualification'],
          createTaskColumnSlugs: ['lead_new'],
          allowedTaskTypes: commercialIssueTypes
        },
        {
          key: 'venda',
          name: 'Venda',
          caption: 'Oportunidade e proposta comercial',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['opportunity_open', 'proposal_preparing', 'proposal_sent', 'proposal_approved'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialIssueTypes
        },
        {
          key: 'formalizacao',
          name: 'Formalizacao',
          caption: 'Contrato e aceite',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['contract_preparing', 'contract_sent', 'contract_accepted'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialIssueTypes
        },
        {
          key: 'financeiro',
          name: 'Financeiro',
          caption: 'Cobranca e pagamento',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['billing_created', 'payment_waiting', 'paid_active'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialIssueTypes
        },
        {
          key: 'finalizacao',
          name: 'Finalizacao',
          caption: 'Perdas e encerramentos',
          statuses: commercialStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['lost', 'closed'],
          createTaskColumnSlugs: [],
          allowedTaskTypes: commercialIssueTypes
        }
      ],
      fieldDefinitions: commercialFieldDefinitions,
      fieldBindings: commercialFieldBindings,
      automations: [
        {
          id: 'move_to_opportunity_on_qualification',
          name: 'Mover para Oportunidade aberta apos qualificacao',
          description: 'Quando o WorkItem comercial entra em Qualificacao, avanca automaticamente para Oportunidade aberta na perspectiva Venda.',
          enabled: true,
          trigger: { type: 'work_item_moved_to_column', column: 'lead_qualification' },
          actions: [
            { type: 'set_work_item_state', stateSlug: 'opportunity_open' }
          ]
        },
        {
          id: 'generate_proposal_on_proposal_preparing',
          name: 'Gerar proposta ao mover para Proposta em preparacao',
          description: 'Quando um WorkItem comercial entra na coluna Proposta em preparacao, cria a proposta vinculada ao WorkItem.',
          enabled: true,
          trigger: { type: 'work_item_moved_to_column', column: 'proposal_preparing' },
          actions: [
            {
              type: 'create_document',
              kind: 'proposal',
              binding: 'commercial_proposal',
              status: 'draft',
              targetFieldSlug: 'proposalId'
            }
          ]
        },
        {
          id: 'mark_proposal_sent',
          name: 'Marcar proposta como enviada',
          description: 'Quando o WorkItem comercial entra em Proposta enviada, atualiza o status da proposta vinculada.',
          enabled: true,
          trigger: { type: 'work_item_moved_to_column', column: 'proposal_sent' },
          actions: [{ type: 'update_document_status', kind: 'proposal', status: 'sent' }]
        },
        {
          id: 'generate_contract_on_proposal_approved',
          name: 'Gerar contrato apos aprovacao da proposta',
          description: 'Quando a proposta vinculada for aprovada, move o WorkItem para Contrato em preparacao e cria o contrato.',
          enabled: true,
          trigger: { type: 'proposal_status_changed', status: 'approved' },
          actions: [
            { type: 'set_work_item_state', stateSlug: 'contract_preparing' },
            {
              type: 'create_document',
              kind: 'contract',
              binding: 'commercial_contract',
              status: 'draft',
              targetFieldSlug: 'contractId'
            }
          ],
          validations: ['commercial.contract.required_fields']
        },
        {
          id: 'mark_contract_sent',
          name: 'Marcar contrato como enviado',
          description: 'Quando o WorkItem comercial entra em Contrato enviado, atualiza o status do contrato vinculado.',
          enabled: true,
          trigger: { type: 'work_item_moved_to_column', column: 'contract_sent' },
          actions: [{ type: 'update_document_status', kind: 'contract', status: 'sent' }]
        },
        {
          id: 'prepare_billing_on_contract_accepted',
          name: 'Preparar cobranca apos aceite do contrato',
          description: 'Quando o contrato for aceito, move o WorkItem para Cobranca gerada e prepara a ordem de cobranca.',
          enabled: false,
          trigger: { type: 'contract_status_changed', status: 'accepted' },
          actions: [
            { type: 'set_work_item_state', stateSlug: 'billing_created' },
            { type: 'create_billing_order', targetFieldSlug: 'billingOrderId' }
          ],
          validations: ['commercial.billing.required_fields']
        },
        {
          id: 'move_to_paid_active_on_payment_confirmed',
          name: 'Mover para Pago / Ativo apos pagamento confirmado',
          description: 'Ponto de extensao para confirmacao de pagamento mover o WorkItem comercial para Pago / Ativo.',
          enabled: false,
          trigger: { type: 'billing_payment_confirmed', status: 'paid' },
          actions: [{ type: 'set_work_item_state', stateSlug: 'paid_active' }]
        }
      ],
      documentBindings: [
        { id: 'commercial_proposal', kind: 'proposal', linkedEntityType: 'work_item' },
        { id: 'commercial_contract', kind: 'contract', linkedEntityType: 'work_item' },
        { id: 'commercial_wiki', kind: 'wiki', linkedEntityType: 'work_item' }
      ]
    },
    rules: {
      defaultState: 'lead_new',
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
