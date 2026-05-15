import type {
  NodeConfigDescriptor,
  NodeConfigFieldDescriptor,
  NodeConfigFieldOption,
  NodeConfigFormSection,
  NodeConfigValidationDescriptor
} from "./types";

export const commonDelayUnitOptions: NodeConfigFieldOption[] = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
  { value: "weeks", label: "Semanas" }
];

export const commonConditionLogicOptions: NodeConfigFieldOption[] = [
  { value: "AND", label: "E (AND) - todas as regras" },
  { value: "OR", label: "OU (OR) - qualquer regra" }
];

export const commonConditionOperatorOptions: NodeConfigFieldOption[] = [
  "eq",
  "neq",
  "gte",
  "lte",
  "contains",
  "in",
  "is_true",
  "is_false"
].map((operator) => ({ value: operator, label: operator }));

export const commonCommunicationChannelOptions: NodeConfigFieldOption[] = [
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" }
];

export const commonOutputTypeOptions: NodeConfigFieldOption[] = [
  { value: "text_response", label: "Texto ao usuario" },
  { value: "update_card", label: "Atualizar card" }
];

export interface CommonDescriptorInput {
  type: string;
  label: string;
  description?: NodeConfigDescriptor["description"];
  sections?: NodeConfigFormSection[];
  validation?: NodeConfigValidationDescriptor;
}

export function createNodeLabelField(input: {
  name?: string;
  label?: string;
  required?: boolean;
} = {}): NodeConfigFieldDescriptor {
  return {
    name: input.name ?? "label",
    label: input.label ?? "Nome do no",
    type: "text",
    required: input.required ?? true
  };
}

export function createBaseNodeConfigDescriptor(
  input: CommonDescriptorInput,
  fields: NodeConfigFieldDescriptor[]
): NodeConfigDescriptor {
  return {
    type: input.type,
    label: input.label,
    description: input.description,
    sections: input.sections ?? [{ id: "main", title: input.label, description: input.description }],
    validation: input.validation,
    fields
  };
}

export function createTriggerNodeConfigDescriptor(input: CommonDescriptorInput & {
  eventFieldName?: string;
  eventLabel?: string;
  triggerOptions: NodeConfigFieldOption[];
  includeLabelField?: boolean;
  extraFields?: NodeConfigFieldDescriptor[];
}): NodeConfigDescriptor {
  const fields: NodeConfigFieldDescriptor[] = [
    ...(input.includeLabelField ? [createNodeLabelField()] : []),
    {
      name: input.eventFieldName ?? "triggerType",
      label: input.eventLabel ?? "Evento",
      type: "select",
      required: true,
      options: input.triggerOptions
    },
    ...(input.extraFields ?? [])
  ];

  return createBaseNodeConfigDescriptor(input, fields);
}

export function createConditionExpressionNodeConfigDescriptor(input: CommonDescriptorInput & {
  expressionFieldName?: string;
  expressionLabel?: string;
  includeLabelField?: boolean;
  rows?: number;
  extraFields?: NodeConfigFieldDescriptor[];
}): NodeConfigDescriptor {
  return createBaseNodeConfigDescriptor(input, [
    ...(input.includeLabelField ? [createNodeLabelField()] : []),
    {
      name: input.expressionFieldName ?? "condition",
      label: input.expressionLabel ?? "Expressao de condicao",
      type: "textarea",
      rows: input.rows ?? 4,
      required: true
    },
    ...(input.extraFields ?? [])
  ]);
}

export function createDelayNodeConfigDescriptor(input: CommonDescriptorInput & {
  amountFieldName?: string;
  unitFieldName?: string;
  amountLabel?: string;
  unitLabel?: string;
  includeLabelField?: boolean;
}): NodeConfigDescriptor {
  return createBaseNodeConfigDescriptor(input, [
    ...(input.includeLabelField ? [createNodeLabelField()] : []),
    {
      name: input.amountFieldName ?? "duration",
      label: input.amountLabel ?? "Quantidade",
      type: "number",
      min: 1,
      required: true
    },
    {
      name: input.unitFieldName ?? "unit",
      label: input.unitLabel ?? "Unidade",
      type: "select",
      required: true,
      options: commonDelayUnitOptions
    }
  ]);
}

export function createCommunicationNodeConfigDescriptor(input: CommonDescriptorInput & {
  includeLabelField?: boolean;
  channelFieldName?: string;
  recipientFieldName?: string;
  templateFieldName?: string;
  bodyFieldName?: string;
  channelOptions?: NodeConfigFieldOption[];
  extraFields?: NodeConfigFieldDescriptor[];
}): NodeConfigDescriptor {
  return createBaseNodeConfigDescriptor(input, [
    ...(input.includeLabelField ? [createNodeLabelField()] : []),
    {
      name: input.channelFieldName ?? "channel",
      label: "Canal",
      type: "select",
      required: true,
      options: input.channelOptions ?? commonCommunicationChannelOptions
    },
    {
      name: "provider",
      label: "Provider",
      type: "select",
      options: [
        { value: "mock", label: "Mock" },
        { value: "resend", label: "Resend" },
        { value: "meta", label: "Meta WhatsApp" }
      ]
    },
    {
      name: input.recipientFieldName ?? "to",
      label: "Destinatario",
      type: "text"
    },
    {
      name: input.templateFieldName ?? "templateKey",
      label: "Template",
      type: "template-selector"
    },
    {
      name: input.bodyFieldName ?? "body",
      label: "Mensagem",
      type: "textarea"
    },
    ...(input.extraFields ?? [])
  ]);
}

export function createOutputNodeConfigDescriptor(input: CommonDescriptorInput & {
  includeLabelField?: boolean;
  outputFieldName?: string;
  outputOptions?: NodeConfigFieldOption[];
}): NodeConfigDescriptor {
  return createBaseNodeConfigDescriptor(input, [
    ...(input.includeLabelField ? [createNodeLabelField()] : []),
    {
      name: input.outputFieldName ?? "outputType",
      label: "Tipo de saida",
      type: "select",
      required: true,
      options: input.outputOptions ?? commonOutputTypeOptions
    }
  ]);
}
