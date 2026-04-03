import type { MemberId } from "@/entities/member";
import type { Task, TaskPriority } from "@/entities/task";

const mockTitlePool: string[] = [
  "Criar dashboard de engajamento por segmento",
  "Refatorar fluxo de onboarding mobile",
  "Ajustar automacao de disparo em horario local",
  "Montar variacao de landing para campanha beta",
  "Revisar copy de upsell no checkout"
];

const tagsPool: string[][] = [
  ["Product", "Roadmap"],
  ["Marketing", "Campaign"],
  ["Engineering", "Backend"],
  ["Sales", "Pipeline"]
];

const priorities: TaskPriority[] = ["low", "medium", "high"];
const assignees: MemberId[] = ["u1", "u2", "u3", "u4"];

export function createMockTask(seed: number): Task {
  const index = seed % mockTitlePool.length;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (index + 2) * 2);

  return {
    id: `t-new-${Date.now()}-${seed}`,
    title: mockTitlePool[index],
    text: "Card gerado para prototipacao do board com mock realista.",
    status: "backlog",
    priority: priorities[index % priorities.length],
    tags: tagsPool[index % tagsPool.length],
    assignee: assignees[index % assignees.length],
    checklist: { done: 0, total: 4 + index },
    due: dueDate.toISOString().slice(0, 10)
  };
}
