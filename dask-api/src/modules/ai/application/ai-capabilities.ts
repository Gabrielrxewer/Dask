import { env } from '@/core/config/env';

export interface AICapabilityOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

export interface AICapabilities {
  schemaVersion: 1;
  defaults: {
    model: string;
    ragSource: string;
    topKContextDocs: number;
    nativeTools: string[];
    gptTools: string[];
  };
  models: AICapabilityOption[];
  ragSources: AICapabilityOption[];
  topKContextDocsOptions: number[];
  tools: AICapabilityOption[];
}

const ragSources: AICapabilityOption[] = [
  { value: 'none', label: 'Sem RAG' },
  { value: 'documentation', label: 'Documentacao' },
  { value: 'card', label: 'Cards' },
  { value: 'card_and_documentation', label: 'Documentacao + cards' }
];

const nativeTools: AICapabilityOption[] = [
  {
    value: 'update_item_description',
    label: 'Atualizar descricao',
    group: 'Tools nativas'
  },
  {
    value: 'set_item_status',
    label: 'Alterar status',
    group: 'Tools nativas'
  },
  {
    value: 'set_item_priority',
    label: 'Alterar prioridade',
    group: 'Tools nativas'
  }
];

const gptTools: AICapabilityOption[] = [
  {
    value: 'web_search',
    label: 'Web Search',
    group: 'GPT Tools'
  }
];

export function getAICapabilities(): AICapabilities {
  const configuredModels = Array.from(new Set([env.AI_CHAT_MODEL, ...env.AI_CHAT_MODEL_OPTIONS]));

  return {
    schemaVersion: 1,
    defaults: {
      model: env.AI_CHAT_MODEL,
      ragSource: 'documentation',
      topKContextDocs: 5,
      nativeTools: nativeTools.map((tool) => tool.value),
      gptTools: []
    },
    models: configuredModels.map((model) => ({
      value: model,
      label: model
    })),
    ragSources,
    topKContextDocsOptions: [3, 5, 7, 10],
    tools: [...gptTools, ...nativeTools]
  };
}
