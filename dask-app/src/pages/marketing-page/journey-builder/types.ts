import type { Edge, Node } from '@xyflow/react';

export type JourneyNodeKind = 'TRIGGER' | 'CONDITION' | 'DELAY' | 'ACTION' | 'EXIT';

export type TriggerEvent =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.score_updated'
  | 'invoice.overdue'
  | 'campaign.opened'
  | 'campaign.clicked'
  | 'form.submitted'
  | 'manual';

export type ActionType =
  | 'send_campaign'
  | 'update_score'
  | 'move_lead'
  | 'create_task'
  | 'notify_user'
  | 'start_flow'
  | 'tag_lead'
  | 'webhook';

export type DelayUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export interface TriggerConfig {
  event: TriggerEvent;
  segmentId?: string;
  filters?: Record<string, unknown>;
}

export interface ActionConfig {
  type: ActionType;
  campaignId?: string;
  scoreChange?: number;
  targetStatus?: string;
  taskTitle?: string;
  notifyUserId?: string;
  targetFlowId?: string;
  tag?: string;
  webhookUrl?: string;
  label?: string;
}

export interface ConditionConfig {
  logic: 'AND' | 'OR';
  rules: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gte' | 'lte' | 'contains' | 'in' | 'is_true' | 'is_false';
    value?: string | number | boolean;
  }>;
  yesLabel?: string;
  noLabel?: string;
}

export interface DelayConfig {
  duration: number;
  unit: DelayUnit;
}

export interface ExitConfig {
  reason?: string;
}

export type JourneyNodeConfig =
  | TriggerConfig
  | ActionConfig
  | ConditionConfig
  | DelayConfig
  | ExitConfig;

export type JourneyNodeValidation = 'valid' | 'incomplete' | 'error';

export interface JourneyNodeData extends Record<string, unknown> {
  kind: JourneyNodeKind;
  label: string;
  config: JourneyNodeConfig;
  validation: JourneyNodeValidation;
  enrolledCount?: number;
}

export type JourneyNode = Node<JourneyNodeData, JourneyNodeKind>;
export type JourneyEdge = Edge<{ label?: string; branchType?: 'yes' | 'no' | 'default' }>;

export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  'lead.created': 'Lead criado',
  'lead.status_changed': 'Status mudou',
  'lead.score_updated': 'Score atualizado',
  'invoice.overdue': 'Invoice vencida',
  'campaign.opened': 'Campanha aberta',
  'campaign.clicked': 'Campanha clicada',
  'form.submitted': 'Formulário enviado',
  manual: 'Manual',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_campaign: 'Enviar campanha',
  update_score: 'Atualizar score',
  move_lead: 'Mover lead',
  create_task: 'Criar tarefa',
  notify_user: 'Notificar usuário',
  start_flow: 'Iniciar outro fluxo',
  tag_lead: 'Adicionar tag',
  webhook: 'Disparar webhook',
};

export interface PaletteItem {
  kind: JourneyNodeKind;
  label: string;
  description: string;
  icon: string;
  defaultConfig: JourneyNodeConfig;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: 'TRIGGER',
    label: 'Gatilho',
    description: 'Ponto de entrada do fluxo',
    icon: 'trigger',
    defaultConfig: { event: 'lead.created' } as TriggerConfig,
  },
  {
    kind: 'ACTION',
    label: 'Ação',
    description: 'Executar uma ação',
    icon: 'action',
    defaultConfig: { type: 'send_campaign', label: 'Enviar campanha' } as ActionConfig,
  },
  {
    kind: 'CONDITION',
    label: 'Condição',
    description: 'Dividir caminho com if/else',
    icon: 'condition',
    defaultConfig: {
      logic: 'AND',
      rules: [{ field: 'score', operator: 'gte', value: 60 }],
      yesLabel: 'Sim',
      noLabel: 'Não',
    } as ConditionConfig,
  },
  {
    kind: 'DELAY',
    label: 'Espera',
    description: 'Aguardar antes de continuar',
    icon: 'delay',
    defaultConfig: { duration: 3, unit: 'days' } as DelayConfig,
  },
  {
    kind: 'EXIT',
    label: 'Saída',
    description: 'Encerrar a jornada',
    icon: 'exit',
    defaultConfig: { reason: '' } as ExitConfig,
  },
];

export function validateNode(data: JourneyNodeData): JourneyNodeValidation {
  const { kind, config } = data;
  if (kind === 'TRIGGER') {
    return (config as TriggerConfig).event ? 'valid' : 'incomplete';
  }
  if (kind === 'ACTION') {
    const c = config as ActionConfig;
    return c.type ? 'valid' : 'incomplete';
  }
  if (kind === 'CONDITION') {
    const c = config as ConditionConfig;
    return c.rules && c.rules.length > 0 ? 'valid' : 'incomplete';
  }
  if (kind === 'DELAY') {
    const c = config as DelayConfig;
    return c.duration > 0 && c.unit ? 'valid' : 'incomplete';
  }
  return 'valid';
}
