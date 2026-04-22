import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import { buildTaskCardRenderModel } from "@/entities/task/model/task-card-render-model";
import type { BoardConfig, Task, TaskFieldDefinition } from "@/entities/task/model/types";
import { TaskCard } from "@/entities/task/ui/task-card";

const titleField: TaskFieldDefinition = {
  id: "sys:title",
  definitionId: "field-title",
  label: "Titulo",
  type: "text",
  storage: { kind: "item_property", property: "title" },
  config: { cardArea: "title", detailSection: "main" }
};

const assigneeField: TaskFieldDefinition = {
  id: "sys:assignee",
  definitionId: "field-assignee",
  label: "Responsavel",
  type: "user",
  storage: { kind: "item_property", property: "assigneeId" },
  config: { cardArea: "summary", detailSection: "side" }
};

const createdByField: TaskFieldDefinition = {
  id: "sys:created-by",
  definitionId: "field-created-by",
  label: "Criado por",
  type: "user",
  storage: { kind: "item_property", property: "createdBy" },
  config: { cardArea: "summary", detailSection: "side" }
};

const statusField: TaskFieldDefinition = {
  id: "sys:status",
  definitionId: "field-status",
  label: "Status",
  type: "status",
  storage: { kind: "item_property", property: "stateSlug" },
  config: { cardArea: "badge", detailSection: "side" }
};

const boardConfig: BoardConfig = {
  ...factoryBoardConfig,
  fieldDefinitions: [titleField, assigneeField],
  fieldBindings: [
    {
      id: "binding-title",
      fieldId: "sys:title",
      typeId: "bug",
      displayContext: "card",
      order: 0,
      isVisible: true,
      settings: { cardArea: "title", visualPriority: "primary" }
    },
    {
      id: "binding-assignee",
      fieldId: "sys:assignee",
      typeId: "bug",
      displayContext: "card",
      order: 1,
      isVisible: true,
      settings: { cardArea: "summary", visualPriority: "secondary" }
    }
  ],
  cardLayout: {
    visibleFieldIds: []
  }
};

const projectedStatusBoardConfig: BoardConfig = {
  ...factoryBoardConfig,
  statuses: [{ id: "backlog", label: "Backlog", dot: "#94a3b8" }],
  fieldDefinitions: [titleField, statusField],
  fieldBindings: [
    {
      id: "binding-status",
      fieldId: "sys:status",
      typeId: "bug",
      displayContext: "card",
      order: 0,
      isVisible: true,
      settings: { cardArea: "badge", visualPriority: "secondary" }
    },
    {
      id: "binding-title-projected",
      fieldId: "sys:title",
      typeId: "bug",
      displayContext: "card",
      order: 1,
      isVisible: true,
      settings: { cardArea: "title", visualPriority: "primary" }
    }
  ],
  cardLayout: {
    visibleFieldIds: []
  }
};

const createdByBoardConfig: BoardConfig = {
  ...factoryBoardConfig,
  fieldDefinitions: [titleField, createdByField],
  fieldBindings: [
    {
      id: "binding-title-created-by",
      fieldId: "sys:title",
      typeId: "bug",
      displayContext: "card",
      order: 0,
      isVisible: true,
      settings: { cardArea: "title", visualPriority: "primary" }
    },
    {
      id: "binding-created-by",
      fieldId: "sys:created-by",
      typeId: "bug",
      displayContext: "card",
      order: 1,
      isVisible: true,
      settings: { cardArea: "summary", visualPriority: "secondary" }
    }
  ],
  cardLayout: {
    visibleFieldIds: []
  }
};

const task: Task = {
  id: "task-1",
  title: "Ajustar preview do kanban",
  text: "",
  createdById: "user-2",
  type: "bug",
  status: "backlog",
  priority: 2,
  tags: [],
  assignee: "user-1",
  checklist: { items: [] },
  due: "",
  plannedStartAt: null,
  plannedEndAt: null,
  linkedDocuments: [],
  customFields: {}
};

describe("TaskCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza campos user no slot configurado pelo binding sem bloco fixo legado", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <TaskCard
        task={task}
        boardConfig={boardConfig}
        membersById={{
          "user-1": {
            id: "user-1",
            name: "Ana Souza",
            initials: "AS",
            color: "#7b9abc"
          }
        }}
        draggable={false}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
      />
    );

    expect(html).toContain("task-card__summary");
    expect(html).toContain("Responsavel");
    expect(html).toContain("Ana Souza");
    expect(html).not.toContain("task-card__owner");
  });

  it("instrumenta o proprio elemento estrutural do slot sem embrulhar o campo em markup paralelo", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <TaskCard
        task={task}
        boardConfig={boardConfig}
        membersById={{
          "user-1": {
            id: "user-1",
            name: "Ana Souza",
            initials: "AS",
            color: "#7b9abc"
          }
        }}
        draggable={false}
        getFieldSlotProps={({ fieldId }) =>
          fieldId === "sys:assignee"
            ? {
                className: "preview-slot-marker",
                draggable: true,
                "data-preview-field": fieldId
              }
            : {}
        }
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
      />
    );

    expect(html).toContain('class="task-card__summary-item preview-slot-marker"');
    expect(html).toContain('data-preview-field="sys:assignee"');
    expect(html).not.toContain("workitem-editor-v2__card-preview-slot");
  });

  it("renderiza placeholders de vagas dentro do proprio slot quando o editor pede a capacidade restante", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <TaskCard
        task={task}
        boardConfig={boardConfig}
        membersById={{
          "user-1": {
            id: "user-1",
            name: "Ana Souza",
            initials: "AS",
            color: "#7b9abc"
          }
        }}
        draggable={false}
        renderEmptySlot={({ area, occupiedCount, slotLimit }) => (
          <span className={`slot-placeholder slot-placeholder--${area}`}>{`${occupiedCount}/${slotLimit}`}</span>
        )}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
      />
    );

    expect(html).toContain("slot-placeholder--summary");
    expect(html).toContain(">1/2<");
    expect(html).not.toContain("slot-placeholder--title");
  });

  it("usa os statuses efetivos do board runtime ao renderizar o campo de status no card", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const projectedTask = { ...task, status: "column-backlog" };

    const html = renderToStaticMarkup(
      <TaskCard
        task={projectedTask}
        boardConfig={projectedStatusBoardConfig}
        displayStatuses={[{ id: "column-backlog", label: "Backlog", dot: "#94a3b8" }]}
        draggable={false}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
      />
    );
    const { debugSnapshot } = buildTaskCardRenderModel({
      task: projectedTask,
      boardConfig: projectedStatusBoardConfig,
      statuses: [{ id: "column-backlog", label: "Backlog", dot: "#94a3b8" }]
    });

    expect(html).toContain("Backlog");
    expect(html).not.toContain("column-backlog");
    expect(debugSnapshot.task.status).toBe("column-backlog");
    expect(debugSnapshot.fields.find((field) => field.fieldId === "sys:status")?.displayValue).toBe("Backlog");
    expect(debugSnapshot.renderedFieldIds).toEqual(["sys:status", "sys:title"]);
  });

  it("resume o campo criado por no card quando o nome do usuario e longo", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <TaskCard
        task={task}
        boardConfig={createdByBoardConfig}
        membersById={{
          "user-2": {
            id: "user-2",
            name: "Debora Romitti de Oliveira",
            initials: "DO",
            color: "#7b9abc"
          }
        }}
        draggable={false}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
      />
    );

    expect(html).toContain("Criado por");
    expect(html).toContain("Debora O.");
    expect(html).not.toContain("Debora Romitti de Oliveira</span>");
  });
});
