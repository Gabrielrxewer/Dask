import type { Task } from "@/entities/task/model/types";

export const initialTasks: Task[] = [
  {
    id: "t-101",
    title: "Estruturar playbook de aquisicao Q2",
    text: "Centralizar hipoteses de canal, CAC meta e experimento semanal.",
    status: "backlog",
    priority: "high",
    tags: ["Growth", "Planning"],
    assignee: "u1",
    checklist: { done: 1, total: 6 },
    due: "2026-04-10"
  },
  {
    id: "t-102",
    title: "Criar tracking de trial no app web",
    text: "Eventos de ativacao, conversao e retencao por coorte.",
    status: "doing",
    priority: "high",
    tags: ["Analytics", "SDK"],
    assignee: "u2",
    checklist: { done: 3, total: 5 },
    due: "2026-04-06"
  },
  {
    id: "t-103",
    title: "Design system para cards de receita",
    text: "Padronizar variacoes de status com tokens visuais novos.",
    status: "review",
    priority: "medium",
    tags: ["UI", "Design System"],
    assignee: "u4",
    checklist: { done: 7, total: 8 },
    due: "2026-04-07"
  },
  {
    id: "t-104",
    title: "Automatizar resumo diario de bugs criticos",
    text: "Enviar digest para Slack com prioridade e squad responsavel.",
    status: "done",
    priority: "low",
    tags: ["Automation", "Ops"],
    assignee: "u1",
    checklist: { done: 4, total: 4 },
    due: "2026-04-01"
  },
  {
    id: "t-105",
    title: "Novo fluxo de aprovacao de conteudo",
    text: "Ajustar estados de review para dar visibilidade de bloqueios.",
    status: "doing",
    priority: "medium",
    tags: ["Workflow", "Content"],
    assignee: "u3",
    checklist: { done: 2, total: 6 },
    due: "2026-04-11"
  },
  {
    id: "t-106",
    title: "Setup de funil para campanha enterprise",
    text: "Definir estagios MQL > SQL com sinalizacao de owner.",
    status: "backlog",
    priority: "low",
    tags: ["CRM", "B2B"],
    assignee: "u2",
    checklist: { done: 0, total: 5 },
    due: "2026-04-14"
  },
  {
    id: "t-107",
    title: "A/B test do cabecalho da home",
    text: "Comparar mensagem orientada a valor vs velocidade de setup.",
    status: "review",
    priority: "medium",
    tags: ["Experiment", "Web"],
    assignee: "u1",
    checklist: { done: 5, total: 7 },
    due: "2026-04-09"
  },
  {
    id: "t-108",
    title: "Migracao de tarefas legadas",
    text: "Consolidar boards antigos em um fluxo por squad.",
    status: "done",
    priority: "low",
    tags: ["Migration", "Process"],
    assignee: "u4",
    checklist: { done: 9, total: 9 },
    due: "2026-03-31"
  }
];
