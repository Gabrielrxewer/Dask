import type { BoardConfig, TaskTypeMetaItem } from "@/entities/task/model/types";

export const factoryBoardConfig: BoardConfig = {
  statuses: [
    { id: "backlog", label: "Backlog", dot: "#8b9bb0" },
    { id: "doing", label: "Em Progresso", dot: "#0d8df7" },
    { id: "review", label: "Review", dot: "#f59e0b" },
    { id: "done", label: "Done", dot: "#22c55e" }
  ],
  taskTypes: [
    { id: "bug", label: "Bug", background: "#ffe9e9", border: "#ffc8c8", text: "#a01f1f" },
    { id: "user-story", label: "User Story", background: "#e9f8ef", border: "#ccefd9", text: "#176142" },
    { id: "improvement", label: "Melhoria", background: "#fff5e7", border: "#ffe2bc", text: "#8a5a00" },
    { id: "epic", label: "Epic", background: "#efe9ff", border: "#dccdff", text: "#50308c" },
    { id: "spike", label: "Spike", background: "#eaf6ff", border: "#cce8fb", text: "#1f6586" },
    { id: "incident", label: "Incidente", background: "#ffeef0", border: "#ffd1d8", text: "#9b2034" },
    { id: "hotfix", label: "Hotfix", background: "#ffeede", border: "#ffd3b0", text: "#9b4d00" },
    { id: "chore", label: "Chore", background: "#f2f5f8", border: "#dae1e9", text: "#4a5f75" },
    { id: "research", label: "Research", background: "#eef0ff", border: "#d7dcff", text: "#384c9a" }
  ],
  fieldDefinitions: [
    { id: "storyPoints", label: "Story Points", type: "number" },
    { id: "severity", label: "Severidade", type: "select", options: ["Critical", "High", "Medium", "Low"] },
    {
      id: "planningStatus",
      label: "Status Planejamento",
      type: "select",
      options: ["plan-ideas", "plan-committed", "plan-building", "plan-ready"]
    },
    {
      id: "qaStatus",
      label: "Status QA",
      type: "select",
      options: ["qa-ready", "qa-testing", "qa-approved", "qa-rejected"]
    },
    {
      id: "managerLane",
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
    visibleFieldIds: ["storyPoints", "severity", "sprint", "environment"]
  }
};

export function buildTaskTypeMetaMap(taskTypes: TaskTypeMetaItem[]): Record<string, TaskTypeMetaItem> {
  return taskTypes.reduce<Record<string, TaskTypeMetaItem>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}
