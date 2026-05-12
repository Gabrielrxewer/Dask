import type { NodeProps } from "@xyflow/react";
import { AppIcon, FlowNodeCard } from "@/shared/ui";
import {
  createCommunicationNodeConfigDescriptor,
  createConditionExpressionNodeConfigDescriptor,
  createDelayNodeConfigDescriptor,
  createTriggerNodeConfigDescriptor,
  type NodeConfigDescriptor
} from "@/shared/flow-node-config";
import { listCommercialFieldKeys } from "@/entities/commercial-template";
import { summarizeConfig, toOptionLabel, toOptionValue } from "./automation-page-view-model";
import type { AutomationCanvasData, AutomationNodeMetaMap, FieldOption } from "./automation-page.types";

export const nodeGroupLabels: Record<string, string> = {
  triggers: "Gatilhos",
  conditions: "Condicoes",
  time: "Tempo",
  communication: "Comunicacao",
  ai: "IA",
  approval: "Aprovacao humana",
  card: "Card/Kanban",
  proposals: "Propostas",
  contracts: "Contratos",
  documents: "Documentos",
  finance: "Financeiro",
  customers: "Cliente",
  history: "Historico",
  system: "Fim"
};

export function buildDefaultNodeConfig(type: string): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { triggerType: "manual" };
    case "move_work_item":
      return { itemIdPath: "event.payload.itemId", stateSlug: "" };
    case "update_work_item_fields":
      return { itemIdPath: "event.payload.itemId", customFieldValues: { workItemTemperature: "hot" } };
    case "create_proposal":
      return { itemIdPath: "event.payload.itemId", templateKey: "commercial_proposal", binding: "commercial_proposal", targetFieldSlug: "proposalId", status: "draft", skipIfExists: true };
    case "create_contract":
      return { itemIdPath: "event.payload.linkedEntityId", proposalFieldSlug: "proposalId", templateKey: "commercial_contract", binding: "commercial_contract", targetFieldSlug: "contractId", status: "draft", skipIfExists: true };
    case "send_document":
      return { itemIdPath: "event.payload.itemId", kind: "proposal", documentFieldSlug: "proposalId", emailPath: "fields.contactEmail", resend: false };
    case "update_document_status":
      return { itemIdPath: "event.payload.itemId", kind: "proposal", documentFieldSlug: "proposalId", status: "sent" };
    case "ensure_customer_from_work_item":
      return { itemIdPath: "event.payload.itemId", targetFieldSlug: "customerId", status: "active" };
    case "create_billing_order":
      return {
        itemIdPath: "event.payload.itemId",
        targetFieldSlug: "billingOrderId",
        customerIdFieldSlug: "customerId",
        catalogItemFieldSlug: "interest",
        amountFieldSlug: "estimatedValue",
        amountFieldUnit: "major",
        sendEmail: true,
        skipIfExists: true
      };
    case "create_followup_task":
      return { itemIdPath: "event.payload.itemId", title: "Follow-up: {{item.title}}", description: "Acompanhar retorno comercial e registrar proximo passo.", dueInDays: 1, assigneeIdPath: "event.payload.requestedBy" };
    case "register_card_activity":
      return { itemIdPath: "event.payload.itemId", eventName: "automation.activity", message: "Atividade comercial registrada pela automacao.", severity: "info", visibility: "internal", payload: {} };
    case "communication_send":
      return { channel: "whatsapp", provider: "mock", to: "{{fields.contactPhone}}", body: "" };
    case "delay":
      return { delayFor: { amount: 1, unit: "days" } };
    case "human_approval":
      return { type: "apply_ai_recommendation", title: "Aprovar acao", description: "Revise e aprove a acao antes da continuidade do fluxo.", requestedBy: "{{event.payload.requestedBy}}", expiresInDays: 2 };
    default:
      return {};
  }
}

export function createAutomationNodeComponent(nodeMeta: AutomationNodeMetaMap) {
  return function AutomationNode({ data, selected }: NodeProps) {
    const nodeData = data as AutomationCanvasData;
    const meta = nodeMeta.get(nodeData.nodeType);
    return (
      <FlowNodeCard
        kind={nodeData.nodeType}
        typeLabel={meta?.label ?? nodeData.nodeType}
        label={nodeData.label}
        meta={nodeData.summary}
        icon={<AppIcon name={(meta?.icon ?? "code") as Parameters<typeof AppIcon>[0]["name"]} size={14} />}
        selected={selected}
        target={nodeData.nodeType !== "trigger"}
        source={nodeData.nodeType !== "end"}
        branches={nodeData.nodeType === "condition" ? [
          { id: "true", label: "Sim", tone: "true" },
          { id: "false", label: "Nao", tone: "false" }
        ] : undefined}
      />
    );
  };
}

function optionList(options: FieldOption[]) {
  return options.map((option) => ({ value: toOptionValue(option), label: toOptionLabel(option) })).filter((option) => option.value);
}

function commercialFieldOptions(fields: FieldOption[]) {
  const officialKeys = new Set(listCommercialFieldKeys("workItem"));
  const options = optionList(fields);
  const byValue = new Map(options.map((option) => [option.value, option]));
  for (const key of officialKeys) {
    if (!byValue.has(key)) {
      byValue.set(key, { value: key, label: key });
    }
  }
  return Array.from(byValue.values());
}

export function createAutomationNodeConfigDescriptor(input: {
  nodeType: string;
  nodeLabel?: string;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  configSchema?: {
    required?: string[];
    requiredAny?: string[][];
  };
}): NodeConfigDescriptor {
  const {
    nodeType,
    nodeLabel,
    boardColumns,
    workflowStates,
    customFields,
    itemTypes,
    configSchema
  } = input;
  const fields = commercialFieldOptions(customFields);
  const base: Pick<NodeConfigDescriptor, "type" | "label" | "sections" | "validation"> = {
    type: nodeType,
    label: nodeLabel ?? nodeType,
    sections: [{ id: "main", title: nodeLabel ?? nodeType }],
    validation: {
      required: configSchema?.required,
      requiredAny: configSchema?.requiredAny
    }
  };

  if (nodeType === "trigger") {
    return createTriggerNodeConfigDescriptor({
      ...base,
      eventFieldName: "triggerType",
      triggerOptions: [
          { value: "manual", label: "Manual" },
          { value: "work_item_created", label: "Card criado" },
          { value: "work_item_moved_to_column", label: "Card entrou na coluna" },
          { value: "work_item_state_changed", label: "Card mudou de estado" },
          { value: "work_item_updated", label: "Card atualizado" },
          { value: "work_item_field_updated", label: "Campo do card atualizado" },
          { value: "proposal_created", label: "Proposta criada" },
          { value: "proposal_status_changed", label: "Status da proposta" },
          { value: "contract_created", label: "Contrato criado" },
          { value: "contract_status_changed", label: "Status do contrato" },
          { value: "billing_requested", label: "Cobranca gerada" },
          { value: "billing_payment_confirmed", label: "Pagamento confirmado" },
          { value: "billing_payment_failed", label: "Pagamento falhou" },
          { value: "billing_overdue", label: "Cobranca vencida" },
          { value: "commercial_work_item_created", label: "WorkItem comercial criado" }
      ],
      extraFields: [
        { name: "column", label: "Coluna", type: "select", options: optionList(boardColumns), placeholder: "Qualquer coluna" },
        { name: "stateSlug", label: "Estado", type: "workflow-state-selector", options: optionList(workflowStates), placeholder: "Qualquer estado" },
        { name: "itemTypeSlugs", label: "Tipos de card", type: "multi-select", options: optionList(itemTypes) },
        { name: "status", label: "Status", type: "text" }
      ]
    });
  }

  if (nodeType === "condition") {
    return createConditionExpressionNodeConfigDescriptor({
      ...base,
      expressionFieldName: "expression",
      expressionLabel: "Expressao"
    });
  }

  if (nodeType === "move_work_item") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "columnSlug", label: "Coluna", type: "select", options: optionList(boardColumns), placeholder: "Resolver pela etapa" },
        { name: "stateSlug", label: "Estado", type: "workflow-state-selector", options: optionList(workflowStates), placeholder: "Manter estado" },
        { name: "reason", label: "Motivo", type: "text", placeholder: "Avanco automatico do fluxo comercial" },
        { name: "registerHistory", label: "Registrar historico", type: "boolean", defaultValue: true },
        { name: "preventLoop", label: "Bloquear loop para mesma etapa", type: "boolean", defaultValue: true }
      ]
    };
  }

  if (nodeType === "create_proposal" || nodeType === "create_contract") {
    const isContract = nodeType === "create_contract";
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        ...(isContract ? [{ name: "proposalFieldSlug", label: "Campo da proposta base", type: "template-selector" as const, options: fields }] : []),
        { name: "templateKey", label: "Template", type: "template-selector", required: true },
        { name: "targetFieldSlug", label: "Campo de vinculo", type: "template-selector", required: true, options: fields },
        { name: "status", label: "Status inicial", type: "select", options: [{ value: "draft", label: "Rascunho" }, { value: "sent", label: "Enviado" }] },
        { name: "title", label: "Titulo", type: "text", placeholder: isContract ? "Contrato - {{item.title}}" : "Proposta - {{item.title}}" },
        { name: "content", label: "Conteudo customizado", type: "textarea" },
        { name: "skipIfExists", label: "Nao duplicar se ja existir", type: "boolean", defaultValue: true }
      ]
    };
  }

  if (nodeType === "send_document" || nodeType === "update_document_status") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text" },
        { name: "kind", label: "Tipo", type: "select", options: [{ value: "proposal", label: "Proposta" }, { value: "contract", label: "Contrato" }] },
        { name: "documentFieldSlug", label: "Campo do documento", type: "template-selector", options: fields, placeholder: "Selecione um campo" },
        ...(nodeType === "send_document" ? [
          { name: "channel", label: "Canal", type: "select" as const, options: [{ value: "email", label: "E-mail" }] },
          { name: "email", label: "E-mail fixo", type: "text" as const, placeholder: "cliente@empresa.com" },
          { name: "emailPath", label: "Caminho do e-mail", type: "text" as const },
          { name: "message", label: "Mensagem", type: "textarea" as const },
          { name: "resend", label: "Permitir reenvio", type: "boolean" as const }
        ] : [
          { name: "status", label: "Status", type: "select" as const, options: ["draft", "sent", "viewed", "approved", "rejected", "accepted", "signed"].map((status) => ({ value: status, label: status })) }
        ])
      ]
    };
  }

  if (nodeType === "ensure_customer_from_work_item") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "targetFieldSlug", label: "Campo cliente", type: "template-selector", required: true, options: fields },
        { name: "status", label: "Status", type: "select", options: [{ value: "prospect", label: "Prospect" }, { value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }, { value: "archived", label: "Arquivado" }] }
      ]
    };
  }

  if (nodeType === "create_billing_order") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "targetFieldSlug", label: "Campo ordem", type: "template-selector", required: true, options: fields },
        { name: "catalogItemFieldSlug", label: "Campo catalogo", type: "template-selector", options: fields },
        { name: "amountFieldSlug", label: "Campo valor", type: "template-selector", options: fields },
        { name: "customerIdFieldSlug", label: "Campo cliente", type: "template-selector", options: fields },
        { name: "documentFieldSlug", label: "Documento vinculado", type: "template-selector", options: fields },
        { name: "amountFieldUnit", label: "Unidade do valor", type: "select", options: [{ value: "major", label: "Reais" }, { value: "minor", label: "Centavos" }] },
        { name: "dueInDays", label: "Vencimento em dias", type: "number", min: 1 },
        { name: "paymentMethod", label: "Forma de pagamento", type: "select", options: [{ value: "checkout", label: "Checkout" }, { value: "pix", label: "Pix" }, { value: "boleto", label: "Boleto" }] },
        { name: "description", label: "Descricao", type: "textarea" },
        { name: "sendEmail", label: "Enviar e-mail de cobranca", type: "boolean" }
      ]
    };
  }

  if (nodeType === "update_work_item_fields") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "title", label: "Titulo", type: "text" },
        { name: "description", label: "Descricao", type: "textarea" },
        { name: "fieldSlug", label: "Campo customizado", type: "template-selector", options: fields },
        { name: "typeSlug", label: "Tipo do card", type: "work-item-type-selector", options: optionList(itemTypes) },
        {
          name: "customFieldValues",
          label: "Valores customizados",
          type: "key-value-list",
          options: fields,
          keyLabel: "Campo",
          valueLabel: "Valor",
          valuePlaceholder: "Valor do campo"
        }
      ]
    };
  }

  if (nodeType === "create_followup_task") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "title", label: "Titulo", type: "text", required: true },
        { name: "description", label: "Descricao", type: "textarea", required: true },
        { name: "assigneeIdPath", label: "Responsavel path", type: "text" },
        { name: "dueInDays", label: "Prazo em dias", type: "number", min: 1 },
        { name: "channel", label: "Canal", type: "select", options: [{ value: "task", label: "Tarefa interna" }, { value: "email", label: "E-mail" }, { value: "whatsapp", label: "WhatsApp" }] },
        { name: "columnSlug", label: "Coluna", type: "select", options: optionList(boardColumns), placeholder: "Mesma etapa" }
      ]
    };
  }

  if (nodeType === "register_card_activity") {
    return {
      ...base,
      fields: [
        { name: "itemIdPath", label: "Item ID path", type: "text", required: true },
        { name: "eventName", label: "Evento", type: "text", required: true },
        { name: "message", label: "Mensagem", type: "textarea", required: true },
        { name: "severity", label: "Severidade", type: "select", options: [{ value: "info", label: "Info" }, { value: "warning", label: "Aviso" }, { value: "critical", label: "Critico" }] },
        { name: "visibility", label: "Visibilidade", type: "select", options: [{ value: "internal", label: "Interna" }, { value: "customer", label: "Cliente" }] },
        {
          name: "payload",
          label: "Dados adicionais",
          type: "key-value-list",
          keyLabel: "Chave",
          valueLabel: "Valor",
          valuePlaceholder: "Valor registrado no historico"
        }
      ]
    };
  }

  if (nodeType === "human_approval") {
    return {
      ...base,
      fields: [
        { name: "type", label: "Tipo", type: "select", required: true, options: [{ value: "send_message", label: "Enviar mensagem" }, { value: "move_card", label: "Mover card" }, { value: "create_task", label: "Criar tarefa" }, { value: "apply_ai_recommendation", label: "Aplicar sugestao de IA" }] },
        { name: "requestedBy", label: "Aprovador/solicitante", type: "text", required: true },
        { name: "expiresInDays", label: "SLA em dias", type: "number", min: 1 },
        { name: "title", label: "Titulo", type: "text", required: true },
        { name: "description", label: "Motivo e mensagem", type: "textarea", required: true }
      ]
    };
  }

  if (nodeType === "delay") {
    return createDelayNodeConfigDescriptor({
      ...base,
      amountFieldName: "delayFor.amount",
      unitFieldName: "delayFor.unit"
    });
  }

  if (nodeType === "communication_send") {
    return createCommunicationNodeConfigDescriptor(base);
  }

  return {
    ...base,
    description: summarizeConfig(buildDefaultNodeConfig(nodeType)),
    fields: []
  };
}
