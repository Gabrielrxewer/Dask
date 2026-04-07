import type { MemberId } from "@/entities/member";
import { factoryBoardConfig } from "@/entities/task";
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

function createChecklist(taskId: string, total: number): Task["checklist"] {
  return {
    items: Array.from({ length: total }).map((_, index) => ({
      id: `${taskId}-check-${index + 1}`,
      label: `Subtarefa ${index + 1}`,
      done: false
    }))
  };
}

export function createMockTask(seed: number): Task {
  const index = seed % mockTitlePool.length;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (index + 2) * 2);

  const availableTypes = factoryBoardConfig.taskTypes;
  const backlogStatus = factoryBoardConfig.statuses[0]?.id ?? "backlog";
  const taskId = `t-new-${Date.now()}-${seed}`;
  const taskType = availableTypes[seed % availableTypes.length]?.id ?? "bug";
  const managerLane =
    taskType === "epic"
      ? "mgr-epics"
      : ["user-story", "improvement", "research", "spike"].includes(taskType)
        ? "mgr-initiatives"
        : ["bug", "incident", "hotfix"].includes(taskType)
          ? "mgr-risks"
          : "mgr-delivery";

  return {
    id: taskId,
    title: mockTitlePool[index],
    text: "Card gerado para prototipacao do board com mock realista.",
    type: taskType,
    status: backlogStatus,
    priority: priorities[index % priorities.length],
    tags: tagsPool[index % tagsPool.length],
    assignee: assignees[index % assignees.length],
    checklist: createChecklist(taskId, 4 + index),
    due: dueDate.toISOString().slice(0, 10),
    customFields: {
      storyPoints: 1 + (seed % 13),
      severity: ["Low", "Medium", "High", "Critical"][seed % 4],
      planningStatus: ["plan-ideas", "plan-committed", "plan-building", "plan-ready"][seed % 4],
      qaStatus: ["qa-ready", "qa-testing", "qa-approved", "qa-rejected"][seed % 4],
      managerLane,
      sprint: `Sprint ${18 + (seed % 3)}`,
      environment: ["Development", "Staging", "Production"][seed % 3],
      qaReady: seed % 2 === 0
    }
  };
}
