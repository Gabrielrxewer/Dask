import { describe, expect, it } from "vitest";
import type { FieldLibraryItem } from "./work-item-editor-field-model";
import {
  buildFieldSettings,
  DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS,
  normalizeOptionInputs,
  readChecklistDisplaySettings
} from "./work-item-editor-field-model";
import { resolvePendingFieldTargetLabel } from "./work-item-editor-layout-model";
import { buildPendingFieldPreview } from "./work-item-editor-preview-model";

const fieldsById: Record<string, FieldLibraryItem> = {
  summary: {
    id: "summary",
    label: "Resumo",
    type: "text",
    optionsCount: 0,
    required: false,
    allowAiGeneration: false,
    hasApiDefinition: true
  },
  due: {
    id: "due",
    label: "Prazo",
    type: "date",
    optionsCount: 0,
    required: false,
    allowAiGeneration: false,
    hasApiDefinition: true
  }
};

describe("work item editor field helpers", () => {
  it("normaliza opcoes ignorando vazias e evitando valores duplicados", () => {
    expect(
      normalizeOptionInputs([
        { id: "1", label: "Alta prioridade", value: "" },
        { id: "2", label: "Alta prioridade", value: "alta prioridade" },
        { id: "3", label: "  ", value: "ignored" },
        { id: "4", label: "QA/Validacao", value: "" }
      ])
    ).toEqual([
      { label: "Alta prioridade", value: "alta_prioridade" },
      { label: "Alta prioridade", value: "alta_prioridade_2" },
      { label: "QA/Validacao", value: "qa_validacao" }
    ]);
  });

  it("monta settings apenas para capacidades suportadas pelo tipo", () => {
    expect(
      buildFieldSettings({
        type: "catalog_select",
        name: "Produto",
        allowAiGeneration: true,
        checklistIcon: "checklist",
        checklistColor: "#123456"
      })
    ).toEqual({
      allowAiGeneration: false,
      entityType: "billing_catalog_item"
    });

    expect(
      buildFieldSettings({
        type: "checklist",
        name: "Checklist de aceite",
        allowAiGeneration: true,
        checklistIcon: "shield-check",
        checklistColor: "#123456"
      })
    ).toEqual({
      allowAiGeneration: false,
      checklistDisplay: {
        icon: "shield-check",
        color: "#123456",
        label: "Checklist de aceite"
      }
    });
  });

  it("monta metadata publica para billing_summary configuravel", () => {
    expect(
      buildFieldSettings({
        type: "billing_summary",
        name: "Resumo financeiro",
        allowAiGeneration: true,
        checklistIcon: "checklist",
        checklistColor: "#123456",
        billingCurrency: "USD",
        billingSourceFields: "setup_fee, monthly_fee",
        billingAggregationMode: "sum",
        billingDisplayFormat: "currency",
        billingReadOnly: true
      })
    ).toEqual({
      allowAiGeneration: false,
      publicType: "billing_summary",
      displayAs: "billing_summary",
      billingSummary: {
        currency: "USD",
        sourceFields: ["setup_fee", "monthly_fee"],
        aggregationMode: "sum",
        displayFormat: "currency",
        readOnly: true
      }
    });
  });

  it("le configuracao visual de checklist com fallback seguro", () => {
    expect(readChecklistDisplaySettings({ checklistDisplay: { icon: "bug", color: "#FFAA00" } })).toEqual({
      icon: "bug",
      color: "#FFAA00"
    });
    expect(readChecklistDisplaySettings({ checklistDisplay: { icon: "", color: "var(--brand-blue)" } })).toEqual({
      icon: "checklist",
      color: "var(--brand-blue)"
    });
  });
});

describe("work item editor layout and preview helpers", () => {
  it("descreve o alvo pendente usando o campo substituido quando existir", () => {
    expect(
      resolvePendingFieldTargetLabel(
        {
          type: "text",
          targetScope: "card",
          targetIndex: 0,
          dropTarget: { surface: "card", kind: "replace-field", targetFieldId: "summary", area: "summary" },
          addToLayout: true,
          name: "",
          required: false,
          allowAiGeneration: false,
          options: [],
          checklistIcon: "checklist",
          checklistColor: "var(--text-secondary)",
          ...DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS
        },
        fieldsById
      )
    ).toContain("Resumo");
  });

  it("gera preview de campo pendente com opcoes normalizadas e display de checklist", () => {
    const preview = buildPendingFieldPreview({
      type: "checklist",
      targetScope: "detail",
      targetIndex: 0,
      targetDetailZone: "main",
      addToLayout: true,
      name: "Aceite",
      required: true,
      allowAiGeneration: false,
      options: [{ id: "1", label: "Feito", value: "" }],
      checklistIcon: "shield-check",
      checklistColor: "#123456",
      ...DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS
    });

    expect(preview).toMatchObject({
      id: "pending-field-preview",
      label: "Aceite",
      type: "checklist",
      required: true,
      config: {
        checklistDisplay: {
          icon: "shield-check",
          color: "#123456",
          label: "Aceite"
        }
      },
      options: [{ id: "pending-preview-option-1", label: "Feito", value: "feito" }]
    });
  });
});
