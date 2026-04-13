import type { BoardConfig, TaskTypeMetaItem } from "@/entities/task/model/types";

export const factoryBoardConfig: BoardConfig = {
  statuses: [
    { id: "backlog", label: "Backlog", dot: "#8b9bb0" },
    { id: "in-progress", label: "Em Progresso", dot: "#0d8df7" },
    { id: "in-review", label: "Review", dot: "#f59e0b" },
    { id: "done", label: "Done", dot: "#22c55e" }
  ],
  taskTypes: [
    { id: "bug", label: "Bug", background: "#ffe9e9", border: "#ffc8c8", text: "#a01f1f" },
    { id: "user-story", label: "User Story", background: "#e9f8ef", border: "#ccefd9", text: "#176142" },
    { id: "task", label: "Task", background: "#e7f3ff", border: "#c8e3ff", text: "#0369a1" },
    { id: "improvement", label: "Melhoria", background: "#fff5e7", border: "#ffe2bc", text: "#8a5a00" },
    { id: "epic", label: "Epic", background: "#efe9ff", border: "#dccdff", text: "#50308c" },
    { id: "spike", label: "Spike", background: "#eaf6ff", border: "#cce8fb", text: "#1f6586" },
    { id: "incident", label: "Incidente", background: "#ffeef0", border: "#ffd1d8", text: "#9b2034" },
    { id: "hotfix", label: "Hotfix", background: "#ffeede", border: "#ffd3b0", text: "#9b4d00" },
    { id: "chore", label: "Chore", background: "#f2f5f8", border: "#dae1e9", text: "#4a5f75" },
    { id: "research", label: "Research", background: "#eef0ff", border: "#d7dcff", text: "#384c9a" }
  ],
  fieldDefinitions: [
    { id: "story-points", label: "Story Points", type: "number" },
    { id: "severity", label: "Severidade", type: "select", options: ["Critical", "High", "Medium", "Low"] },
    {
      id: "planning-status",
      label: "Status Planejamento",
      type: "select",
      options: ["plan-ideas", "plan-committed", "plan-building", "plan-ready"]
    },
    {
      id: "qa-status",
      label: "Status QA",
      type: "select",
      options: ["qa-ready", "qa-testing", "qa-approved", "qa-rejected"]
    },
    {
      id: "manager-lane",
      label: "Faixa Gerencial",
      type: "select",
      options: ["mgr-epics", "mgr-initiatives", "mgr-risks", "mgr-delivery"]
    },
    { id: "sprint", label: "Sprint", type: "text" },
    { id: "component", label: "Componente", type: "text" },
    { id: "environment", label: "Ambiente", type: "select", options: ["Production", "Staging", "Development"] },
    { id: "qaReady", label: "QA Ready", type: "boolean" },
    { id: "customerImpact", label: "Impacto Cliente", type: "select", options: ["Alto", "Medio", "Baixo"] },
    { id: "release", label: "Release", type: "text" },
    { id: "squad", label: "Squad", type: "text" }
  ],
  cardLayout: {
    visibleFieldIds: ["story-points", "severity", "sprint", "environment"]
  },
  views: [
    {
      id: "dev",
      label: "Perspective",
      caption: "Fluxo operacional principal",
      statuses: [
        { id: "backlog", label: "Backlog", dot: "#8b9bb0" },
        { id: "in-progress", label: "Em Progresso", dot: "#0d8df7" },
        { id: "in-review", label: "Review", dot: "#f59e0b" },
        { id: "done", label: "Done", dot: "#22c55e" }
      ],
      statusSource: {
        kind: "workflow_state"
      }
    },
    {
      id: "po",
      label: "Planejamento",
      caption: "Priorizacao e compromisso",
      statuses: [
        { id: "plan-ideas", label: "Ideias", dot: "#8b9bb0" },
        { id: "plan-committed", label: "Planejado", dot: "#1976d2" },
        { id: "plan-building", label: "Construindo", dot: "#f59e0b" },
        { id: "plan-ready", label: "Pronto para entrega", dot: "#22c55e" }
      ],
      statusSource: {
        kind: "custom_field",
        fieldId: "planning-status",
        fallbackByStatus: {
          done: "plan-ready",
          "in-review": "plan-building",
          "in-progress": "plan-committed",
          backlog: "plan-ideas"
        }
      }
    },
    {
      id: "manager",
      label: "Gestao",
      caption: "Visao de capacidade e risco",
      statuses: [
        { id: "mgr-epics", label: "Epicos", dot: "#7c3aed" },
        { id: "mgr-initiatives", label: "Iniciativas", dot: "#0d8df7" },
        { id: "mgr-risks", label: "Riscos", dot: "#ef4444" },
        { id: "mgr-delivery", label: "Entrega", dot: "#16a34a" }
      ],
      statusSource: {
        kind: "custom_field",
        fieldId: "manager-lane",
        fallbackByStatus: {
          done: "mgr-delivery",
          "in-review": "mgr-initiatives",
          "in-progress": "mgr-initiatives",
          backlog: "mgr-epics"
        }
      },
      allowedTaskTypes: ["epic", "user-story", "improvement", "research", "spike", "bug", "incident", "hotfix"]
    },
    {
      id: "qa",
      label: "Qualidade",
      caption: "Validacao e conformidade",
      statuses: [
        { id: "qa-ready", label: "Liberado para teste", dot: "#4f8cff" },
        { id: "qa-testing", label: "Em teste", dot: "#f59e0b" },
        { id: "qa-approved", label: "Aprovado", dot: "#22c55e" },
        { id: "qa-rejected", label: "Reprovado", dot: "#e53935" }
      ],
      statusSource: {
        kind: "custom_field",
        fieldId: "qa-status",
        fallbackByStatus: {
          done: "qa-approved",
          "in-review": "qa-testing",
          "in-progress": "qa-testing",
          backlog: "qa-ready"
        }
      },
      compactCards: true
    }
  ]
};

export function buildTaskTypeMetaMap(taskTypes: TaskTypeMetaItem[]): Record<string, TaskTypeMetaItem> {
  return taskTypes.reduce<Record<string, TaskTypeMetaItem>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}
