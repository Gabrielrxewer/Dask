import type { BoardConfig } from "@/entities/task/model/types";

const defaultPerspectiveStatuses = [
  { id: "backlog", label: "Backlog", dot: "var(--text-muted)" },
  { id: "in-progress", label: "Em Progresso", dot: "var(--brand-blue)" },
  { id: "in-review", label: "Review", dot: "var(--warning)" },
  { id: "done", label: "Done", dot: "var(--success)" }
];

export const factoryBoardConfig: BoardConfig = {
  statuses: [...defaultPerspectiveStatuses],
  taskTypes: [
    { id: "bug", label: "Bug", background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--danger)" },
    { id: "user-story", label: "User Story", background: "var(--surface-tint)", border: "var(--success-border)", text: "var(--success)" },
    { id: "task", label: "Task", background: "var(--surface-blue-muted)", border: "var(--info-border)", text: "var(--primary)" },
    { id: "improvement", label: "Melhoria", background: "var(--warning-bg)", border: "var(--warning-bg)", text: "var(--warning)" },
    { id: "epic", label: "Epic", background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--warning)" },
    { id: "spike", label: "Spike", background: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning)" },
    { id: "incident", label: "Incidente", background: "var(--surface-tint)", border: "var(--danger-border)", text: "var(--danger)" },
    { id: "hotfix", label: "Hotfix", background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--warning)" },
    { id: "chore", label: "Chore", background: "var(--secondary)", border: "var(--border-default)", text: "var(--text-secondary)" },
    { id: "research", label: "Research", background: "var(--surface-tint)", border: "var(--info-border)", text: "var(--brand-indigo)" }
  ],
  fieldDefinitions: [],
  cardLayout: {
    visibleFieldIds: []
  },
  perspectives: [
    {
      id: "dev",
      label: "DEV",
      caption: "Fluxo operacional principal",
      statuses: [...defaultPerspectiveStatuses],
      statusSource: {
        kind: "workflow_state"
      },
      visibleBoardColumnIds: ["backlog", "doing", "review", "done"]
    },
    {
      id: "po",
      label: "PO",
      caption: "Planejamento e priorizacao",
      statuses: [...defaultPerspectiveStatuses],
      statusSource: {
        kind: "workflow_state"
      },
      visibleBoardColumnIds: ["backlog", "doing", "review"]
    },
    {
      id: "qa",
      label: "QA",
      caption: "Validacao e qualidade",
      statuses: [...defaultPerspectiveStatuses],
      statusSource: {
        kind: "workflow_state"
      },
      compactCards: true,
      visibleBoardColumnIds: ["review", "done"]
    },
    {
      id: "management",
      label: "GESTAO",
      caption: "Acompanhamento executivo",
      statuses: [...defaultPerspectiveStatuses],
      statusSource: {
        kind: "workflow_state"
      },
      allowedTaskTypes: ["epic", "user-story", "improvement", "research", "spike", "bug", "incident", "hotfix"],
      visibleBoardColumnIds: ["doing", "review", "done"]
    }
  ]
};

