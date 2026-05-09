import type { AutomationGraphNode } from '@/modules/automation/application/workflow-execution-types';

export type AutomationNodeGroup =
  | 'triggers'
  | 'conditions'
  | 'time'
  | 'communication'
  | 'ai'
  | 'approval'
  | 'card'
  | 'proposals'
  | 'contracts'
  | 'documents'
  | 'finance'
  | 'customers'
  | 'history'
  | 'system';

export type AutomationNodeConfigSchema = {
  type: string;
  label: string;
  required: string[];
  requiredAny?: string[][];
  description: string;
};

export type AutomationNodeConfigIssue = {
  nodeId: string;
  nodeType: string;
  path: string;
  message: string;
};

const documentStatuses = new Set(['draft', 'sent', 'viewed', 'approved', 'rejected', 'accepted', 'signed']);
const documentKinds = new Set(['proposal', 'contract', 'wiki']);
const triggerTypesWithRequiredConfig = new Map<string, string[]>([
  ['work_item_moved_to_column', ['column|columnSlug|toColumnKey']],
  ['work_item_state_changed', ['stateSlug|status|toStateSlug']],
  ['proposal_status_changed', ['status']],
  ['contract_status_changed', ['status']],
  ['billing_payment_confirmed', ['status']],
  ['billing_payment_failed', ['status']],
  ['billing_overdue', ['status']]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  }

  return false;
}

function hasObjectEntries(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function hasAny(config: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = config[key];
    return hasText(value) || hasPositiveNumber(value) || hasObjectEntries(value) || Array.isArray(value) && value.length > 0;
  });
}

function hasItemReference(config: Record<string, unknown>): boolean {
  return hasAny(config, ['itemId', 'itemIdPath', 'workItemId', 'workItemIdPath', 'sourceItemId', 'sourceItemIdPath']);
}

function hasDocumentReference(config: Record<string, unknown>): boolean {
  return hasAny(config, ['documentId', 'documentIdPath', 'documentFieldSlug']) ||
    (hasItemReference(config) && hasAny(config, ['kind', 'documentKind']));
}

function issue(node: AutomationGraphNode, path: string, message: string): AutomationNodeConfigIssue {
  return {
    nodeId: node.id,
    nodeType: node.type,
    path,
    message
  };
}

function requireAny(
  node: AutomationGraphNode,
  config: Record<string, unknown>,
  path: string,
  keys: string[],
  message: string
): AutomationNodeConfigIssue[] {
  return hasAny(config, keys) ? [] : [issue(node, path, message)];
}

function requireItem(node: AutomationGraphNode, config: Record<string, unknown>): AutomationNodeConfigIssue[] {
  return hasItemReference(config)
    ? []
    : [issue(node, 'config.itemIdPath', 'Configure qual card/work item sera usado pela acao.')];
}

export const automationNodeConfigSchemas: Record<string, AutomationNodeConfigSchema> = {
  trigger: {
    type: 'trigger',
    label: 'Gatilho',
    required: ['triggerType'],
    description: 'Define o evento de entrada do workflow.'
  },
  move_work_item: {
    type: 'move_work_item',
    label: 'Mover card',
    required: ['itemIdPath'],
    requiredAny: [['columnId', 'columnSlug', 'stateId', 'stateSlug']],
    description: 'Move um card para uma coluna ou estado do workspace.'
  },
  update_work_item_fields: {
    type: 'update_work_item_fields',
    label: 'Atualizar campos do card',
    required: ['itemIdPath'],
    requiredAny: [['title', 'description', 'typeSlug', 'assigneeId', 'dueDate', 'customFieldValues', 'fields', 'metadata']],
    description: 'Atualiza dados nativos, metadata ou campos customizados do card.'
  },
  create_proposal: {
    type: 'create_proposal',
    label: 'Criar proposta',
    required: ['itemIdPath', 'targetFieldSlug', 'templateKey'],
    description: 'Cria uma proposta comercial vinculada ao card.'
  },
  create_contract: {
    type: 'create_contract',
    label: 'Criar contrato',
    required: ['itemIdPath', 'targetFieldSlug', 'templateKey', 'proposalFieldSlug'],
    description: 'Cria um contrato comercial com base nos dados do card e, quando possivel, da proposta aprovada.'
  },
  send_document: {
    type: 'send_document',
    label: 'Enviar documento',
    required: ['itemIdPath', 'kind', 'emailPath'],
    requiredAny: [['documentId', 'documentIdPath', 'documentFieldSlug']],
    description: 'Envia proposta ou contrato pelo fluxo oficial de documentos.'
  },
  update_document_status: {
    type: 'update_document_status',
    label: 'Atualizar status de documento',
    required: ['status'],
    requiredAny: [['documentId', 'documentIdPath', 'documentFieldSlug', 'itemIdPath']],
    description: 'Atualiza o status comercial de proposta ou contrato.'
  },
  ensure_customer_from_work_item: {
    type: 'ensure_customer_from_work_item',
    label: 'Criar/vincular cliente',
    required: ['itemIdPath', 'targetFieldSlug'],
    description: 'Cria ou vincula um cliente usando os dados do card.'
  },
  create_billing_order: {
    type: 'create_billing_order',
    label: 'Criar cobranca',
    required: ['itemIdPath', 'targetFieldSlug', 'customerIdFieldSlug'],
    requiredAny: [['catalogItemId', 'catalogItemFieldSlug', 'amountCents', 'amountFieldSlug']],
    description: 'Cria uma cobranca real pelo modulo de billing.'
  },
  create_followup_task: {
    type: 'create_followup_task',
    label: 'Criar tarefa de follow-up',
    required: ['itemIdPath', 'title', 'description', 'assigneeIdPath'],
    requiredAny: [['dueAt', 'dueInDays']],
    description: 'Cria uma tarefa rastreavel vinculada ao card original.'
  },
  register_card_activity: {
    type: 'register_card_activity',
    label: 'Registrar historico',
    required: ['itemIdPath', 'eventName', 'message'],
    description: 'Registra uma atividade auditavel no historico do card.'
  },
  human_approval: {
    type: 'human_approval',
    label: 'Aprovacao humana',
    required: ['type', 'title', 'description', 'requestedBy'],
    description: 'Cria uma aprovacao humana antes de continuar o workflow.'
  },
  delay: {
    type: 'delay',
    label: 'Delay',
    required: ['delayFor'],
    description: 'Agenda a retomada do workflow para uma data futura.'
  },
  communication_send: {
    type: 'communication_send',
    label: 'Enviar mensagem',
    required: ['channel'],
    requiredAny: [['body', 'templateKey']],
    description: 'Enfileira comunicacao por e-mail ou WhatsApp.'
  }
};

export function validateAutomationNodeConfig(node: AutomationGraphNode): AutomationNodeConfigIssue[] {
  const config = isRecord(node.config) ? node.config : {};

  switch (node.type) {
    case 'trigger':
      return validateTriggerNode(node, config);
    case 'move_work_item':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.destination', ['columnId', 'columnSlug', 'stateId', 'stateSlug'], 'Mover card exige coluna ou estado de destino.')
      ];
    case 'update_work_item_fields':
      return [
        ...requireItem(node, config),
        ...requireAny(
          node,
          config,
          'config.fields',
          ['title', 'description', 'typeSlug', 'assigneeId', 'dueDate', 'customFieldValues', 'fields', 'metadata'],
          'Atualizar card exige pelo menos um campo nativo, metadata ou custom field.'
        )
      ];
    case 'create_proposal':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.targetFieldSlug', ['targetFieldSlug'], 'Criar proposta exige campo de vinculo da proposta no card.'),
        ...requireAny(node, config, 'config.templateKey', ['templateKey', 'binding', 'title', 'content'], 'Criar proposta exige template, binding, titulo ou conteudo.')
      ];
    case 'create_contract':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.targetFieldSlug', ['targetFieldSlug'], 'Criar contrato exige campo de vinculo do contrato no card.'),
        ...requireAny(node, config, 'config.templateKey', ['templateKey', 'binding', 'title', 'content'], 'Criar contrato exige template, binding, titulo ou conteudo.'),
        ...requireAny(node, config, 'config.proposal', ['proposalId', 'proposalIdPath', 'proposalFieldSlug'], 'Criar contrato exige referencia da proposta base.')
      ];
    case 'send_document':
      return [
        ...(hasDocumentReference(config) ? [] : [issue(node, 'config.document', 'Enviar documento exige documentId ou campo do documento no card.')]),
        ...requireAny(node, config, 'config.email', ['email', 'emailPath', 'emails'], 'Enviar documento exige destinatario ou caminho para e-mail.'),
        ...validateDocumentKind(node, config)
      ];
    case 'update_document_status':
      return [
        ...(hasDocumentReference(config) ? [] : [issue(node, 'config.document', 'Atualizar status exige documentId ou campo do documento no card.')]),
        ...requireAny(node, config, 'config.status', ['status'], 'Atualizar documento exige status.'),
        ...validateDocumentStatus(node, config)
      ];
    case 'ensure_customer_from_work_item':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.targetFieldSlug', ['targetFieldSlug'], 'Criar/vincular cliente exige campo de vinculo no card.')
      ];
    case 'create_billing_order':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.targetFieldSlug', ['targetFieldSlug'], 'Criar cobranca exige campo de vinculo da cobranca no card.'),
        ...requireAny(node, config, 'config.customer', ['customerId', 'customerIdFieldSlug'], 'Criar cobranca exige cliente ou campo de cliente.'),
        ...requireAny(node, config, 'config.amount', ['catalogItemId', 'catalogItemFieldSlug', 'amountCents', 'amountFieldSlug'], 'Criar cobranca exige item de catalogo ou valor.')
      ];
    case 'create_followup_task':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.title', ['title'], 'Criar follow-up exige titulo.'),
        ...requireAny(node, config, 'config.description', ['description'], 'Criar follow-up exige descricao.'),
        ...requireAny(node, config, 'config.assignee', ['assigneeId', 'assigneeIdPath'], 'Criar follow-up exige responsavel.'),
        ...requireAny(node, config, 'config.due', ['dueAt', 'dueInDays'], 'Criar follow-up exige prazo.')
      ];
    case 'register_card_activity':
      return [
        ...requireItem(node, config),
        ...requireAny(node, config, 'config.eventName', ['eventName'], 'Registrar historico exige tipo/evento.'),
        ...requireAny(node, config, 'config.message', ['message'], 'Registrar historico exige mensagem legivel.')
      ];
    case 'human_approval':
      return [
        ...requireAny(node, config, 'config.type', ['type'], 'Aprovacao humana exige tipo.'),
        ...requireAny(node, config, 'config.title', ['title'], 'Aprovacao humana exige titulo.'),
        ...requireAny(node, config, 'config.description', ['description'], 'Aprovacao humana exige motivo/mensagem.'),
        ...requireAny(node, config, 'config.requestedBy', ['requestedBy', 'requestedByPath'], 'Aprovacao humana exige solicitante ou aprovador.')
      ];
    case 'delay':
      return validateDelayNode(node, config);
    case 'communication_send':
      return [
        ...requireAny(node, config, 'config.channel', ['channel'], 'Enviar mensagem exige canal.'),
        ...requireAny(node, config, 'config.body', ['body', 'templateKey'], 'Enviar mensagem exige corpo ou template.')
      ];
    default:
      return [];
  }
}

function validateTriggerNode(node: AutomationGraphNode, config: Record<string, unknown>): AutomationNodeConfigIssue[] {
  const explicitEvent = hasAny(config, ['eventName', 'eventNames', 'domainEvent', 'domainEvents']);
  if (explicitEvent) {
    return [];
  }

  const triggerType = hasText(config.triggerType) ? String(config.triggerType).trim() : 'manual';
  const required = triggerTypesWithRequiredConfig.get(triggerType) ?? [];
  const issues: AutomationNodeConfigIssue[] = [];

  for (const requirement of required) {
    const keys = requirement.split('|');
    if (!hasAny(config, keys)) {
      issues.push(issue(node, `config.${keys[0]}`, `Gatilho ${triggerType} exige ${requirement}.`));
    }
  }

  return issues;
}

function validateDocumentKind(node: AutomationGraphNode, config: Record<string, unknown>): AutomationNodeConfigIssue[] {
  if (!hasText(config.kind)) {
    return [];
  }

  return documentKinds.has(String(config.kind))
    ? []
    : [issue(node, 'config.kind', 'Tipo de documento invalido.')];
}

function validateDocumentStatus(node: AutomationGraphNode, config: Record<string, unknown>): AutomationNodeConfigIssue[] {
  if (!hasText(config.status)) {
    return [];
  }

  return documentStatuses.has(String(config.status))
    ? []
    : [issue(node, 'config.status', 'Status de documento invalido.')];
}

function validateDelayNode(node: AutomationGraphNode, config: Record<string, unknown>): AutomationNodeConfigIssue[] {
  if (hasText(config.delayUntil)) {
    return [];
  }

  if (!isRecord(config.delayFor)) {
    return [issue(node, 'config.delayFor', 'Delay exige delayFor ou delayUntil.')];
  }

  const amount = Number(config.delayFor.amount);
  const unit = String(config.delayFor.unit ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return [issue(node, 'config.delayFor', 'Delay exige quantidade positiva e unidade.')];
  }

  return [];
}

