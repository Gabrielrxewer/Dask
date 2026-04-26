import type { CustomFieldInputType, JsonRecord } from '@/modules/workspace-platform/application/shared';
import {
  buildFieldSourceTag,
  inferFieldCapabilities,
  normalizeFieldDisplayContext,
  normalizeFieldSection,
  readFieldStorageConfig
} from '@/modules/workspace-platform/application/shared';

export type FieldOptionRecord = {
  id: string;
  label: string;
  value: string;
  color: string | null;
  order: number;
  isActive: boolean;
};

export type FieldDefinitionRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  variableKey?: string | null;
  variableLabel?: string | null;
  variableDescription?: string | null;
  type: CustomFieldInputType;
  required: boolean;
  isSystem: boolean;
  isEditable: boolean;
  isRemovable: boolean;
  isActive: boolean;
  order: number;
  settings: unknown;
  defaultValue: unknown;
  options: FieldOptionRecord[];
};

export type FieldBindingRecord = {
  id: string;
  fieldId: string;
  fieldSlug: string;
  typeId: string;
  typeSlug: string;
  displayContext: 'card' | 'detail';
  order: number;
  section: string | null;
  isVisible: boolean;
  isRequiredOverride: boolean | null;
  isReadonlyOverride: boolean | null;
  settings: unknown;
};

export type SystemFieldSeed = {
  slug: string;
  name: string;
  description: string;
  type: CustomFieldInputType;
  required?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  settings?: JsonRecord;
};

export const SYSTEM_FIELD_SEEDS: SystemFieldSeed[] = [
  {
    slug: 'sys:title',
    name: 'Titulo',
    description: 'Titulo principal do work item.',
    type: 'text',
    required: true,
    isEditable: true,
    isRemovable: false,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'title'
      },
      cardArea: 'title',
      detailSection: 'main'
    }
  },
  {
    slug: 'sys:description',
    name: 'Descricao',
    description: 'Descricao principal do work item.',
    type: 'long_text',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      allowAiGeneration: true,
      storage: {
        kind: 'item_property',
        property: 'description'
      },
      cardArea: 'description',
      detailSection: 'main'
    }
  },
  {
    slug: 'sys:type',
    name: 'Tipo',
    description: 'Tipo do work item.',
    type: 'work_item_type',
    required: true,
    isEditable: true,
    isRemovable: false,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'typeSlug'
      },
      cardArea: 'badge',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:status',
    name: 'Status',
    description: 'Estado do fluxo do work item.',
    type: 'status',
    required: true,
    isEditable: true,
    isRemovable: false,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'stateSlug'
      },
      cardArea: 'badge',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:priority',
    name: 'Prioridade',
    description: 'Prioridade operacional do work item.',
    type: 'priority',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'metadata',
        property: 'priority'
      },
      cardArea: 'summary',
      detailSection: 'main'
    }
  },
  {
    slug: 'sys:created-by',
    name: 'Criado por',
    description: 'Autor original do work item.',
    type: 'user',
    isEditable: false,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'createdBy'
      },
      cardArea: 'summary',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:assignee',
    name: 'Responsavel',
    description: 'Responsavel atual do work item.',
    type: 'user',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'assigneeId'
      },
      cardArea: 'summary',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:tags',
    name: 'Tags',
    description: 'Etiquetas dinamicas do work item.',
    type: 'tag',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_relation',
        property: 'tags'
      },
      cardArea: 'tags',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:checklist',
    name: 'Checklist',
    description: 'Checklist operacional do work item.',
    type: 'checklist',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'checklist'
      },
      cardArea: 'meta',
      detailSection: 'main'
    }
  },
  {
    slug: 'sys:schedule',
    name: 'Planejamento',
    description: 'Janela planejada de inicio e fim.',
    type: 'schedule',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'legacy_fields',
        property: 'schedule'
      },
      cardArea: 'meta',
      detailSection: 'side'
    }
  },
  {
    slug: 'sys:due-date',
    name: 'Prazo',
    description: 'Data prevista de conclusao.',
    type: 'date',
    isEditable: true,
    isRemovable: true,
    settings: {
      source: 'system',
      storage: {
        kind: 'item_property',
        property: 'dueDate'
      },
      cardArea: 'meta',
      detailSection: 'side'
    }
  }
];

export const SYSTEM_FIELD_SLUGS = SYSTEM_FIELD_SEEDS.map((field) => field.slug);

export function serializeFieldDefinition(field: FieldDefinitionRecord) {
  return {
    id: field.slug,
    definitionId: field.id,
    label: field.name,
    name: field.name,
    slug: field.slug,
    description: field.description,
    variableKey: field.variableKey ?? undefined,
    variableLabel: field.variableLabel ?? undefined,
    variableDescription: field.variableDescription ?? undefined,
    type: field.type,
    required: field.required,
    source: buildFieldSourceTag({ isSystem: field.isSystem, settings: field.settings }),
    isSystem: field.isSystem,
    isEditable: field.isEditable,
    isRemovable: field.isRemovable,
    isActive: field.isActive,
    order: field.order,
    config: field.settings,
    defaultValue: field.defaultValue,
    options: field.options.map((option) => ({
      id: option.id,
      label: option.label,
      value: option.value,
      color: option.color,
      order: option.order,
      isActive: option.isActive
    })),
    capabilities: inferFieldCapabilities(field.type, field.settings),
    storage: readFieldStorageConfig(field.settings)
  };
}

export function serializeFieldBinding(binding: FieldBindingRecord) {
  return {
    id: binding.id,
    fieldId: binding.fieldSlug,
    typeId: binding.typeSlug,
    fieldDefinitionId: binding.fieldId,
    workItemTypeId: binding.typeId,
    displayContext: normalizeFieldDisplayContext(binding.displayContext),
    order: binding.order,
    section: normalizeFieldSection(binding.section),
    isVisible: binding.isVisible,
    isRequiredOverride: binding.isRequiredOverride,
    isReadonlyOverride: binding.isReadonlyOverride,
    settings: binding.settings
  };
}

export function buildLegacyFieldLayoutMaps(
  bindings: Array<ReturnType<typeof serializeFieldBinding>>
): {
  visibleFieldIdsByType: Record<string, string[]>;
  detailVisibleFieldIdsByType: Record<string, string[]>;
  detailFieldZoneByType: Record<string, Record<string, 'main' | 'side'>>;
} {
  return bindings.reduce(
    (acc, binding) => {
      if (!binding.isVisible) {
        return acc;
      }

      if (binding.displayContext === 'card') {
        const list = acc.visibleFieldIdsByType[binding.typeId] ?? [];
        acc.visibleFieldIdsByType[binding.typeId] = [...list, binding.fieldId];
        return acc;
      }

      const list = acc.detailVisibleFieldIdsByType[binding.typeId] ?? [];
      acc.detailVisibleFieldIdsByType[binding.typeId] = [...list, binding.fieldId];

      const zoneMap = acc.detailFieldZoneByType[binding.typeId] ?? {};
      zoneMap[binding.fieldId] = binding.section === 'main' ? 'main' : 'side';
      acc.detailFieldZoneByType[binding.typeId] = zoneMap;
      return acc;
    },
    {
      visibleFieldIdsByType: {} as Record<string, string[]>,
      detailVisibleFieldIdsByType: {} as Record<string, string[]>,
      detailFieldZoneByType: {} as Record<string, Record<string, 'main' | 'side'>>
    }
  );
}
