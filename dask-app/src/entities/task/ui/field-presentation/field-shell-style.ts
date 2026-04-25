import type {
  FieldPresentationContext,
  FieldPresentationMode,
  FieldShellKind,
  ResolvedFieldShellStyle
} from "@/entities/task/ui/field-presentation/presentation-types";
import type { TaskFieldDefinition } from "@/entities/task/model/types";

const complexFieldTypes = new Set<TaskFieldDefinition["type"]>([
  "long_text",
  "multi_select",
  "tag",
  "checklist",
  "schedule"
]);

function resolveFieldShellKind(input: {
  field: TaskFieldDefinition;
  mode: FieldPresentationMode;
  context: FieldPresentationContext;
  readonly?: boolean;
}): FieldShellKind {
  const { field, readonly = false } = input;

  if (readonly || field.isEditable === false) {
    return "meta";
  }

  if (complexFieldTypes.has(field.type)) {
    return "complex";
  }

  return "simple";
}

export function resolveFieldShellStyle(input: {
  field: TaskFieldDefinition;
  mode: FieldPresentationMode;
  context: FieldPresentationContext;
  readonly?: boolean;
}): ResolvedFieldShellStyle {
  const kind = resolveFieldShellKind(input);

  return {
    kind,
    helpMode: "tooltip"
  };
}
