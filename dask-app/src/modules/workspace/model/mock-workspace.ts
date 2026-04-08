import { currentUserId, membersById } from "@/entities/member";
import { factoryBoardConfig, initialTasks, type Task } from "@/entities/task";
import type { CreateTaskInput, WorkspaceSnapshot } from "@/modules/workspace/model/types";

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

export function createTaskFromInput(input: CreateTaskInput, assignee: Task["assignee"]): Task {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const taskId = `t-ws-${Date.now()}`;
  const taskType = input.type.trim().toLowerCase() || "task";
  const normalizedTitle = input.title.trim() || "Nova tarefa";
  const normalizedDescription = input.description.trim() || "Descreva o objetivo desta tarefa.";

  return {
    id: taskId,
    title: normalizedTitle,
    text: normalizedDescription,
    type: taskType,
    status: "backlog",
    priority: input.priority ?? 2,
    tags: ["Novo item"],
    assignee,
    checklist: createChecklist(taskId, 3),
    due: dueDate.toISOString().slice(0, 10),
    customFields: {
      severity: "Medium",
      sprint: "Planejamento",
      environment: "Development",
      qaReady: false
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
