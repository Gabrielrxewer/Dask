import type { Task } from "@/entities/task/model/types";

function makeChecklist(taskId: string, total: number, done: number): Task["checklist"] {
  return {
    items: Array.from({ length: total }).map((_, index) => ({
      id: `${taskId}-check-${index + 1}`,
      label: `Subtarefa ${index + 1}`,
      done: index < done
    }))
  };
}

export const initialTasks: Task[] = [
  {
    id: "t-101",
    title: "Estruturar playbook de aquisicao Q2",
    text: "Centralizar hipoteses de canal, CAC meta e experimento semanal.",
    type: "epic",
    status: "backlog",
    priority: "high",
    tags: ["Growth", "Planning"],
    assignee: "u1",
    checklist: makeChecklist("t-101", 6, 1),
    due: "2026-04-10",
    customFields: {
      storyPoints: 13,
      severity: "High",
      sprint: "Sprint 17",
      environment: "Development",
      squad: "Growth"
    }
  },
  {
    id: "t-102",
    title: "Criar tracking de trial no app web",
    text: "Eventos de ativacao, conversao e retencao por coorte.",
    type: "user-story",
    status: "doing",
    priority: "high",
    tags: ["Analytics", "SDK"],
    assignee: "u2",
    checklist: makeChecklist("t-102", 5, 3),
    due: "2026-04-06",
    customFields: {
      storyPoints: 8,
      severity: "Medium",
      sprint: "Sprint 17",
      component: "Tracking",
      qaReady: false,
      squad: "Platform"
    }
  },
  {
    id: "t-103",
    title: "Design system para cards de receita",
    text: "Padronizar variacoes de status com tokens visuais novos.",
    type: "improvement",
    status: "review",
    priority: "medium",
    tags: ["UI", "Design System"],
    assignee: "u4",
    checklist: makeChecklist("t-103", 8, 7),
    due: "2026-04-07",
    customFields: {
      storyPoints: 5,
      severity: "Low",
      sprint: "Sprint 17",
      component: "Design System",
      qaReady: true,
      release: "v2.4"
    }
  },
  {
    id: "t-104",
    title: "Automatizar resumo diario de bugs criticos",
    text: "Enviar digest para Slack com prioridade e squad responsavel.",
    type: "incident",
    status: "done",
    priority: "low",
    tags: ["Automation", "Ops"],
    assignee: "u1",
    checklist: makeChecklist("t-104", 4, 4),
    due: "2026-04-01",
    customFields: {
      storyPoints: 3,
      severity: "Low",
      sprint: "Sprint 16",
      environment: "Production",
      qaReady: true
    }
  },
  {
    id: "t-105",
    title: "Novo fluxo de aprovacao de conteudo",
    text: "Ajustar estados de review para dar visibilidade de bloqueios.",
    type: "bug",
    status: "doing",
    priority: "medium",
    tags: ["Workflow", "Content"],
    assignee: "u3",
    checklist: makeChecklist("t-105", 6, 2),
    due: "2026-04-11",
    customFields: {
      storyPoints: 8,
      severity: "Critical",
      sprint: "Sprint 18",
      environment: "Production",
      customerImpact: "Alto"
    }
  },
  {
    id: "t-106",
    title: "Setup de funil para campanha enterprise",
    text: "Definir estagios MQL > SQL com sinalizacao de owner.",
    type: "research",
    status: "backlog",
    priority: "low",
    tags: ["CRM", "B2B"],
    assignee: "u2",
    checklist: makeChecklist("t-106", 5, 0),
    due: "2026-04-14",
    customFields: {
      storyPoints: 5,
      severity: "Low",
      sprint: "Sprint 18",
      component: "CRM",
      squad: "Revenue"
    }
  },
  {
    id: "t-107",
    title: "A/B test do cabecalho da home",
    text: "Comparar mensagem orientada a valor vs velocidade de setup.",
    type: "spike",
    status: "review",
    priority: "medium",
    tags: ["Experiment", "Web"],
    assignee: "u1",
    checklist: makeChecklist("t-107", 7, 5),
    due: "2026-04-09",
    customFields: {
      storyPoints: 8,
      severity: "Medium",
      sprint: "Sprint 17",
      component: "Web App",
      release: "v2.5"
    }
  },
  {
    id: "t-108",
    title: "Migracao de tarefas legadas",
    text: "Consolidar boards antigos em um fluxo por squad.",
    type: "chore",
    status: "done",
    priority: "low",
    tags: ["Migration", "Process"],
    assignee: "u4",
    checklist: makeChecklist("t-108", 9, 9),
    due: "2026-03-31",
    customFields: {
      storyPoints: 3,
      severity: "Low",
      sprint: "Sprint 16",
      qaReady: true,
      squad: "Operations"
    }
  }
];
