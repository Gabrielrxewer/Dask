import { useState, type CSSProperties } from "react";
import {
  formatTaskFieldValue,
  getTaskFieldRegistryEntry,
  matchesTaskFieldStorage
} from "@/entities/task/model/field-registry";
import type {
  TaskChecklist,
  TaskCustomFieldValue,
  TaskFieldDefinition,
  TaskFieldOption,
  TaskFieldType
} from "@/entities/task/model/types";
import { TaskTypeIcon, resolveTaskTypeIconName } from "@/entities/task/ui/task-type-icon";
import type {
  FieldPresentationComponentProps,
  FieldTypeBehaviorInput,
  FieldTypeSpec
} from "@/entities/task/ui/field-presentation/presentation-types";
import { Button, Select, TextInput, Textarea } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDateTimeLocalInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (entry: number) => entry.toString().padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getChecklistProgress(value: TaskChecklist) {
  const total = value.items.length;
  const done = value.items.filter(item => item.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, percent };
}

function resolveEmptyText(field: TaskFieldDefinition): string {
  if (field.type === "multi_select" || field.type === "tag") {
    return "Sem itens selecionados.";
  }

  if (field.type === "checklist") {
    return "Sem itens no checklist.";
  }

  if (field.type === "date" || field.type === "datetime" || field.type === "schedule") {
    return "Sem data configurada.";
  }

  return "Sem valor configurado.";
}

function renderEmpty(field: TaskFieldDefinition) {
  return <span className="task-field-presentation__placeholder">{resolveEmptyText(field)}</span>;
}

function resolveOptionStyle(option: TaskFieldOption | null): CSSProperties | undefined {
  if (!option?.color) {
    return undefined;
  }

  return {
    "--task-field-pill-accent": option.color
  } as CSSProperties;
}

function OptionPill({
  option,
  compact = false
}: {
  option: TaskFieldOption | null;
  compact?: boolean;
}) {
  if (!option) {
    return null;
  }

  return (
    <span
      className={cn("task-field-presentation__pill", compact && "task-field-presentation__pill--compact")}
      style={resolveOptionStyle(option)}
    >
      {option.color ? <span className="task-field-presentation__pill-dot" aria-hidden="true" /> : null}
      <span>{option.label}</span>
    </span>
  );
}

function ChipList({
  options,
  limit
}: {
  options: TaskFieldOption[];
  limit?: number;
}) {
  const visibleOptions = typeof limit === "number" ? options.slice(0, limit) : options;
  const hiddenCount = typeof limit === "number" ? Math.max(options.length - visibleOptions.length, 0) : 0;

  return (
    <div className="task-field-presentation__chips">
      {visibleOptions.map(option => (
        <span key={`${option.value}-${option.label}`} className="task-field-presentation__chip">
          {option.label}
        </span>
      ))}
      {hiddenCount > 0 ? <span className="task-field-presentation__chip task-field-presentation__chip--more">{`+${hiddenCount}`}</span> : null}
    </div>
  );
}

function DefaultDisplayField(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <p className="task-field-presentation__value">{props.controller.displayValue}</p>;
}

function TableValueField(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <span className="task-field-presentation__table-value">{props.controller.displayValue}</span>;
}

function TextFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <p className="task-field-presentation__text">{props.controller.displayValue}</p>;
}

function TextFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  return <span className="task-field-presentation__text task-field-presentation__text--card">{props.controller.displayValue}</span>;
}

function TextFieldTableDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <span className="task-field-presentation__text task-field-presentation__text--table">{props.controller.displayValue}</span>;
}

function TextFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <TextInput
      value={props.controller.stringValue}
      placeholder={props.placeholder ?? props.field.description ?? `Ex: ${props.field.label}`}
      onChange={event => props.controller.setValue(event.target.value)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function LongTextFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <p className="task-field-presentation__long-text">{props.controller.displayValue}</p>;
}

function LongTextFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  return <p className="task-field-presentation__long-text task-field-presentation__long-text--card">{props.controller.displayValue}</p>;
}

function LongTextFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <Textarea
      value={props.controller.stringValue}
      className="task-details__textarea"
      placeholder={props.placeholder ?? props.field.description ?? `Descreva ${props.field.label.toLowerCase()}.`}
      onChange={event => props.controller.setValue(event.target.value)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function NumberFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <TextInput
      type="number"
      value={props.controller.numberValue == null ? "" : String(props.controller.numberValue)}
      onChange={event => props.controller.setValue(event.target.value)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function DateFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <OptionPill option={{ id: props.controller.displayValue, label: props.controller.displayValue, value: props.controller.displayValue, isActive: true }} />;
}

function DateFieldTableDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <OptionPill compact option={{ id: props.controller.displayValue, label: props.controller.displayValue, value: props.controller.displayValue, isActive: true }} />;
}

function DateFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <TextInput
      type="date"
      value={props.controller.stringValue}
      onChange={event => props.controller.setValue(event.target.value || null)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function DatetimeFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <TextInput
      type="datetime-local"
      value={toDateTimeLocalInputValue(props.controller.stringValue)}
      onChange={event => props.controller.setValue(event.target.value || null)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function SelectFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <OptionPill option={props.controller.selectedOption} />;
}

function SelectFieldTableDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <OptionPill option={props.controller.selectedOption} compact />;
}

function SelectFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <Select
      value={props.controller.stringValue}
      onChange={event => props.controller.setValue(event.target.value || null)}
      disabled={props.controller.disabled || props.controller.readonly}
      autoFocus={props.autoFocus}
    >
      <option value="">Selecione...</option>
      {props.controller.options.map(option => (
        <option key={option.id} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function MultiSelectFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.selectedOptions.length === 0) {
    return renderEmpty(props.field);
  }

  return <ChipList options={props.controller.selectedOptions} />;
}

function MultiSelectFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.selectedOptions.length === 0) {
    return null;
  }

  return <ChipList options={props.controller.selectedOptions} limit={3} />;
}

function MultiSelectFieldTableDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.selectedOptions.length === 0) {
    return renderEmpty(props.field);
  }

  if (props.controller.selectedOptions.length > 2) {
    return <span className="task-field-presentation__table-value">{`${props.controller.selectedOptions.length} selecionados`}</span>;
  }

  return <ChipList options={props.controller.selectedOptions} limit={2} />;
}

function FreeTextTagEditor(props: FieldPresentationComponentProps) {
  const [draftValue, setDraftValue] = useState("");

  const addEntry = () => {
    const nextEntry = draftValue.trim().replace(/,$/g, "");
    if (!nextEntry) {
      return;
    }

    const nextValues = Array.from(new Set([...props.controller.stringValues, nextEntry]));
    props.controller.setValue(nextValues);
    setDraftValue("");
  };

  const removeEntry = (entry: string) => {
    props.controller.setValue(props.controller.stringValues.filter(value => value !== entry));
  };

  return (
    <div className="task-field-presentation__tag-editor">
      <div className="task-field-presentation__tag-row">
        {props.controller.stringValues.map(entry => (
          <span key={entry} className="task-field-presentation__tag-pill">
            <span>{entry}</span>
            <button type="button" className="task-field-presentation__tag-remove" onClick={() => removeEntry(entry)}>
              x
            </button>
          </span>
        ))}
      </div>
      <div className="task-field-presentation__tag-input-row">
        <TextInput
          value={draftValue}
          onChange={event => setDraftValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addEntry();
            }
          }}
          placeholder="Digite e pressione Enter para adicionar..."
          disabled={props.controller.disabled || props.controller.readonly}
        />
        <Button type="button" size="sm" variant="outline" onClick={addEntry} disabled={!draftValue.trim()}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function MultiSelectFieldEdit(props: FieldPresentationComponentProps) {
  const hasOfficialOptions = props.controller.options.length > 0;
  const allowCustomValues = props.field.type === "tag" || !hasOfficialOptions;

  const toggleOption = (option: TaskFieldOption) => {
    const isActive = props.controller.stringValues.includes(option.value);
    const nextValues = isActive
      ? props.controller.stringValues.filter(value => value !== option.value)
      : [...props.controller.stringValues, option.value];

    props.controller.setValue(nextValues);
  };

  return (
    <div className="task-field-presentation__editor-stack">
      {hasOfficialOptions ? (
        <div className="task-field-presentation__multi-options">
          {props.controller.options.map(option => {
            const isActive = props.controller.stringValues.includes(option.value);
            return (
              <button
                key={option.id}
                type="button"
                className={cn("task-field-presentation__multi-option", isActive && "is-active")}
                onClick={() => toggleOption(option)}
                disabled={props.controller.disabled || props.controller.readonly}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {allowCustomValues ? <FreeTextTagEditor {...props} /> : null}
    </div>
  );
}

function BooleanFieldDisplay(props: FieldPresentationComponentProps) {
  return (
    <OptionPill
      option={{
        id: props.controller.booleanValue ? "true" : "false",
        label: props.controller.booleanValue ? "Ativado" : "Desativado",
        value: props.controller.booleanValue ? "true" : "false",
        isActive: true,
        color: props.controller.booleanValue ? "#0a86e8" : "#94a3b8"
      }}
      compact={props.context === "table" || props.context === "card"}
    />
  );
}

function BooleanFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <button
      type="button"
      className={cn("task-field-presentation__toggle", props.controller.booleanValue && "is-on")}
      onClick={() => props.controller.setValue(!props.controller.booleanValue)}
      aria-pressed={props.controller.booleanValue}
      disabled={props.controller.disabled || props.controller.readonly}
    >
      <span className="task-field-presentation__toggle-track">
        <span className="task-field-presentation__toggle-thumb" />
      </span>
      <span className="task-field-presentation__toggle-label">{props.controller.booleanValue ? "Ativado" : "Desativado"}</span>
    </button>
  );
}

function UserFieldDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  const option = props.controller.selectedOption;
  const fullLabel = option?.label ?? props.controller.displayValue;
  const label = shouldAbbreviateCreatedByOnCard(props.field, fullLabel, props.context)
    ? abbreviatePersonName(fullLabel)
    : fullLabel;

  if (props.context === "detail" || props.context === "form" || props.readonly) {
    const accentColor = option?.color ?? props.membersById?.[props.controller.stringValue]?.color ?? "#7b9abc";

    return (
      <span className="task-field-presentation__identity">
        <span
          className="task-field-presentation__identity-badge"
          style={{ "--task-field-identity-accent": accentColor } as CSSProperties}
          aria-hidden="true"
        >
          {buildInitials(label)}
        </span>
        <span className="task-field-presentation__identity-label" title={fullLabel}>{label}</span>
      </span>
    );
  }

  return (
    <OptionPill
      option={label === fullLabel ? option : { ...(option ?? { id: fullLabel, value: fullLabel, isActive: true }), label }}
      compact={props.context === "table" || props.context === "card"}
    />
  );
}

function UserFieldEdit(props: FieldPresentationComponentProps) {
  if (props.controller.options.length > 0 && props.field.capabilities?.selectable !== false) {
    return <SelectFieldEdit {...props} />;
  }

  return (
    <TextInput
      value={props.controller.stringValue}
      onChange={event => props.controller.setValue(event.target.value || null)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function ChecklistFieldDisplay(props: FieldPresentationComponentProps) {
  const checklist = props.controller.checklistValue ?? { items: [] };
  const progress = getChecklistProgress(checklist);

  if (progress.total === 0) {
    return renderEmpty(props.field);
  }

  return (
    <div className="task-field-presentation__checklist">
      <div className="task-field-presentation__checklist-summary">
        <span>{`${progress.done}/${progress.total} concluidos`}</span>
        <span>{`${progress.percent}%`}</span>
      </div>
      <div className="task-field-presentation__checklist-progress">
        <div className="task-field-presentation__checklist-progress-bar" style={{ width: `${progress.percent}%` }} />
      </div>
      <ul className="task-field-presentation__checklist-items">
        {checklist.items.map(item => (
          <li key={item.id} className={cn("task-field-presentation__check-item", item.done && "is-done")}>
            <button type="button" className="task-field-presentation__check-toggle" disabled>
              {item.done ? (
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" width="10" height="10">
                  <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
            <span className="task-field-presentation__check-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistFieldCardDisplay(props: FieldPresentationComponentProps) {
  const checklist = props.controller.checklistValue ?? { items: [] };
  const progress = getChecklistProgress(checklist);

  if (progress.total === 0) {
    return null;
  }

  return <span className="task-field-presentation__table-value">{`${progress.done}/${progress.total} checklist`}</span>;
}

function ChecklistFieldTableDisplay(props: FieldPresentationComponentProps) {
  return <ChecklistFieldCardDisplay {...props} />;
}

function ChecklistFieldEdit(props: FieldPresentationComponentProps) {
  const checklist = props.controller.checklistValue ?? { items: [] };
  const progress = getChecklistProgress(checklist);
  const [draftItemLabel, setDraftItemLabel] = useState("");

  const updateChecklist = (nextChecklist: TaskChecklist) => {
    props.controller.setValue(nextChecklist);
  };

  const toggleItem = (itemId: string) => {
    updateChecklist({
      items: checklist.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done
            }
          : item
      )
    });
  };

  const updateLabel = (itemId: string, nextLabel: string) => {
    updateChecklist({
      items: checklist.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              label: nextLabel
            }
          : item
      )
    });
  };

  const removeItem = (itemId: string) => {
    updateChecklist({
      items: checklist.items.filter(item => item.id !== itemId)
    });
  };

  const addItem = () => {
    const nextLabel = draftItemLabel.trim();
    if (!nextLabel) {
      return;
    }

    updateChecklist({
      items: [
        ...checklist.items,
        {
          id: `check-${Date.now()}`,
          label: nextLabel,
          done: false
        }
      ]
    });
    setDraftItemLabel("");
  };

  return (
    <div className="task-field-presentation__checklist-editor">
      <div className="task-field-presentation__checklist-summary">
        <span>{`${progress.done}/${progress.total} concluidos`}</span>
        <span>{`${progress.percent}%`}</span>
      </div>
      <div className="task-field-presentation__checklist-progress">
        <div className="task-field-presentation__checklist-progress-bar" style={{ width: `${progress.percent}%` }} />
      </div>
      <ul className="task-field-presentation__checklist-items">
        {checklist.items.map(item => (
          <li key={item.id} className={cn("task-field-presentation__check-item", item.done && "is-done")}>
            <button
              type="button"
              className="task-field-presentation__check-toggle"
              onClick={() => toggleItem(item.id)}
              disabled={props.controller.disabled || props.controller.readonly}
            >
              {item.done ? (
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" width="10" height="10">
                  <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
            <input
              className="task-field-presentation__check-input"
              value={item.label}
              onChange={event => updateLabel(item.id, event.target.value)}
              disabled={props.controller.disabled || props.controller.readonly}
            />
            <button
              type="button"
              className="task-field-presentation__check-remove"
              onClick={() => removeItem(item.id)}
              disabled={props.controller.disabled || props.controller.readonly}
            >
              x
            </button>
          </li>
        ))}
      </ul>
      <div className="task-field-presentation__checklist-add">
        <TextInput
          value={draftItemLabel}
          onChange={event => setDraftItemLabel(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder="Adicionar item ao checklist..."
          disabled={props.controller.disabled || props.controller.readonly}
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={!draftItemLabel.trim()}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function ScheduleFieldDisplay(props: FieldPresentationComponentProps) {
  const schedule = props.controller.recordValue ?? {};
  const plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : "";
  const plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : "";

  if (!plannedStartAt && !plannedEndAt) {
    return renderEmpty(props.field);
  }

  return (
    <div className="task-field-presentation__schedule-preview">
      {plannedStartAt ? (
        <div className="task-field-presentation__schedule-line">
          <label>Inicio</label>
          <strong>{formatDateValue(plannedStartAt)}</strong>
        </div>
      ) : null}
      {plannedEndAt ? (
        <div className="task-field-presentation__schedule-line">
          <label>Fim</label>
          <strong>{formatDateValue(plannedEndAt)}</strong>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleFieldTableDisplay(props: FieldPresentationComponentProps) {
  const schedule = props.controller.recordValue ?? {};
  const plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : "";
  const plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : "";

  if (!plannedStartAt && !plannedEndAt) {
    return renderEmpty(props.field);
  }

  return <span className="task-field-presentation__table-value">{[plannedStartAt, plannedEndAt].filter(Boolean).map(formatDateValue).join(" - ")}</span>;
}

function ScheduleFieldEdit(props: FieldPresentationComponentProps) {
  const schedule = props.controller.recordValue ?? {};
  const plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : "";
  const plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : "";

  return (
    <div className="task-field-presentation__schedule-grid">
      <label className="task-field-presentation__schedule-field">
        <span>Inicio</span>
        <TextInput
          type="datetime-local"
          value={toDateTimeLocalInputValue(plannedStartAt)}
          onChange={event =>
            props.controller.setValue({
              plannedStartAt: event.target.value || null,
              plannedEndAt: plannedEndAt || null
            })
          }
          disabled={props.controller.disabled || props.controller.readonly}
        />
      </label>
      <label className="task-field-presentation__schedule-field">
        <span>Fim</span>
        <TextInput
          type="datetime-local"
          value={toDateTimeLocalInputValue(plannedEndAt)}
          onChange={event =>
            props.controller.setValue({
              plannedStartAt: plannedStartAt || null,
              plannedEndAt: event.target.value || null
            })
          }
          disabled={props.controller.disabled || props.controller.readonly}
        />
      </label>
    </div>
  );
}

function WorkItemTypeDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  const taskType = props.boardConfig.taskTypes.find(type => type.id === props.controller.stringValue);
  const option = props.controller.selectedOption;

  if (!taskType) {
    return <OptionPill option={option} compact={props.context === "table"} />;
  }

  if (props.context === "table") {
    return <OptionPill option={option} compact />;
  }

  const iconName = resolveTaskTypeIconName(taskType.id);

  if (props.context === "card") {
    return (
      <span
        className="task-card__type-icon"
        role="img"
        aria-label={taskType.label}
        title={taskType.label}
        style={{ color: taskType.text }}
      >
        <TaskTypeIcon name={iconName} />
      </span>
    );
  }

  return (
    <span className="task-field-presentation__type-badge">
      <span className="task-field-presentation__type-icon" style={{ color: taskType.text }}>
        <TaskTypeIcon name={iconName} />
      </span>
      <span className="task-field-presentation__type-copy">
        <span className="task-field-presentation__type-label">{taskType.label}</span>
        <span className="task-field-presentation__type-caption">Tipo</span>
      </span>
    </span>
  );
}

function formatDateValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const hasTime = value.includes("T") || value.includes(":");

  return new Intl.DateTimeFormat(
    "pt-BR",
    hasTime
      ? {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      : {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
  ).format(parsed);
}

function buildInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "--";
  }

  return parts.map(part => part[0]?.toUpperCase() ?? "").join("");
}

function abbreviatePersonName(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    return value.trim();
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const lastInitial = lastName[0]?.toUpperCase();

  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}

function shouldAbbreviateCreatedByOnCard(field: TaskFieldDefinition, label: string, context: string): boolean {
  if (context !== "card") {
    return false;
  }

  if (!matchesTaskFieldStorage(field, { kind: "item_property", property: "createdBy" })) {
    return false;
  }

  return label.trim().length > 0;
}

type FieldTypeSpecConfig = Omit<FieldTypeSpec, "type" | "label">;

function buildDefaultSpec(type: TaskFieldType, spec: FieldTypeSpecConfig): FieldTypeSpec {
  return {
    type,
    label: getTaskFieldRegistryEntry(type).label,
    normalizeValue: spec.normalizeValue ?? ((value, field) => getTaskFieldRegistryEntry(field.type).normalize(value)),
    parseValue: spec.parseValue,
    formatValue:
      spec.formatValue ??
      ((input: FieldTypeBehaviorInput) =>
        formatTaskFieldValue({
          field: input.field,
          value: input.value,
          boardConfig: input.boardConfig,
          statuses: input.statuses,
          membersById: input.membersById,
          availableTags: input.availableTags
        })),
    validateValue: spec.validateValue,
    components: spec.components
  };
}

export const taskFieldTypeSpecs: Record<TaskFieldType, FieldTypeSpec> = {
  text: buildDefaultSpec("text", {
    parseValue: input => (input == null ? "" : String(input)),
    components: {
      display: TextFieldDisplay,
      edit: TextFieldEdit,
      contexts: {
        card: { display: TextFieldCardDisplay },
        table: { display: TextFieldTableDisplay }
      }
    }
  }),
  long_text: buildDefaultSpec("long_text", {
    parseValue: input => (input == null ? "" : String(input)),
    components: {
      display: LongTextFieldDisplay,
      edit: LongTextFieldEdit,
      contexts: {
        card: { display: LongTextFieldCardDisplay },
        table: { display: TextFieldTableDisplay }
      }
    }
  }),
  number: buildDefaultSpec("number", {
    parseValue: input => {
      if (input == null || input === "") {
        return null;
      }

      return input as TaskCustomFieldValue;
    },
    components: {
      display: DefaultDisplayField,
      edit: NumberFieldEdit,
      contexts: {
        table: { display: TableValueField },
        card: { display: TableValueField }
      }
    }
  }),
  date: buildDefaultSpec("date", {
    validateValue: input => {
      if (typeof input.value !== "string" || input.value.length === 0) {
        return null;
      }

      return Number.isNaN(new Date(input.value).getTime()) ? "Informe uma data valida." : null;
    },
    components: {
      display: DateFieldDisplay,
      edit: DateFieldEdit,
      contexts: {
        table: { display: DateFieldTableDisplay },
        card: { display: DateFieldTableDisplay }
      }
    }
  }),
  datetime: buildDefaultSpec("datetime", {
    validateValue: input => {
      if (typeof input.value !== "string" || input.value.length === 0) {
        return null;
      }

      return Number.isNaN(new Date(input.value).getTime()) ? "Informe uma data e hora validas." : null;
    },
    components: {
      display: DateFieldDisplay,
      edit: DatetimeFieldEdit,
      contexts: {
        table: { display: DateFieldTableDisplay },
        card: { display: DateFieldTableDisplay }
      }
    }
  }),
  select: buildDefaultSpec("select", {
    components: {
      display: SelectFieldDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: SelectFieldTableDisplay }
      }
    }
  }),
  multi_select: buildDefaultSpec("multi_select", {
    components: {
      display: MultiSelectFieldDisplay,
      edit: MultiSelectFieldEdit,
      contexts: {
        table: { display: MultiSelectFieldTableDisplay },
        card: { display: MultiSelectFieldCardDisplay }
      }
    }
  }),
  boolean: buildDefaultSpec("boolean", {
    parseValue: input => input === true,
    components: {
      display: BooleanFieldDisplay,
      edit: BooleanFieldEdit,
      contexts: {
        table: { display: BooleanFieldDisplay },
        card: { display: BooleanFieldDisplay }
      }
    }
  }),
  user: buildDefaultSpec("user", {
    components: {
      display: UserFieldDisplay,
      edit: UserFieldEdit,
      contexts: {
        table: { display: UserFieldDisplay },
        card: { display: UserFieldDisplay }
      }
    }
  }),
  checklist: buildDefaultSpec("checklist", {
    validateValue: input => {
      if (input.value == null) {
        return null;
      }

      return isRecord(input.value) && Array.isArray(input.value.items) ? null : "Checklist invalido.";
    },
    components: {
      display: ChecklistFieldDisplay,
      edit: ChecklistFieldEdit,
      contexts: {
        table: { display: ChecklistFieldTableDisplay },
        card: { display: ChecklistFieldCardDisplay }
      }
    }
  }),
  priority: buildDefaultSpec("priority", {
    components: {
      display: SelectFieldDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: SelectFieldTableDisplay }
      }
    }
  }),
  status: buildDefaultSpec("status", {
    components: {
      display: SelectFieldDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: SelectFieldTableDisplay }
      }
    }
  }),
  tag: buildDefaultSpec("tag", {
    components: {
      display: MultiSelectFieldDisplay,
      edit: MultiSelectFieldEdit,
      contexts: {
        table: { display: MultiSelectFieldTableDisplay },
        card: { display: MultiSelectFieldCardDisplay }
      }
    }
  }),
  schedule: buildDefaultSpec("schedule", {
    validateValue: input => {
      if (!isRecord(input.value)) {
        return null;
      }

      const plannedStartAt = typeof input.value.plannedStartAt === "string" ? input.value.plannedStartAt : null;
      const plannedEndAt = typeof input.value.plannedEndAt === "string" ? input.value.plannedEndAt : null;
      const start = parseDateTime(plannedStartAt);
      const end = parseDateTime(plannedEndAt);

      if (start !== null && end !== null && end <= start) {
        return "A data final precisa ser maior que a inicial.";
      }

      return null;
    },
    components: {
      display: ScheduleFieldDisplay,
      edit: ScheduleFieldEdit,
      contexts: {
        table: { display: ScheduleFieldTableDisplay },
        card: { display: ScheduleFieldTableDisplay }
      }
    }
  }),
  work_item_type: buildDefaultSpec("work_item_type", {
    components: {
      display: WorkItemTypeDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: WorkItemTypeDisplay }
      }
    }
  })
};

export function getTaskFieldTypeSpec(type: TaskFieldType): FieldTypeSpec {
  return taskFieldTypeSpecs[type] ?? taskFieldTypeSpecs.text;
}

export function normalizeTaskFieldPresentationValue(field: TaskFieldDefinition, value: TaskCustomFieldValue): TaskCustomFieldValue {
  const spec = getTaskFieldTypeSpec(field.type);
  const parsedValue = spec.parseValue ? spec.parseValue(value, field) : value;

  if (spec.normalizeValue) {
    return spec.normalizeValue(parsedValue, field);
  }

  return getTaskFieldRegistryEntry(field.type).normalize(parsedValue);
}

export function validateTaskFieldPresentationValue(input: FieldTypeBehaviorInput): string | null {
  const spec = getTaskFieldTypeSpec(input.field.type);
  const normalizedValue = normalizeTaskFieldPresentationValue(input.field, input.value);

  return spec.validateValue?.({
    ...input,
    value: normalizedValue
  }) ?? null;
}
