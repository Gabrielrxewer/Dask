import { useCallback, useMemo } from "react";
import {
  formatTaskFieldValue,
  getTaskFieldRegistryEntry,
  isTaskFieldValueEmpty,
  resolveTaskFieldOptions
} from "@/entities/task/model/field-registry";
import type { TaskCustomFieldValue, TaskFieldOption } from "@/entities/task/model/types";
import { getTaskFieldTypeSpec } from "@/entities/task/ui/field-presentation/field-type-specs";
import type { FieldControllerResult, FieldPresentationProps } from "@/entities/task/ui/field-presentation/presentation-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createFallbackOption(value: string): TaskFieldOption {
  return {
    id: value,
    label: value,
    value,
    isActive: true
  };
}

export function useFieldController(props: FieldPresentationProps): FieldControllerResult {
  const spec = getTaskFieldTypeSpec(props.field.type);

  const parsedValue = useMemo<TaskCustomFieldValue>(() => {
    if (spec.parseValue) {
      return spec.parseValue(props.value, props.field);
    }

    return props.value;
  }, [props.field, props.value, spec]);

  const normalizedValue = useMemo<TaskCustomFieldValue>(() => {
    if (spec.normalizeValue) {
      return spec.normalizeValue(parsedValue, props.field);
    }

    return getTaskFieldRegistryEntry(props.field.type).normalize(parsedValue);
  }, [parsedValue, props.field, spec]);

  const options = useMemo(
    () =>
      resolveTaskFieldOptions({
        field: props.field,
        boardConfig: props.boardConfig,
        statuses: props.statuses,
        membersById: props.membersById,
        availableTags: props.availableTags
      }),
    [props.availableTags, props.boardConfig, props.field, props.membersById, props.statuses]
  );

  const displayValue = useMemo(() => {
    if (spec.formatValue) {
      return spec.formatValue({
        field: props.field,
        value: normalizedValue,
        boardConfig: props.boardConfig,
        statuses: props.statuses,
        membersById: props.membersById,
        availableTags: props.availableTags,
        task: props.task
      });
    }

    return formatTaskFieldValue({
      field: props.field,
      value: normalizedValue,
      boardConfig: props.boardConfig,
      statuses: props.statuses,
      membersById: props.membersById,
      availableTags: props.availableTags
    });
  }, [normalizedValue, props.availableTags, props.boardConfig, props.field, props.membersById, props.statuses, props.task, spec]);

  const validationError = useMemo(() => {
    if (!spec.validateValue) {
      return null;
    }

    return spec.validateValue({
      field: props.field,
      value: normalizedValue,
      boardConfig: props.boardConfig,
      statuses: props.statuses,
      membersById: props.membersById,
      availableTags: props.availableTags,
      task: props.task
    });
  }, [normalizedValue, props.availableTags, props.boardConfig, props.field, props.membersById, props.statuses, props.task, spec]);

  const stringValue =
    typeof normalizedValue === "string"
      ? normalizedValue
      : typeof normalizedValue === "number"
        ? String(normalizedValue)
        : "";

  const stringValues = Array.isArray(normalizedValue)
    ? normalizedValue.map(entry => String(entry))
    : typeof normalizedValue === "string" && normalizedValue.length > 0 && props.field.type === "multi_select"
      ? normalizedValue
          .split(",")
          .map(entry => entry.trim())
          .filter(Boolean)
      : [];

  const selectedOption =
    stringValue.length > 0
      ? options.find(option => option.value === stringValue) ?? createFallbackOption(stringValue)
      : null;

  const selectedOptions = stringValues.map(
    value => options.find(option => option.value === value) ?? createFallbackOption(value)
  );

  const setValue = useCallback(
    (nextValue: unknown) => {
      const parsed = spec.parseValue ? spec.parseValue(nextValue, props.field) : (nextValue as TaskCustomFieldValue);
      const normalized = spec.normalizeValue
        ? spec.normalizeValue(parsed, props.field)
        : getTaskFieldRegistryEntry(props.field.type).normalize(parsed);

      props.onChange?.(normalized);
    },
    [props.field, props.onChange, spec]
  );

  return {
    value: props.value,
    parsedValue,
    normalizedValue,
    displayValue,
    error: props.error ?? validationError,
    readonly: props.readonly === true,
    disabled: props.disabled === true,
    isEmpty: isTaskFieldValueEmpty(props.field, normalizedValue),
    options,
    selectedOption,
    selectedOptions,
    stringValue,
    stringValues,
    booleanValue: normalizedValue === true,
    numberValue: typeof normalizedValue === "number" ? normalizedValue : null,
    checklistValue:
      isRecord(normalizedValue) && Array.isArray(normalizedValue.items)
        ? {
            items: normalizedValue.items.map((item, index) => ({
              id: typeof item?.id === "string" ? item.id : `check-${index}`,
              label: typeof item?.label === "string" ? item.label : "",
              done: item?.done === true
            }))
          }
        : null,
    recordValue: isRecord(normalizedValue) ? normalizedValue : null,
    setValue
  };
}
