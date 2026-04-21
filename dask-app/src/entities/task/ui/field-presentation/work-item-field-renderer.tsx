import { TextInput } from "@/shared/ui";
import { getTaskFieldTypeSpec } from "@/entities/task/ui/field-presentation/field-type-specs";
import type { FieldPresentationComponentProps, FieldPresentationProps } from "@/entities/task/ui/field-presentation/presentation-types";
import { useFieldController } from "@/entities/task/ui/field-presentation/use-field-controller";
import "./field-presentation.css";

function UnsupportedField(props: FieldPresentationComponentProps) {
  if (props.mode === "edit" && !props.controller.readonly) {
    return (
      <TextInput
        value={props.controller.stringValue}
        onChange={event => props.controller.setValue(event.target.value)}
        onBlur={props.onBlur}
        autoFocus={props.autoFocus}
        disabled={props.controller.disabled}
      />
    );
  }

  if (props.controller.isEmpty) {
    return <span className="task-field-presentation__unsupported">Campo sem renderer oficial para este tipo.</span>;
  }

  return <span className="task-field-presentation__unsupported">{props.controller.displayValue}</span>;
}

export function WorkItemFieldRenderer(props: FieldPresentationProps) {
  const spec = getTaskFieldTypeSpec(props.field.type);
  const controller = useFieldController(props);
  const ContextRenderer = spec.components.contexts?.[props.context]?.[props.mode];
  const Renderer = ContextRenderer ?? spec.components[props.mode];
  const ResolvedRenderer = Renderer ?? UnsupportedField;

  return <ResolvedRenderer {...props} controller={controller} />;
}
