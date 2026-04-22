import type { ComponentType } from "react";
import type { MembersById } from "@/entities/member";
import type {
  BoardConfig,
  Task,
  TaskChecklist,
  TaskCustomFieldValue,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldOption,
  TaskFieldType,
  TaskStatus
} from "@/entities/task/model/types";

export type FieldPresentationMode = "display" | "edit";

export type FieldPresentationContext =
  | "detail"
  | "form"
  | "inline"
  | "table"
  | "card"
  | "filter";

export type FieldShellKind = "simple" | "complex" | "meta";

export type FieldHelpMode = "tooltip" | "inline" | "hidden";

export interface FieldPresentationEnvironment {
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  task?: Task | null;
  membersById?: MembersById;
  availableTags?: Array<{ id: string; name: string; color: string }>;
}

export interface FieldPresentationProps extends FieldPresentationEnvironment {
  field: TaskFieldDefinition;
  value: TaskCustomFieldValue;
  mode: FieldPresentationMode;
  context: FieldPresentationContext;
  readonly?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange?: (value: TaskCustomFieldValue) => void;
  onBlur?: () => void;
  error?: string | null;
  placeholder?: string;
  cardArea?: TaskFieldCardArea;
}

export type FieldTypeBehaviorInput = FieldPresentationEnvironment & {
  field: TaskFieldDefinition;
  value: TaskCustomFieldValue;
};

export interface FieldControllerResult {
  value: TaskCustomFieldValue;
  parsedValue: TaskCustomFieldValue;
  normalizedValue: TaskCustomFieldValue;
  displayValue: string;
  error: string | null;
  readonly: boolean;
  disabled: boolean;
  isEmpty: boolean;
  options: TaskFieldOption[];
  selectedOption: TaskFieldOption | null;
  selectedOptions: TaskFieldOption[];
  stringValue: string;
  stringValues: string[];
  booleanValue: boolean;
  numberValue: number | null;
  checklistValue: TaskChecklist | null;
  recordValue: Record<string, unknown> | null;
  setValue: (value: unknown) => void;
}

export type FieldPresentationComponentProps = FieldPresentationProps & {
  controller: FieldControllerResult;
};

export type FieldPresentationComponent = ComponentType<FieldPresentationComponentProps>;

export interface ResolvedFieldShellStyle {
  kind: FieldShellKind;
  helpMode: FieldHelpMode;
}

export type FieldPresentationOverrideMap = Partial<
  Record<FieldPresentationContext, Partial<Record<FieldPresentationMode, FieldPresentationComponent>>>
>;

export interface FieldTypeSpec {
  type: TaskFieldType;
  label: string;
  normalizeValue?: (value: TaskCustomFieldValue, field: TaskFieldDefinition) => TaskCustomFieldValue;
  parseValue?: (input: unknown, field: TaskFieldDefinition) => TaskCustomFieldValue;
  formatValue?: (input: FieldTypeBehaviorInput) => string;
  validateValue?: (input: FieldTypeBehaviorInput) => string | null;
  components: {
    display: FieldPresentationComponent;
    edit: FieldPresentationComponent;
    contexts?: FieldPresentationOverrideMap;
  };
}
