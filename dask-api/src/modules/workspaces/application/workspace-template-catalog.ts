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
      boardViews: [
        {
          key: 'dev',
          name: 'Execucao',
          caption: 'Fluxo operacional principal',
          statuses: [
            { id: 'backlog', label: 'Backlog', dot: '#8b9bb0' },
            { id: 'in-progress', label: 'Em Progresso', dot: '#0d8df7' },
            { id: 'in-review', label: 'Review', dot: '#f59e0b' },
            { id: 'done', label: 'Done', dot: '#22c55e' }
          ],
          statusSource: { kind: 'workflow_state' }
        },
        {
          key: 'po',
          name: 'Planejamento',
          caption: 'Priorizacao e compromisso',
          statuses: [
            { id: 'plan-ideas', label: 'Ideias', dot: '#8b9bb0' },
            { id: 'plan-committed', label: 'Planejado', dot: '#1976d2' },
            { id: 'plan-building', label: 'Construindo', dot: '#f59e0b' },
            { id: 'plan-ready', label: 'Pronto para entrega', dot: '#22c55e' }
          ],
          statusSource: { kind: 'custom_field', fieldId: 'planning-status' }
        },
        {
          key: 'manager',
          name: 'Gestao',
          caption: 'Visao de capacidade e risco',
          statuses: [
            { id: 'mgr-epics', label: 'Epicos', dot: '#7c3aed' },
            { id: 'mgr-initiatives', label: 'Iniciativas', dot: '#0d8df7' },
            { id: 'mgr-risks', label: 'Riscos', dot: '#ef4444' },
            { id: 'mgr-delivery', label: 'Entrega', dot: '#16a34a' }
          ],
          statusSource: { kind: 'custom_field', fieldId: 'manager-lane' }
        },
        {
          key: 'qa',
          name: 'Qualidade',
          caption: 'Validacao e conformidade',
          statuses: [
            { id: 'qa-ready', label: 'Liberado para teste', dot: '#4f8cff' },
            { id: 'qa-testing', label: 'Em teste', dot: '#f59e0b' },
            { id: 'qa-approved', label: 'Aprovado', dot: '#22c55e' },
            { id: 'qa-rejected', label: 'Reprovado', dot: '#e53935' }
          ],
          statusSource: { kind: 'custom_field', fieldId: 'qa-status' }
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
