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

const defaultPerspectiveStatuses = [
  { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
  { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
  { id: 'in-review', label: 'Review', dot: '#f59e0b' },
  { id: 'done', label: 'Done', dot: '#22c55e' }
];

export const workspaceTemplateCatalog: WorkspaceTemplateDefinition[] = [
  {
    key: 'software_delivery',
    name: 'Software Delivery',
    description: 'Template padrao com o layout operacional atual do produto.',
    boardName: 'Engineering Delivery',
    boardDescription: 'Fluxo padrao para squads de produto e engenharia.',
    schema: {
      lanes: ['backlog', 'doing', 'review', 'done'],
      issueTypes: ['epic', 'user-story', 'task', 'bug', 'improvement', 'spike', 'incident', 'hotfix', 'chore', 'research'],
      perspectives: [
        {
          key: 'dev',
          name: 'DEV',
          caption: 'Fluxo operacional principal',
          statuses: defaultPerspectiveStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['backlog', 'doing', 'review', 'done']
        },
        {
          key: 'po',
          name: 'PO',
          caption: 'Planejamento e priorizacao',
          statuses: defaultPerspectiveStatuses,
          statusSource: { kind: 'workflow_state' },
          visibleBoardColumnSlugs: ['backlog', 'doing', 'review']
        },
        {
          key: 'qa',
          name: 'QA',
          caption: 'Validacao e conformidade',
          statuses: defaultPerspectiveStatuses,
          statusSource: { kind: 'workflow_state' },
          compactCards: true,
          visibleBoardColumnSlugs: ['review', 'done']
        },
        {
          key: 'management',
          name: 'GESTAO',
          caption: 'Visao de capacidade e risco',
          statuses: defaultPerspectiveStatuses,
          statusSource: { kind: 'workflow_state' },
          allowedTaskTypes: ['epic', 'user-story', 'improvement', 'research', 'spike', 'bug', 'incident', 'hotfix'],
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
    name: 'Product Discovery',
    description: 'Template de discovery (usa o mesmo preset padrao nesta fase).',
    boardName: 'Discovery Board',
    boardDescription: 'Mapeie hipoteses, experimentos e decisoes de produto.',
    schema: {
      lanes: ['ideas', 'discovery', 'experiment', 'validated'],
      issueTypes: ['opportunity', 'hypothesis', 'experiment', 'insight']
    },
    rules: {
      defaultPriority: 'medium',
      doneState: 'validated'
    }
  },
  {
    key: 'operations_kanban',
    name: 'Operations Kanban',
    description: 'Template de operacao (usa o mesmo preset padrao nesta fase).',
    boardName: 'Operations Control',
    boardDescription: 'Gerencie incidentes, manutencao e fila operacional.',
    schema: {
      lanes: ['queue', 'triage', 'in-progress', 'resolved'],
      issueTypes: ['incident', 'request', 'maintenance', 'problem']
    },
    rules: {
      slaTracking: true,
      doneState: 'resolved'
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
