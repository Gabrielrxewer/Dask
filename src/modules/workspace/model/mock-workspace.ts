import { currentUserId, membersById } from "@/entities/member";
import { factoryBoardConfig, initialTasks, type Task, type TaskPriority } from "@/entities/task";
import type { WorkspaceSnapshot } from "@/modules/workspace/model/types";

const mockTitlePool: string[] = [
  "Mapear fluxo de backlog para squad de platform",
  "Reforcar criterio de aceite no board de QA",
  "Criar widget de risco por sprint",
  "Aprimorar notificacoes de automacao",
  "Normalizar campos de card para integracao futura"
];

const tagsPool: string[][] = [
  ["Product", "Roadmap"],
  ["Engineering", "Workflow"],
  ["Analytics", "Delivery"],
  ["Automation", "Ops"]
];

const priorities: TaskPriority[] = ["low", "medium", "high"];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createChecklist(taskId: string, total: number): Task["checklist"] {
  return {
    items: Array.from({ length: total }).map((_, index) => ({
      id: `${taskId}-check-${index + 1}`,
      label: `Subtarefa ${index + 1}`,
      done: false
    }))
  };
}

export function createTaskFromSeed(seed: number): Task {
  const index = seed % mockTitlePool.length;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3 + index * 2);

  const taskId = `t-ws-${Date.now()}-${seed}`;
  const taskType = factoryBoardConfig.taskTypes[index % factoryBoardConfig.taskTypes.length];

  return {
    id: taskId,
    title: mockTitlePool[index],
    text: "Card criado para evolucao incremental do workspace.",
    type: taskType?.id ?? "user-story",
    status: "backlog",
    priority: priorities[index % priorities.length],
    tags: tagsPool[index % tagsPool.length],
    assignee: (Object.keys(membersById)[index % Object.keys(membersById).length] as Task["assignee"]) ?? "u1",
    checklist: createChecklist(taskId, 4 + index),
    due: dueDate.toISOString().slice(0, 10),
    customFields: {
      storyPoints: 3 + index,
      severity: ["Low", "Medium", "High", "Critical"][index % 4],
      sprint: `Sprint ${18 + (index % 3)}`,
      environment: ["Development", "Staging", "Production"][index % 3],
      qaReady: index % 2 === 0
    }
  };
}

export function createInitialWorkspaceSnapshot(): WorkspaceSnapshot {
  const boardConfig = deepClone(factoryBoardConfig);

  return {
    id: "ws-default",
    name: "Dask Workspace",
    currentUserId,
    membersById: deepClone(membersById),
    tasks: deepClone(initialTasks),
    boardConfig,
    automations: [
      {
        id: "a-1",
        title: "Aprimorar descricoes com IA",
        status: "active",
        trigger: "Ao mover para Review",
        action: "Sugere descricao mais clara e criterios de aceite"
      },
      {
        id: "a-2",
        title: "Resumo diario para gerente",
        status: "active",
        trigger: "Todo dia 18:00",
        action: "Publica panorama de epicos, riscos e progresso"
      },
      {
        id: "a-3",
        title: "Fluxo QA assistido",
        status: "paused",
        trigger: "Ao entrar em Liberado para teste",
        action: "Abre checklist de regressao e cria tarefa de validacao"
      }
    ],
    preferences: {
      defaultBoardMode: "dev",
      dateFormat: "dd/mm/yyyy",
      visibleCardFieldIds: [...boardConfig.cardLayout.visibleFieldIds]
    }
  };
}

export function cloneWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return deepClone(snapshot);
}
