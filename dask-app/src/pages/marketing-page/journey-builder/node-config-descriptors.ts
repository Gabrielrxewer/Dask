import {
  commonConditionLogicOptions,
  commonConditionOperatorOptions,
  createBaseNodeConfigDescriptor,
  createDelayNodeConfigDescriptor,
  createTriggerNodeConfigDescriptor,
  type NodeConfigDescriptor,
  type NodeConfigFieldDescriptor,
  type NodeConfigFieldOption
} from "@/shared/flow-node-config";
import type { ActionConfig, JourneyNodeConfig, JourneyNodeKind } from "./types";
import { ACTION_TYPE_LABELS, TRIGGER_EVENT_LABELS } from "./types";

export const marketingConditionOperatorOptions = commonConditionOperatorOptions;

function labelOptions(labels: Record<string, string>): NodeConfigFieldOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

function actionFields(config: JourneyNodeConfig): NodeConfigFieldDescriptor[] {
  const action = config as ActionConfig;
  const fields: NodeConfigFieldDescriptor[] = [
    {
      name: "type",
      label: "Tipo de acao",
      type: "select",
      required: true,
      options: labelOptions(ACTION_TYPE_LABELS)
    }
  ];

  if (action.type === "send_campaign") {
    fields.push({ name: "campaignId", label: "Campanha", type: "text" });
  }
  if (action.type === "update_score") {
    fields.push({ name: "scoreChange", label: "Variacao do score", type: "number" });
  }
  if (action.type === "move_lead") {
    fields.push({ name: "targetStatus", label: "Status de destino", type: "text" });
  }
  if (action.type === "create_task") {
    fields.push({ name: "taskTitle", label: "Titulo da tarefa", type: "text" });
  }
  if (action.type === "notify_user") {
    fields.push({ name: "notifyUserId", label: "Usuario", type: "text" });
  }
  if (action.type === "start_flow") {
    fields.push({ name: "targetFlowId", label: "Fluxo de destino", type: "text" });
  }
  if (action.type === "tag_lead") {
    fields.push({ name: "tag", label: "Tag", type: "text" });
  }
  if (action.type === "webhook") {
    fields.push({ name: "webhookUrl", label: "URL do webhook", type: "text", placeholder: "https://..." });
  }

  return fields;
}

export function createMarketingJourneyNodeConfigDescriptor(
  kind: JourneyNodeKind,
  config: JourneyNodeConfig
): NodeConfigDescriptor {
  if (kind === "TRIGGER") {
    return createTriggerNodeConfigDescriptor({
      type: "TRIGGER",
      label: "Gatilho",
      eventFieldName: "event",
      eventLabel: "Evento gatilho",
      triggerOptions: labelOptions(TRIGGER_EVENT_LABELS),
      extraFields: [
        { name: "segmentId", label: "Segmento", type: "text" }
      ]
    });
  }

  if (kind === "ACTION") {
    return createBaseNodeConfigDescriptor({ type: "ACTION", label: "Acao" }, actionFields(config));
  }

  if (kind === "CONDITION") {
    return createBaseNodeConfigDescriptor({ type: "CONDITION", label: "Condicao" }, [
      {
        name: "logic",
        label: "Logica",
        type: "select",
        required: true,
        options: commonConditionLogicOptions
      },
      {
        name: "rules",
        label: "Regras",
        type: "json",
        component: "marketing-condition-rules",
        required: true
      },
      { name: "yesLabel", label: "Rotulo do caminho SIM", type: "text" },
      { name: "noLabel", label: "Rotulo do caminho NAO", type: "text" }
    ]);
  }

  if (kind === "DELAY") {
    return createDelayNodeConfigDescriptor({
      type: "DELAY",
      label: "Espera",
      amountFieldName: "duration",
      amountLabel: "Duracao",
      unitFieldName: "unit"
    });
  }

  return createBaseNodeConfigDescriptor({ type: "EXIT", label: "Saida" }, [
    { name: "reason", label: "Motivo", type: "text", placeholder: "Ex: Lead convertido" }
  ]);
}
