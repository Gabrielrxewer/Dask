import { describe, expect, it } from "vitest";
import {
  buildTaskInputFromFieldDrafts,
  formatTaskFieldValue,
  resolveTaskFieldOptions,
  resolveTaskFieldValue
} from "@/entities/task/model/field-registry";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import type { Task, TaskFieldDefinition } from "@/entities/task/model/types";

const baseTask: Task = {
  id: "task-1",
  title: "Organizar rollout do portal",
  text: "Fechar checklist e alinhar responsaveis.",
  createdById: "user-1",
  type: "task",
  status: "in-progress",
  priority: 1,
  tags: ["ux", "ops"],
  assignee: "user-2",
  checklist: {
    items: [
      { id: "chk-1", label: "Revisar copy", done: true },
      { id: "chk-2", label: "Atualizar docs", done: false }
    ]
  },
  due: "2026-05-03",
  plannedStartAt: "2026-05-01T10:00:00.000Z",
  plannedEndAt: "2026-05-01T12:00:00.000Z",
  customFields: {
    impact_level: "high"
  }
};

const titleField: TaskFieldDefinition = {
  id: "sys:title",
  definitionId: "field-title",
  label: "Titulo",
  slug: "sys:title",
  type: "text",
  storage: { kind: "item_property", property: "title" }
};

const statusField: TaskFieldDefinition = {
  id: "sys:status",
  definitionId: "field-status",
  label: "Status",
  slug: "sys:status",
  type: "status",
  storage: { kind: "item_property", property: "stateSlug" }
};

const tagsField: TaskFieldDefinition = {
  id: "sys:tags",
  definitionId: "field-tags",
  label: "Tags",
  slug: "sys:tags",
  type: "tag",
  storage: { kind: "item_relation", property: "tags" }
};

const scheduleField: TaskFieldDefinition = {
  id: "sys:schedule",
  definitionId: "field-schedule",
  label: "Planejamento",
  slug: "sys:schedule",
  type: "schedule",
  storage: { kind: "legacy_fields", property: "schedule" }
};

const checklistField: TaskFieldDefinition = {
  id: "sys:checklist",
  definitionId: "field-checklist",
  label: "Checklist",
  slug: "sys:checklist",
  type: "checklist",
  storage: { kind: "item_property", property: "checklist" }
};

const customSelectField: TaskFieldDefinition = {
  id: "impact-level",
  definitionId: "field-impact-level",
  label: "Impacto",
  slug: "impact_level",
  type: "select",
  options: [
    { id: "impact-high", label: "Alto", value: "high", isActive: true },
    { id: "impact-medium", label: "Medio", value: "medium", isActive: true }
  ]
};

describe("field-registry", () => {
  it("resolve valores estruturais pelo storage e valores customizados pelo slug", () => {
    expect(resolveTaskFieldValue(baseTask, titleField)).toBe(baseTask.title);
    expect(resolveTaskFieldValue(baseTask, statusField)).toBe(baseTask.status);
    expect(resolveTaskFieldValue(baseTask, tagsField)).toEqual(baseTask.tags);
    expect(resolveTaskFieldValue(baseTask, customSelectField)).toBe("high");
  });

  it("resolve valores customizados por definitionId quando o runtime id mudou", () => {
    expect(resolveTaskFieldValue({
      ...baseTask,
      customFields: {},
      customFieldValuesById: {
        "field-impact-level": "medium"
      }
    }, customSelectField)).toBe("medium");
  });

  it("monta payloads dirigidos por tipo e storage", () => {
    const payload = buildTaskInputFromFieldDrafts(
      [titleField, statusField, tagsField, scheduleField, checklistField, customSelectField],
      {
        "sys:title": "Rollout confirmado",
        "sys:status": "done",
        "sys:tags": ["ux", "growth"],
        "sys:schedule": {
          plannedStartAt: "2026-05-05T09:00",
          plannedEndAt: "2026-05-05T11:00"
        },
        "sys:checklist": {
          items: [
            { id: "chk-3", label: "Criar task no card", done: true },
            { id: "chk-4", label: "Persistir no banco", done: false }
          ]
        },
        "impact-level": "medium"
      }
    );

    expect(payload.title).toBe("Rollout confirmado");
    expect(payload.stateId).toBe("done");
    expect(payload.tags).toEqual(["ux", "growth"]);
    expect(payload.fields).toEqual({
      plannedStartAt: "2026-05-05T09:00",
      plannedEndAt: "2026-05-05T11:00"
    });
    expect(payload.checklist).toEqual({
      items: [
        { id: "chk-3", label: "Criar task no card", done: true },
        { id: "chk-4", label: "Persistir no banco", done: false }
      ]
    });
    expect(payload.customFieldValues).toEqual({
      "field-impact-level": "medium"
    });
  });

  it("resolve opcoes e formatacao sem hardcode por field id", () => {
    const statusOptions = resolveTaskFieldOptions({
      field: statusField,
      boardConfig: factoryBoardConfig,
      statuses: factoryBoardConfig.statuses
    });

    expect(statusOptions.map(option => option.value)).toContain("in-progress");
    expect(
      formatTaskFieldValue({
        field: customSelectField,
        value: "high",
        boardConfig: factoryBoardConfig,
        statuses: factoryBoardConfig.statuses
      })
    ).toBe("Alto");
  });
});
