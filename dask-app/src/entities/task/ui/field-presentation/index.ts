export { FieldShell } from "@/entities/task/ui/field-presentation/field-shell";
export { resolveFieldShellStyle } from "@/entities/task/ui/field-presentation/field-shell-style";
export { WorkItemFieldRenderer } from "@/entities/task/ui/field-presentation/work-item-field-renderer";
export {
  getTaskFieldTypeSpec,
  normalizeTaskFieldPresentationValue,
  taskFieldTypeSpecs,
  validateTaskFieldPresentationValue
} from "@/entities/task/ui/field-presentation/field-type-specs";
export type {
  FieldControllerResult,
  FieldPresentationComponent,
  FieldPresentationComponentProps,
  FieldPresentationContext,
  FieldPresentationMode,
  FieldPresentationProps,
  FieldHelpMode,
  FieldShellKind,
  ResolvedFieldShellStyle,
  FieldTypeSpec
} from "@/entities/task/ui/field-presentation/presentation-types";
