import {
  automationNodeConfigSchemas,
  type AutomationNodeConfigSchema,
  type AutomationNodeGroup
} from '@/modules/automation/application/automation-node-config-schemas';

export type AutomationNodeType =
  | 'trigger'
  | 'condition'
  | 'delay'
  | 'noop'
  | 'end'
  | 'communication_send'
  | 'human_approval'
  | 'move_work_item'
  | 'update_work_item_fields'
  | 'create_proposal'
  | 'create_contract'
  | 'send_document'
  | 'update_document_status'
  | 'ensure_customer_from_work_item'
  | 'create_billing_order'
  | 'create_followup_task'
  | 'register_card_activity'
  | 'ai_summarize_context'
  | 'ai_classify_reply'
  | 'ai_extract_intent'
  | 'ai_generate_message_draft'
  | 'ai_recommend_next_action'
  | 'ai_fill_template_variables';

export interface AutomationNodeCapability {
  type: AutomationNodeType;
  label: string;
  description: string;
  color: string;
  icon: string;
  group: AutomationNodeGroup;
  configSchema?: AutomationNodeConfigSchema;
  isTerminal?: boolean;
  isTrigger?: boolean;
}

export interface AutomationWorkflowGraphCapability {
  version: 1;
  nodes: Array<{
    id: string;
    type: AutomationNodeType;
    label: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  metadata: Record<string, unknown>;
}

export interface AutomationCapabilities {
  schemaVersion: 1;
  nodeCatalog: AutomationNodeCapability[];
  recipeCatalog: AutomationRecipeCapability[];
  defaultGraph: AutomationWorkflowGraphCapability;
}

export interface AutomationRecipeCapability {
  id: string;
  name: string;
  description: string;
  category: 'lead' | 'proposal' | 'contract' | 'billing' | 'customer' | 'followup';
  graph: AutomationWorkflowGraphCapability;
}

function schemaFor(type: AutomationNodeType): AutomationNodeConfigSchema | undefined {
  return automationNodeConfigSchemas[type];
}

export const automationNodeCatalog: AutomationNodeCapability[] = [
  { type: 'trigger', label: 'Gatilho', description: 'Entrada do workflow', color: '#2563eb', icon: 'zap', group: 'triggers', configSchema: schemaFor('trigger'), isTrigger: true },
  { type: 'condition', label: 'Condicao', description: 'Roteamento por regra', color: '#ca8a04', icon: 'list-checks', group: 'conditions' },
  { type: 'delay', label: 'Delay', description: 'Espera duravel', color: '#7c3aed', icon: 'calendar-check', group: 'time', configSchema: schemaFor('delay') },
  { type: 'communication_send', label: 'Enviar mensagem', description: 'E-mail ou WhatsApp', color: '#059669', icon: 'send', group: 'communication', configSchema: schemaFor('communication_send') },
  { type: 'human_approval', label: 'Aprovacao humana', description: 'Aprovar antes do efeito', color: '#dc2626', icon: 'square-check', group: 'approval', configSchema: schemaFor('human_approval') },
  { type: 'move_work_item', label: 'Mover card', description: 'Move card para coluna ou estado', color: '#2563eb', icon: 'board', group: 'card', configSchema: schemaFor('move_work_item') },
  { type: 'update_work_item_fields', label: 'Atualizar card', description: 'Atualiza campos do card', color: '#0f766e', icon: 'pencil', group: 'card', configSchema: schemaFor('update_work_item_fields') },
  { type: 'create_proposal', label: 'Criar proposta', description: 'Cria proposta comercial vinculada', color: '#9333ea', icon: 'file', group: 'proposals', configSchema: schemaFor('create_proposal') },
  { type: 'create_contract', label: 'Criar contrato', description: 'Cria contrato comercial vinculado', color: '#7c3aed', icon: 'file', group: 'contracts', configSchema: schemaFor('create_contract') },
  { type: 'send_document', label: 'Enviar documento', description: 'Envia proposta ou contrato', color: '#0891b2', icon: 'send', group: 'documents', configSchema: schemaFor('send_document') },
  { type: 'update_document_status', label: 'Status documento', description: 'Atualiza proposta ou contrato', color: '#4f46e5', icon: 'file', group: 'documents', configSchema: schemaFor('update_document_status') },
  { type: 'ensure_customer_from_work_item', label: 'Criar cliente', description: 'Cria ou vincula cliente pelo card', color: '#16a34a', icon: 'users', group: 'customers', configSchema: schemaFor('ensure_customer_from_work_item') },
  { type: 'create_billing_order', label: 'Criar cobranca', description: 'Gera checkout/cobranca vinculada', color: '#0369a1', icon: 'credit-card', group: 'finance', configSchema: schemaFor('create_billing_order') },
  { type: 'create_followup_task', label: 'Criar follow-up', description: 'Cria tarefa vinculada ao card', color: '#f59e0b', icon: 'calendar-check', group: 'card', configSchema: schemaFor('create_followup_task') },
  { type: 'register_card_activity', label: 'Registrar historico', description: 'Anota evento no historico do card', color: '#64748b', icon: 'list', group: 'history', configSchema: schemaFor('register_card_activity') },
  { type: 'ai_summarize_context', label: 'IA: resumir', description: 'Resume contexto comercial', color: '#4f46e5', icon: 'bot', group: 'ai' },
  { type: 'ai_classify_reply', label: 'IA: classificar', description: 'Classifica resposta', color: '#4f46e5', icon: 'bot', group: 'ai' },
  { type: 'ai_extract_intent', label: 'IA: intencao', description: 'Extrai intencao', color: '#4f46e5', icon: 'bot', group: 'ai' },
  { type: 'ai_generate_message_draft', label: 'IA: rascunho', description: 'Gera rascunho', color: '#0891b2', icon: 'bot', group: 'ai' },
  { type: 'ai_recommend_next_action', label: 'IA: proxima acao', description: 'Sugere proximo passo', color: '#0891b2', icon: 'bot', group: 'ai' },
  { type: 'ai_fill_template_variables', label: 'IA: preencher variaveis', description: 'Preenche variaveis de template', color: '#0891b2', icon: 'bot', group: 'ai' },
  { type: 'noop', label: 'Sem operacao', description: 'Passo tecnico', color: '#64748b', icon: 'code', group: 'system' },
  { type: 'end', label: 'Fim', description: 'Finaliza o caminho', color: '#475569', icon: 'check', group: 'system', isTerminal: true }
];

export function createDefaultAutomationGraph(): AutomationWorkflowGraphCapability {
  return {
    version: 1,
    nodes: [
      {
        id: 'trigger-manual',
        type: 'trigger',
        label: 'Execucao manual',
        config: { triggerType: 'manual' },
        position: { x: 120, y: 120 }
      },
      {
        id: 'end',
        type: 'end',
        label: 'Fim',
        config: {},
        position: { x: 120, y: 320 }
      }
    ],
    edges: [
      {
        id: 'edge-trigger-end',
        source: 'trigger-manual',
        target: 'end'
      }
    ],
    metadata: {}
  };
}

function recipeGraph(input: {
  nodes: AutomationWorkflowGraphCapability['nodes'];
  edges: AutomationWorkflowGraphCapability['edges'];
  metadata?: Record<string, unknown>;
}): AutomationWorkflowGraphCapability {
  return {
    version: 1,
    nodes: input.nodes,
    edges: input.edges,
    metadata: {
      recipe: true,
      ...(input.metadata ?? {})
    }
  };
}

export const automationRecipeCatalog: AutomationRecipeCapability[] = [
  {
    id: 'lead-captured-to-new-lead',
    name: 'Entrada automatica de lead',
    description: 'Registra lead capturado, move o card para Novo lead e cria historico.',
    category: 'lead',
    graph: recipeGraph({
      metadata: { trigger: 'lead.captured' },
      nodes: [
        { id: 'trigger-lead-captured', type: 'trigger', label: 'Lead capturado', config: { triggerType: 'lead_captured' }, position: { x: 80, y: 120 } },
        { id: 'activity-lead-captured', type: 'register_card_activity', label: 'Registrar entrada', config: { itemIdPath: 'event.payload.itemId', eventName: 'lead.captured', message: 'Lead capturado e recebido no funil comercial.', payload: { source: '{{event.name}}' } }, position: { x: 340, y: 120 } },
        { id: 'move-lead-new', type: 'move_work_item', label: 'Mover para Novo lead', config: { itemIdPath: 'event.payload.itemId', columnSlug: 'lead_new', stateSlug: 'lead_new' }, position: { x: 610, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 860, y: 120 } }
      ],
      edges: [
        { id: 'edge-lead-1', source: 'trigger-lead-captured', target: 'activity-lead-captured' },
        { id: 'edge-lead-2', source: 'activity-lead-captured', target: 'move-lead-new' },
        { id: 'edge-lead-3', source: 'move-lead-new', target: 'end' }
      ]
    })
  },
  {
    id: 'hot-lead-followup',
    name: 'Lead quente',
    description: 'Cria alerta e follow-up para lead sinalizado como quente.',
    category: 'lead',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-hot-lead', type: 'trigger', label: 'Card atualizado', config: { triggerType: 'work_item_updated', itemTypeSlugs: ['commercial'] }, position: { x: 80, y: 120 } },
        { id: 'ai-next-action', type: 'ai_recommend_next_action', label: 'Sugerir abordagem', config: { prompt: 'Sugira a melhor abordagem para este lead quente.' }, position: { x: 340, y: 120 } },
        { id: 'activity-hot-lead', type: 'register_card_activity', label: 'Registrar alerta', config: { itemIdPath: 'event.payload.itemId', eventName: 'lead.hot', message: 'Lead quente detectado. Priorizar contato comercial.', payload: { severity: 'high' } }, position: { x: 610, y: 120 } },
        { id: 'followup-hot-lead', type: 'create_followup_task', label: 'Criar follow-up', config: { itemIdPath: 'event.payload.itemId', title: 'Contato prioritario: {{item.title}}', description: 'Lead quente exige abordagem comercial em ate 1 dia.', dueInDays: 1, assigneeIdPath: 'event.payload.requestedBy', columnSlug: 'lead_qualification' }, position: { x: 880, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1140, y: 120 } }
      ],
      edges: [
        { id: 'edge-hot-1', source: 'trigger-hot-lead', target: 'ai-next-action' },
        { id: 'edge-hot-2', source: 'ai-next-action', target: 'activity-hot-lead' },
        { id: 'edge-hot-3', source: 'activity-hot-lead', target: 'followup-hot-lead' },
        { id: 'edge-hot-4', source: 'followup-hot-lead', target: 'end' }
      ]
    })
  },
  {
    id: 'first-contact-on-new-lead',
    name: 'Primeiro contato',
    description: 'Gera mensagem, solicita aprovacao e envia primeiro contato quando card entra em Novo lead.',
    category: 'lead',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-new-lead', type: 'trigger', label: 'Entrou em Novo lead', config: { triggerType: 'work_item_moved_to_column', column: 'lead_new' }, position: { x: 80, y: 120 } },
        { id: 'ai-draft-message', type: 'ai_generate_message_draft', label: 'Gerar mensagem', config: { prompt: 'Crie uma mensagem curta de primeiro contato B2B.' }, position: { x: 330, y: 120 } },
        { id: 'approval-first-contact', type: 'human_approval', label: 'Aprovar contato', config: { type: 'send_message', title: 'Aprovar primeiro contato', description: 'Revise a mensagem antes do envio ao lead.', requestedBy: '{{event.payload.requestedBy}}', expiresInDays: 2 }, position: { x: 590, y: 120 } },
        { id: 'send-first-contact', type: 'communication_send', label: 'Enviar contato', config: { channel: 'email', to: '{{fields.contactEmail}}', body: 'Ola, recebemos seu interesse e vamos seguir com o primeiro contato.' }, position: { x: 850, y: 120 } },
        { id: 'activity-first-contact', type: 'register_card_activity', label: 'Registrar contato', config: { itemIdPath: 'event.payload.itemId', eventName: 'lead.first_contact.sent', message: 'Primeiro contato enviado ou aprovado para envio.', payload: { channel: 'email' } }, position: { x: 1110, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1370, y: 120 } }
      ],
      edges: [
        { id: 'edge-first-1', source: 'trigger-new-lead', target: 'ai-draft-message' },
        { id: 'edge-first-2', source: 'ai-draft-message', target: 'approval-first-contact' },
        { id: 'edge-first-3', source: 'approval-first-contact', target: 'send-first-contact' },
        { id: 'edge-first-4', source: 'send-first-contact', target: 'activity-first-contact' },
        { id: 'edge-first-5', source: 'activity-first-contact', target: 'end' }
      ]
    })
  },
  {
    id: 'no-response-followup',
    name: 'Follow-up sem resposta',
    description: 'Aguarda dois dias, envia follow-up, registra tentativa e cria tarefa.',
    category: 'followup',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-proposal-sent-delay', type: 'trigger', label: 'Proposta enviada', config: { triggerType: 'proposal_status_changed', status: 'sent' }, position: { x: 80, y: 120 } },
        { id: 'delay-followup', type: 'delay', label: 'Aguardar resposta', config: { delayFor: { amount: 2, unit: 'days' } }, position: { x: 330, y: 120 } },
        { id: 'send-followup', type: 'communication_send', label: 'Enviar follow-up', config: { channel: 'email', to: '{{fields.contactEmail}}', body: 'Passando para saber se conseguiu avaliar a proposta.' }, position: { x: 590, y: 120 } },
        { id: 'task-followup', type: 'create_followup_task', label: 'Criar tarefa', config: { itemIdPath: 'event.payload.linkedEntityId', title: 'Follow-up de proposta: {{item.title}}', description: 'Verificar retorno sobre proposta enviada.', dueInDays: 1, assigneeIdPath: 'event.payload.requestedBy', columnSlug: 'proposal_sent' }, position: { x: 850, y: 120 } },
        { id: 'activity-followup', type: 'register_card_activity', label: 'Registrar tentativa', config: { itemIdPath: 'event.payload.linkedEntityId', eventName: 'proposal.followup.sent', message: 'Follow-up de proposta enviado apos ausencia de resposta.', payload: { attempt: 1 } }, position: { x: 1110, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1370, y: 120 } }
      ],
      edges: [
        { id: 'edge-nr-1', source: 'trigger-proposal-sent-delay', target: 'delay-followup' },
        { id: 'edge-nr-2', source: 'delay-followup', target: 'send-followup' },
        { id: 'edge-nr-3', source: 'send-followup', target: 'task-followup' },
        { id: 'edge-nr-4', source: 'task-followup', target: 'activity-followup' },
        { id: 'edge-nr-5', source: 'activity-followup', target: 'end' }
      ]
    })
  },
  {
    id: 'proposal-preparing-create-proposal',
    name: 'Proposta em elaboracao',
    description: 'Cria proposta ao mover card para Proposta em elaboracao.',
    category: 'proposal',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-proposal-preparing', type: 'trigger', label: 'Entrou em proposta', config: { triggerType: 'work_item_moved_to_column', column: 'proposal_preparing' }, position: { x: 80, y: 120 } },
        { id: 'create-proposal', type: 'create_proposal', label: 'Criar proposta', config: { itemIdPath: 'event.payload.itemId', templateKey: 'commercial_proposal', binding: 'commercial_proposal', targetFieldSlug: 'proposalId', status: 'draft', skipIfExists: true }, position: { x: 350, y: 120 } },
        { id: 'activity-proposal-created', type: 'register_card_activity', label: 'Registrar proposta', config: { itemIdPath: 'event.payload.itemId', eventName: 'proposal.created_by_automation', message: 'Proposta criada e vinculada ao card.', payload: { documentId: '{{previousOutput.documentId}}' } }, position: { x: 620, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 880, y: 120 } }
      ],
      edges: [
        { id: 'edge-prop-1', source: 'trigger-proposal-preparing', target: 'create-proposal' },
        { id: 'edge-prop-2', source: 'create-proposal', target: 'activity-proposal-created' },
        { id: 'edge-prop-3', source: 'activity-proposal-created', target: 'end' }
      ]
    })
  },
  {
    id: 'proposal-approved-create-contract',
    name: 'Proposta aprovada para contrato',
    description: 'Cria contrato e move o card para contrato em elaboracao.',
    category: 'contract',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-proposal-approved', type: 'trigger', label: 'Proposta aprovada', config: { triggerType: 'proposal_status_changed', status: 'approved' }, position: { x: 80, y: 120 } },
        { id: 'create-contract', type: 'create_contract', label: 'Criar contrato', config: { itemIdPath: 'event.payload.linkedEntityId', proposalFieldSlug: 'proposalId', templateKey: 'commercial_contract', binding: 'commercial_contract', targetFieldSlug: 'contractId', status: 'draft', skipIfExists: true }, position: { x: 350, y: 120 } },
        { id: 'move-contract-preparing', type: 'move_work_item', label: 'Mover para contrato', config: { itemIdPath: 'event.payload.linkedEntityId', columnSlug: 'contract_preparing', stateSlug: 'contract_preparing' }, position: { x: 620, y: 120 } },
        { id: 'activity-contract-created', type: 'register_card_activity', label: 'Registrar contrato', config: { itemIdPath: 'event.payload.linkedEntityId', eventName: 'contract.created_by_automation', message: 'Contrato criado a partir de proposta aprovada.', payload: { documentId: '{{previousOutput.documentId}}' } }, position: { x: 890, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1150, y: 120 } }
      ],
      edges: [
        { id: 'edge-contract-1', source: 'trigger-proposal-approved', target: 'create-contract' },
        { id: 'edge-contract-2', source: 'create-contract', target: 'move-contract-preparing' },
        { id: 'edge-contract-3', source: 'move-contract-preparing', target: 'activity-contract-created' },
        { id: 'edge-contract-4', source: 'activity-contract-created', target: 'end' }
      ]
    })
  },
  {
    id: 'contract-accepted-create-billing',
    name: 'Contrato aceito para cobranca',
    description: 'Cria cliente, cobranca e move o card para financeiro.',
    category: 'billing',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-contract-accepted', type: 'trigger', label: 'Contrato aceito', config: { triggerType: 'contract_status_changed', status: 'accepted' }, position: { x: 80, y: 120 } },
        { id: 'ensure-customer', type: 'ensure_customer_from_work_item', label: 'Garantir cliente', config: { itemIdPath: 'event.payload.linkedEntityId', targetFieldSlug: 'customerId', status: 'active' }, position: { x: 340, y: 120 } },
        { id: 'create-billing', type: 'create_billing_order', label: 'Criar cobranca', config: { itemIdPath: 'event.payload.linkedEntityId', targetFieldSlug: 'billingOrderId', customerIdFieldSlug: 'customerId', catalogItemFieldSlug: 'interest', amountFieldSlug: 'estimatedValue', amountFieldUnit: 'major', sendEmail: true, skipIfExists: true }, position: { x: 610, y: 120 } },
        { id: 'move-billing-created', type: 'move_work_item', label: 'Mover para cobranca', config: { itemIdPath: 'event.payload.linkedEntityId', columnSlug: 'billing_created', stateSlug: 'billing_created' }, position: { x: 880, y: 120 } },
        { id: 'activity-billing-created', type: 'register_card_activity', label: 'Registrar cobranca', config: { itemIdPath: 'event.payload.linkedEntityId', eventName: 'billing.created_by_automation', message: 'Cobranca criada e vinculada ao card.', payload: { billingOrderId: '{{previousOutput.billingOrderId}}' } }, position: { x: 1150, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1410, y: 120 } }
      ],
      edges: [
        { id: 'edge-billing-1', source: 'trigger-contract-accepted', target: 'ensure-customer' },
        { id: 'edge-billing-2', source: 'ensure-customer', target: 'create-billing' },
        { id: 'edge-billing-3', source: 'create-billing', target: 'move-billing-created' },
        { id: 'edge-billing-4', source: 'move-billing-created', target: 'activity-billing-created' },
        { id: 'edge-billing-5', source: 'activity-billing-created', target: 'end' }
      ]
    })
  },
  {
    id: 'payment-confirmed-active-customer',
    name: 'Pagamento confirmado para cliente ativo',
    description: 'Garante cliente ativo, move o card para pago/ativo e cria tarefa de onboarding.',
    category: 'customer',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-payment-confirmed', type: 'trigger', label: 'Pagamento confirmado', config: { triggerType: 'billing_payment_confirmed', status: 'paid' }, position: { x: 80, y: 120 } },
        { id: 'ensure-active-customer', type: 'ensure_customer_from_work_item', label: 'Ativar cliente', config: { itemIdPath: 'event.payload.itemId', targetFieldSlug: 'customerId', status: 'active' }, position: { x: 340, y: 120 } },
        { id: 'move-paid-active', type: 'move_work_item', label: 'Mover para ativo', config: { itemIdPath: 'event.payload.itemId', columnSlug: 'paid_active', stateSlug: 'paid_active' }, position: { x: 610, y: 120 } },
        { id: 'onboarding-task', type: 'create_followup_task', label: 'Criar onboarding', config: { itemIdPath: 'event.payload.itemId', title: 'Onboarding: {{item.title}}', description: 'Iniciar checklist de onboarding do cliente ativo.', dueInDays: 2, assigneeIdPath: 'event.payload.requestedBy', columnSlug: 'paid_active' }, position: { x: 880, y: 120 } },
        { id: 'activity-payment-confirmed', type: 'register_card_activity', label: 'Registrar pagamento', config: { itemIdPath: 'event.payload.itemId', eventName: 'billing.payment.confirmed', message: 'Pagamento confirmado; cliente movido para ativo/onboarding.', payload: { billingOrderId: '{{event.payload.billingOrderId}}' } }, position: { x: 1150, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1410, y: 120 } }
      ],
      edges: [
        { id: 'edge-paid-1', source: 'trigger-payment-confirmed', target: 'ensure-active-customer' },
        { id: 'edge-paid-2', source: 'ensure-active-customer', target: 'move-paid-active' },
        { id: 'edge-paid-3', source: 'move-paid-active', target: 'onboarding-task' },
        { id: 'edge-paid-4', source: 'onboarding-task', target: 'activity-payment-confirmed' },
        { id: 'edge-paid-5', source: 'activity-payment-confirmed', target: 'end' }
      ]
    })
  },
  {
    id: 'billing-overdue-finance-alert',
    name: 'Cobranca vencida',
    description: 'Registra alerta financeiro, envia lembrete e cria tarefa de cobranca.',
    category: 'billing',
    graph: recipeGraph({
      nodes: [
        { id: 'trigger-billing-overdue', type: 'trigger', label: 'Cobranca vencida', config: { triggerType: 'billing_overdue', status: 'overdue' }, position: { x: 80, y: 120 } },
        { id: 'activity-overdue', type: 'register_card_activity', label: 'Registrar alerta', config: { itemIdPath: 'event.payload.itemId', eventName: 'billing.overdue', message: 'Cobranca vencida detectada. Acao financeira necessaria.', payload: { severity: 'high' } }, position: { x: 340, y: 120 } },
        { id: 'send-overdue-reminder', type: 'communication_send', label: 'Enviar lembrete', config: { channel: 'email', to: '{{fields.contactEmail}}', body: 'Identificamos uma cobranca em aberto. Podemos ajudar com o pagamento?' }, position: { x: 610, y: 120 } },
        { id: 'task-overdue', type: 'create_followup_task', label: 'Criar tarefa financeira', config: { itemIdPath: 'event.payload.itemId', title: 'Cobranca vencida: {{item.title}}', description: 'Acompanhar cobranca vencida e registrar retorno financeiro.', dueInDays: 1, assigneeIdPath: 'event.payload.requestedBy', columnSlug: 'payment_overdue' }, position: { x: 880, y: 120 } },
        { id: 'move-overdue', type: 'move_work_item', label: 'Mover para atraso', config: { itemIdPath: 'event.payload.itemId', columnSlug: 'payment_overdue', stateSlug: 'payment_overdue' }, position: { x: 1150, y: 120 } },
        { id: 'end', type: 'end', label: 'Fim', config: {}, position: { x: 1410, y: 120 } }
      ],
      edges: [
        { id: 'edge-overdue-1', source: 'trigger-billing-overdue', target: 'activity-overdue' },
        { id: 'edge-overdue-2', source: 'activity-overdue', target: 'send-overdue-reminder' },
        { id: 'edge-overdue-3', source: 'send-overdue-reminder', target: 'task-overdue' },
        { id: 'edge-overdue-4', source: 'task-overdue', target: 'move-overdue' },
        { id: 'edge-overdue-5', source: 'move-overdue', target: 'end' }
      ]
    })
  }
];

export function getAutomationCapabilities(): AutomationCapabilities {
  return {
    schemaVersion: 1,
    nodeCatalog: automationNodeCatalog,
    recipeCatalog: automationRecipeCatalog,
    defaultGraph: createDefaultAutomationGraph()
  };
}
