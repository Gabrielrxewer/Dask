import { useEffect, useMemo, useState } from "react";
import {
  FieldShell,
  resolveFieldShellStyle,
  resolveTaskFieldValue,
  WorkItemFieldRenderer
} from "@/entities/task";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskFieldDefinition, TaskStatus } from "@/entities/task";
import type { MembersById } from "@/entities/member";
import { getPreviewSampleFieldValue } from "./work-item-editor-settings.model";

interface WorkItemFieldPreviewValueProps {
  field: TaskFieldDefinition;
  previewTask: Task;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById?: MembersById;
}

function buildInitialPreviewValue(field: TaskFieldDefinition, previewTask: Task): TaskCustomFieldValue {
  const resolvedValue = resolveTaskFieldValue(previewTask, field);

  if (resolvedValue !== null && typeof resolvedValue !== "undefined" && resolvedValue !== "") {
    return resolvedValue;
  }

  return getPreviewSampleFieldValue({
    field,
    typeId: previewTask.type,
    statusId: previewTask.status,
    priority: previewTask.priority
  });
}

export function WorkItemFieldPreviewValue({
  field,
  previewTask,
  boardConfig,
  statuses,
  membersById
}: WorkItemFieldPreviewValueProps) {
  const initialValue = useMemo(() => buildInitialPreviewValue(field, previewTask), [field, previewTask]);
  const [previewValue, setPreviewValue] = useState<TaskCustomFieldValue>(initialValue);
  const shellStyle = resolveFieldShellStyle({
    field,
    mode: "edit",
    context: "detail",
    readonly: false
  });

  useEffect(() => {
    setPreviewValue(initialValue);
  }, [initialValue]);

  return (
    <FieldShell
      label={field.label}
      hint={field.description}
      required={field.required}
      kind={shellStyle.kind}
      helpMode={shellStyle.helpMode}
    >
      <WorkItemFieldRenderer
        field={field}
        value={previewValue}
        mode="edit"
        context="detail"
        boardConfig={boardConfig}
        statuses={statuses}
        membersById={membersById}
        task={previewTask}
        onChange={setPreviewValue}
      />
    </FieldShell>
  );
}
