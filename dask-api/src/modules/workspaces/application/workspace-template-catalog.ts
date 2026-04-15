export type WorkspaceTemplateKey = 'software_delivery' | 'product_discovery' | 'operations_kanban';

export type WorkspaceTemplateDefinition = {
  key: WorkspaceTemplateKey;
  name: string;
  description: string;
  boardName: string;
  boardDescription: string;
  schema: Record<string, unknown>;
  rules: Record<string, unknown>;
};

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

export const workspaceTemplateCatalog: WorkspaceTemplateDefinition[] = [
  {
    key: 'software_delivery',
    name: 'Entrega de software',
    description: 'Backlog, execucao, revisao e pronto. Uma base objetiva para times de produto e engenharia.',
    boardName: 'Entrega',
    boardDescription: 'Fluxo simples para planejar, executar e validar entregas.',
    schema: {
      lanes: ['backlog', 'doing', 'review', 'done'],
      issueTypes: ['bug', 'task', 'user-story', 'epic', 'spike'],
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
          allowedTaskTypes: ['bug', 'task', 'user-story', 'epic', 'spike'],
          visibleBoardColumnSlugs: ['doing', 'review', 'done']
        }
      ]
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
      issueTypes: ['opportunity', 'hypothesis', 'experiment', 'insight'],
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
      ]
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
      issueTypes: ['incident', 'request', 'maintenance', 'problem'],
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
      ]
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
