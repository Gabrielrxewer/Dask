import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  formatTaskFieldValue,
  getTaskFieldRegistryEntry,
  matchesTaskFieldStorage
} from "@/entities/task/model/field-registry";
import type {
  TaskChecklist,
  TaskCustomFieldValue,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldOption,
  TaskFieldType
} from "@/entities/task/model/types";
import { TaskTypeIcon, resolveTaskTypeIconName, type TaskTypeIconName } from "@/entities/task/ui/task-type-icon";
import type {
  FieldPresentationComponentProps,
  FieldTypeBehaviorInput,
  FieldTypeSpec
} from "@/entities/task/ui/field-presentation/presentation-types";
import { Button, Select, TextInput, Textarea } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { DateTimePicker } from "./date-time-picker";

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

function getFieldSemantic(field: TaskFieldDefinition): string | null {
  if (typeof field.config?.semantic === "string") {
    return field.config.semantic;
  }

  return null;
}

function getNumberConfig(field: TaskFieldDefinition, key: "min" | "max" | "step"): number | undefined {
  const value = field.config?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function getTextInputType(field: TaskFieldDefinition): "email" | "tel" | "url" | "text" {
  const semantic = getFieldSemantic(field);
  if (semantic === "email") return "email";
  if (semantic === "phone") return "tel";
  if (semantic === "url") return "url";
  return "text";
}

function getTextInputMode(field: TaskFieldDefinition): "email" | "tel" | "url" | "text" {
  const semantic = getFieldSemantic(field);
  if (semantic === "email") return "email";
  if (semantic === "phone") return "tel";
  if (semantic === "url") return "url";
  return "text";
}

function getSemanticPlaceholder(field: TaskFieldDefinition): string | null {
  const semantic = getFieldSemantic(field);
  if (semantic === "email") return "nome@empresa.com";
  if (semantic === "phone") return "(11) 99999-9999";
  if (semantic === "url") return "https://...";
  if (semantic === "entity_reference") return "Gerado automaticamente";
  return null;
}

function getChecklistProgress(value: TaskChecklist) {
  const total = value.items.length;
  const done = value.items.filter(item => item.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, percent };
}

type ChecklistDisplayConfig = {
  label: string;
  color: string;
  icon: TaskTypeIconName;
};

const DEFAULT_CHECKLIST_DISPLAY: ChecklistDisplayConfig = {
  label: "Checklist",
  color: "var(--text-secondary)",
  icon: "checklist"
};

const CHECKLIST_ICON_OPTIONS = new Set<TaskTypeIconName>([
  "bug",
  "user",
  "checklist",
  "book",
  "layers",
  "flask",
  "alert",
  "wrench",
  "gear",
  "document"
]);

function sanitizeChecklistColor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_CHECKLIST_DISPLAY.color;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : DEFAULT_CHECKLIST_DISPLAY.color;
}

function resolveChecklistDisplayConfig(field: TaskFieldDefinition): ChecklistDisplayConfig {
  const source =
    isRecord(field.config) && isRecord(field.config.checklistDisplay)
      ? (field.config.checklistDisplay as Record<string, unknown>)
      : {};

  const label = typeof source.label === "string" && source.label.trim().length > 0
    ? source.label.trim()
    : field.label || DEFAULT_CHECKLIST_DISPLAY.label;
  const icon = typeof source.icon === "string" && CHECKLIST_ICON_OPTIONS.has(source.icon as TaskTypeIconName)
    ? (source.icon as TaskTypeIconName)
    : DEFAULT_CHECKLIST_DISPLAY.icon;

  return {
    label,
    color: sanitizeChecklistColor(source.color),
    icon
  };
}

function buildChecklistItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ChecklistInteractiveDisplay(props: FieldPresentationComponentProps & { compact?: boolean }) {
  const display = resolveChecklistDisplayConfig(props.field);
  const [isOpen, setIsOpen] = useState(false);
  const [draftItemLabel, setDraftItemLabel] = useState("");
  const [localChecklist, setLocalChecklist] = useState<TaskChecklist>(props.controller.checklistValue ?? { items: [] });
  const progress = getChecklistProgress(localChecklist);
  const canMutate = typeof props.onChange === "function" && !props.disabled && !props.readonly;
  const isSmallDisplay = resolveCardDisplaySize(props) === "small";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const compactChipStyle = isSmallDisplay
    ? ({ "--task-card-field-accent": display.color } as CSSProperties)
    : undefined;

  useEffect(() => {
    setLocalChecklist(props.controller.checklistValue ?? { items: [] });
  }, [props.controller.checklistValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const persistChecklist = (nextChecklist: TaskChecklist) => {
    setLocalChecklist(nextChecklist);
    props.onChange?.(nextChecklist);
  };

  const toggleItem = (itemId: string) => {
    persistChecklist({
      items: localChecklist.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done
            }
          : item
      )
    });
  };

  const addItem = () => {
    const nextLabel = draftItemLabel.trim();
    if (!nextLabel) {
      return;
    }

    persistChecklist({
      items: [
        ...localChecklist.items,
        {
          id: buildChecklistItemId(),
          label: nextLabel,
          done: false
        }
      ]
    });
    setDraftItemLabel("");
    setIsOpen(true);
  };

  const stopCardOpen = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "task-field-presentation__checklist-display",
        isSmallDisplay && "task-field-presentation__checklist-display--compact",
        isOpen && "is-open"
      )}
      style={{ "--task-checklist-accent": display.color } as CSSProperties}
      onClick={stopCardOpen}
      onMouseDown={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === " " || event.key === "Enter") {
          stopCardOpen(event);
        }
      }}
    >
      <button
        type="button"
        className={cn(
          "task-field-presentation__checklist-display-trigger",
          isSmallDisplay && "task-field-presentation__checklist-display-trigger--compact"
        )}
        onClick={event => {
          event.stopPropagation();
          setIsOpen(current => !current);
        }}
        aria-expanded={isOpen}
      >
        {isSmallDisplay ? (
          <span className="task-field-presentation__card-small task-field-presentation__checklist-display-chip" style={compactChipStyle}>
            <span
              className="task-field-presentation__checklist-display-badge task-field-presentation__card-mid-leading"
              aria-hidden="true"
            >
              <TaskTypeIcon name={display.icon} />
            </span>
            <span className="task-field-presentation__checklist-display-copy task-field-presentation__card-small-copy">
              <strong className="task-field-presentation__card-small-primary">{`${progress.done}/${progress.total}`}</strong>
            </span>
          </span>
        ) : (
          <>
            <span className="task-field-presentation__checklist-display-badge" aria-hidden="true">
              <TaskTypeIcon name={display.icon} />
            </span>
            <span className="task-field-presentation__checklist-display-copy">
              <strong>{display.label}</strong>
              <span>
                {progress.total === 0
                  ? "Sem itens"
                  : `${progress.total} ${progress.total === 1 ? "item" : "itens"}`}
              </span>
            </span>
          </>
        )}
        {!isSmallDisplay ? (
          <span className="task-field-presentation__checklist-display-metric">{`${progress.done}/${progress.total}`}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="task-field-presentation__checklist-display-panel">
          <div className="task-field-presentation__checklist-summary">
            <span>{`${progress.done}/${progress.total} concluidos`}</span>
            <span>{`${progress.percent}%`}</span>
          </div>
          <div className="task-field-presentation__checklist-progress">
            <div className="task-field-presentation__checklist-progress-bar" style={{ width: `${progress.percent}%` }} />
          </div>
          {localChecklist.items.length === 0 ? (
            <p className="task-field-presentation__placeholder">Nenhum item criado ainda.</p>
          ) : (
            <ul className="task-field-presentation__checklist-items">
              {localChecklist.items.map(item => (
                <li key={item.id} className={cn("task-field-presentation__check-item", item.done && "is-done")}>
                  <button
                    type="button"
                    className="task-field-presentation__check-toggle"
                    onClick={() => toggleItem(item.id)}
                    disabled={!canMutate}
                  >
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
          )}
          <div className="task-field-presentation__checklist-add">
            <TextInput
              value={draftItemLabel}
              onChange={event => setDraftItemLabel(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  addItem();
                }
              }}
              placeholder={`Novo item em ${display.label.toLowerCase()}...`}
              disabled={!canMutate}
            />
            <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={!draftItemLabel.trim() || !canMutate}>
              Adicionar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
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

type CardDisplaySize = "small" | "mid" | "title" | "description";

function resolveCardDisplaySize(props: Pick<FieldPresentationComponentProps, "context" | "cardArea">): CardDisplaySize {
  if (props.context !== "card") {
    return "mid";
  }

  if (props.cardArea === "title") {
    return "title";
  }

  if (props.cardArea === "description") {
    return "description";
  }

  if (props.cardArea === "badge" || props.cardArea === "meta" || props.cardArea === "tags") {
    return "small";
  }

  return "mid";
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildCardToneStyle(accent?: string | null): CSSProperties | undefined {
  if (!accent) {
    return undefined;
  }

  return {
    "--task-card-field-accent": accent
  } as CSSProperties;
}

function CardSmallDisplay({
  primary,
  secondary,
  accent,
  leading
}: {
  primary: string;
  secondary?: string | null;
  accent?: string | null;
  leading?: ReactNode;
}) {
  return (
    <span className="task-field-presentation__card-small" style={buildCardToneStyle(accent)}>
      {leading ? <span className="task-field-presentation__card-small-leading">{leading}</span> : null}
      <span className="task-field-presentation__card-small-copy">
        <span className="task-field-presentation__card-small-primary">{primary}</span>
        {secondary ? <span className="task-field-presentation__card-small-secondary">{secondary}</span> : null}
      </span>
    </span>
  );
}

function CardMidDisplay({
  primary,
  secondary,
  accent,
  leading
}: {
  primary: string;
  secondary?: string | null;
  accent?: string | null;
  leading?: ReactNode;
}) {
  return (
    <span className="task-field-presentation__card-mid" style={buildCardToneStyle(accent)}>
      {leading ? <span className="task-field-presentation__card-mid-leading">{leading}</span> : null}
      <span className="task-field-presentation__card-mid-copy">
        <span className="task-field-presentation__card-mid-primary">{primary}</span>
        {secondary ? <span className="task-field-presentation__card-mid-secondary">{secondary}</span> : null}
      </span>
    </span>
  );
}

function renderCardSizedDisplay(
  props: FieldPresentationComponentProps,
  input: {
    primary: string;
    secondary?: string | null;
    accent?: string | null;
    leading?: ReactNode;
  }
) {
  const size = resolveCardDisplaySize(props);

  if (size === "small") {
    return <CardSmallDisplay {...input} />;
  }

  return <CardMidDisplay {...input} />;
}

function shouldShowCardSecondary(props: Pick<FieldPresentationComponentProps, "cardArea" | "context">): boolean {
  if (props.context !== "card") {
    return true;
  }

  return (
    props.cardArea !== "badge" &&
    props.cardArea !== "meta" &&
    props.cardArea !== "tags" &&
    props.cardArea !== "summary" &&
    props.cardArea !== "custom-field"
  );
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

  if (getFieldSemantic(props.field) === "entity_reference") {
    return <span className="task-field-presentation__entity-reference">{props.controller.displayValue}</span>;
  }

  return <p className="task-field-presentation__text">{props.controller.displayValue}</p>;
}

function TextFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  const size = resolveCardDisplaySize(props);

  if (size === "title") {
    return <>{props.controller.displayValue}</>;
  }

  if (size === "description") {
    return <span className="task-field-presentation__text task-field-presentation__text--card">{props.controller.displayValue}</span>;
  }

  return renderCardSizedDisplay(props, {
    primary: truncateText(props.controller.displayValue, size === "small" ? 18 : 42)
  });
}

function TextFieldTableDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return renderEmpty(props.field);
  }

  return <span className="task-field-presentation__text task-field-presentation__text--table">{props.controller.displayValue}</span>;
}

function TextFieldEdit(props: FieldPresentationComponentProps) {
  const inputType = getTextInputType(props.field);

  return (
    <TextInput
      type={inputType}
      inputMode={getTextInputMode(props.field)}
      value={props.controller.stringValue}
      placeholder={props.placeholder ?? getSemanticPlaceholder(props.field) ?? `Ex: ${props.field.label}`}
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

  const size = resolveCardDisplaySize(props);

  if (size === "description") {
    return <span className="task-field-presentation__long-text task-field-presentation__long-text--card">{props.controller.displayValue}</span>;
  }

  return renderCardSizedDisplay(props, {
    primary: truncateText(props.controller.displayValue, size === "small" ? 18 : 46),
    secondary: size === "mid" ? "Texto longo" : null
  });
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
  const semantic = getFieldSemantic(props.field);

  return (
    <TextInput
      type="number"
      inputMode="decimal"
      min={getNumberConfig(props.field, "min")}
      max={getNumberConfig(props.field, "max")}
      step={getNumberConfig(props.field, "step") ?? (semantic === "percentage" ? 1 : "any")}
      placeholder={semantic === "currency" ? "0,00" : semantic === "percentage" ? "0 a 100" : undefined}
      value={props.controller.numberValue == null ? "" : String(props.controller.numberValue)}
      onChange={event => props.controller.setValue(event.target.value)}
      onBlur={props.onBlur}
      autoFocus={props.autoFocus}
      disabled={props.controller.disabled || props.controller.readonly}
    />
  );
}

function NumberFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.numberValue == null) {
    return null;
  }

  return renderCardSizedDisplay(props, {
    primary: props.controller.displayValue,
    secondary: resolveCardDisplaySize(props) === "mid" ? props.field.label : null
  });
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

function DateFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  return renderCardSizedDisplay(props, {
    primary: props.controller.displayValue,
    secondary: shouldShowCardSecondary(props) ? (props.field.type === "datetime" ? "Data e hora" : "Data") : null
  });
}

function DateFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <DateTimePicker
      mode="date"
      value={props.controller.stringValue ?? ""}
      onChange={val => props.controller.setValue(val)}
      disabled={props.controller.disabled || props.controller.readonly}
      autoFocus={props.autoFocus}
      placeholder="Definir data"
    />
  );
}

function DatetimeFieldEdit(props: FieldPresentationComponentProps) {
  return (
    <DateTimePicker
      mode="datetime"
      value={toDateTimeLocalInputValue(props.controller.stringValue)}
      onChange={val => props.controller.setValue(val)}
      disabled={props.controller.disabled || props.controller.readonly}
      autoFocus={props.autoFocus}
      placeholder="Definir data e hora"
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

function SelectFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  const option = props.controller.selectedOption;
  return renderCardSizedDisplay(props, {
    primary: option?.label ?? props.controller.displayValue,
    secondary: resolveCardDisplaySize(props) === "mid" && shouldShowCardSecondary(props) ? props.field.label : null,
    accent: option?.color ?? null
  });
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

function CatalogSelectFieldDisplay(props: FieldPresentationComponentProps) {
  const option = props.controller.selectedOption;
  if (!option) {
    return renderEmpty(props.field);
  }

  return (
    <span className="task-field-presentation__catalog-value">
      <svg className="task-field-presentation__catalog-icon" viewBox="0 0 16 16" fill="none" width="12" height="12" aria-hidden="true">
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5 6.5h6M5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {option.label}
    </span>
  );
}

function CatalogSelectFieldCardDisplay(props: FieldPresentationComponentProps) {
  const option = props.controller.selectedOption;
  return renderCardSizedDisplay(props, {
    primary: option?.label ?? props.controller.displayValue,
    secondary: resolveCardDisplaySize(props) === "mid" && shouldShowCardSecondary(props) ? props.field.label : null,
    accent: option?.color ?? null
  });
}

function CatalogSelectFieldEdit(props: FieldPresentationComponentProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedOption = props.controller.options.find(opt => opt.value === props.controller.stringValue) ?? null;

  const filtered = query.trim().length === 0
    ? props.controller.options
    : props.controller.options.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (value: string) => {
    props.controller.setValue(value);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    props.controller.setValue(null);
    setQuery("");
  };

  const inputDisplayValue = open ? query : (selectedOption?.label ?? "");

  const updateDropdownPosition = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {
      setDropdownStyle(null);
      return;
    }

    const gap = 4;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(220, openUp ? spaceAbove - gap : spaceBelow - gap));

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      width: rect.width,
      maxHeight,
      zIndex: 10050
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  return (
    <div ref={wrapRef} className="task-field-presentation__catalog-combobox" style={{ position: "relative" }}>
      <div className="task-field-presentation__catalog-input-row">
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          className="task-field-presentation__catalog-input"
          placeholder={props.controller.options.length === 0 ? "Nenhum item no catalogo" : "Buscar item..."}
          value={inputDisplayValue}
          disabled={props.controller.disabled || props.controller.readonly || props.controller.options.length === 0}
          autoFocus={props.autoFocus}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            window.requestAnimationFrame(updateDropdownPosition);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {selectedOption && !props.controller.readonly ? (
          <button
            type="button"
            className="task-field-presentation__catalog-clear"
            aria-label="Remover selecao"
            onMouseDown={e => { e.preventDefault(); handleClear(); }}
          >
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      {open && filtered.length > 0 && dropdownStyle ? createPortal(
        <ul
          className="task-field-presentation__catalog-dropdown task-field-presentation__catalog-dropdown--portal"
          role="listbox"
          style={dropdownStyle}
        >
          {filtered.map(opt => (
            <li
              key={opt.id}
              role="option"
              aria-selected={opt.value === props.controller.stringValue}
              className={cn(
                "task-field-presentation__catalog-option",
                opt.value === props.controller.stringValue && "task-field-presentation__catalog-option--selected"
              )}
              onMouseDown={() => handleSelect(opt.value)}
            >
              {opt.color ? (
                <span className="task-field-presentation__catalog-dot" style={{ background: opt.color }} />
              ) : null}
              <span className="task-field-presentation__catalog-option-label">{opt.label}</span>
            </li>
          ))}
        </ul>,
        document.body
      ) : null}
    </div>
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

  const size = resolveCardDisplaySize(props);
  if (size === "small") {
    const first = props.controller.selectedOptions[0];
    const extra = props.controller.selectedOptions.length - 1;
    return renderCardSizedDisplay(props, {
      primary: first?.label ?? "Selecionado",
      secondary: extra > 0 ? `+${extra}` : null,
      accent: first?.color ?? null
    });
  }

  return renderCardSizedDisplay(props, {
    primary: `${props.controller.selectedOptions.length} itens`,
    secondary: props.controller.selectedOptions.slice(0, 2).map(option => option.label).join(", ")
  });
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
          placeholder="Adicionar tag"
          disabled={props.controller.disabled || props.controller.readonly}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="task-field-presentation__add-button"
          onClick={addEntry}
          disabled={!draftValue.trim()}
          aria-label="Adicionar tag"
          title="Adicionar tag"
        >
          +
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
        color: props.controller.booleanValue ? "var(--brand-blue)" : "var(--text-muted)"
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

function BooleanFieldCardDisplay(props: FieldPresentationComponentProps) {
  return renderCardSizedDisplay(props, {
    primary: props.controller.booleanValue ? "Ativado" : "Desativado",
    secondary: resolveCardDisplaySize(props) === "mid" && shouldShowCardSecondary(props) ? props.field.label : null,
    accent: props.controller.booleanValue ? "var(--brand-blue)" : "var(--text-muted)"
  });
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
    const accentColor = option?.color ?? props.membersById?.[props.controller.stringValue]?.color ?? "var(--text-muted)";

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

function UserFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (props.controller.isEmpty) {
    return null;
  }

  const option = props.controller.selectedOption;
  const fullLabel = option?.label ?? props.controller.displayValue;
  const shortLabel = shouldAbbreviateCreatedByOnCard(props.field, fullLabel, "card")
    ? abbreviatePersonName(fullLabel)
    : fullLabel;

  return renderCardSizedDisplay(props, {
    primary: shortLabel,
    secondary: resolveCardDisplaySize(props) === "mid" && shouldShowCardSecondary(props) ? props.field.label : null,
    accent: option?.color ?? props.membersById?.[props.controller.stringValue]?.color ?? "var(--text-muted)",
    leading: <span className="task-field-presentation__card-avatar">{buildInitials(shortLabel)}</span>
  });
}

function ChecklistFieldDisplay(props: FieldPresentationComponentProps) {
  return <ChecklistInteractiveDisplay {...props} />;
}

function ChecklistFieldCardDisplay(props: FieldPresentationComponentProps) {
  if (typeof props.onChange !== "function" || props.disabled || props.readonly) {
    const display = resolveChecklistDisplayConfig(props.field);
    const checklist = props.controller.checklistValue ?? { items: [] };
    const progress = getChecklistProgress(checklist);

    if (progress.total === 0) {
      return renderCardSizedDisplay(props, {
        primary: display.label,
        secondary: shouldShowCardSecondary(props) ? "Sem itens" : null,
        accent: display.color,
        leading: <TaskTypeIcon name={display.icon} />
      });
    }

    return renderCardSizedDisplay(props, {
      primary: display.label,
      secondary:
        resolveCardDisplaySize(props) === "small"
          ? `${progress.done}/${progress.total}`
          : `${progress.total} ${progress.total === 1 ? "item" : "itens"}`,
      accent: display.color,
      leading: <TaskTypeIcon name={display.icon} />
    });
  }

  return <ChecklistInteractiveDisplay {...props} />;
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
          id: buildChecklistItemId(),
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
          placeholder="Novo item"
          disabled={props.controller.disabled || props.controller.readonly}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="task-field-presentation__add-button"
          onClick={addItem}
          disabled={!draftItemLabel.trim()}
          aria-label="Adicionar item"
          title="Adicionar item"
        >
          +
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

function ScheduleFieldCardDisplay(props: FieldPresentationComponentProps) {
  const schedule = props.controller.recordValue ?? {};
  const plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : "";
  const plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : "";

  if (!plannedStartAt && !plannedEndAt) {
    return null;
  }

  return renderCardSizedDisplay(props, {
    primary: [plannedStartAt, plannedEndAt].filter(Boolean).map(formatDateValue).join(" - "),
    secondary: resolveCardDisplaySize(props) === "mid" && shouldShowCardSecondary(props) ? "Planejamento" : null
  });
}

function ScheduleFieldEdit(props: FieldPresentationComponentProps) {
  const schedule = props.controller.recordValue ?? {};
  const plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : "";
  const plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : "";
  const disabled = props.controller.disabled || props.controller.readonly;

  const startLocal = toDateTimeLocalInputValue(plannedStartAt);
  const endLocal = toDateTimeLocalInputValue(plannedEndAt);

  const hasStart = startLocal.length > 0;
  const hasEnd = endLocal.length > 0;

  const startTs = parseDateTime(plannedStartAt);
  const endTs = parseDateTime(plannedEndAt);
  const endBeforeStart = startTs !== null && endTs !== null && endTs <= startTs;

  return (
    <div className="task-field-presentation__schedule-grid">
      <div className={`task-field-presentation__schedule-card task-field-presentation__schedule-card--start${hasStart ? " is-filled" : ""}`}>
        <span className="task-field-presentation__schedule-label">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Início
        </span>
        <DateTimePicker
          mode="datetime"
          value={startLocal}
          onChange={val => props.controller.setValue({ plannedStartAt: val, plannedEndAt: plannedEndAt || null })}
          disabled={disabled}
          placeholder="Definir data de início"
        />
      </div>

      <div className={`task-field-presentation__schedule-card task-field-presentation__schedule-card--end${hasEnd ? " is-filled" : ""}${endBeforeStart ? " is-invalid" : ""}`}>
        <span className="task-field-presentation__schedule-label">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1.5" y="2" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8.5 1v2M3.5 1v2M1.5 5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Fim
        </span>
        <DateTimePicker
          mode="datetime"
          value={endLocal}
          onChange={val => props.controller.setValue({ plannedStartAt: plannedStartAt || null, plannedEndAt: val })}
          disabled={disabled}
          placeholder="Definir data de fim"
        />
      </div>

      {endBeforeStart && (
        <p className="task-field-presentation__schedule-warning">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1L13 12H1L7 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          A data de fim deve ser posterior ao início.
        </p>
      )}
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
    const size = resolveCardDisplaySize(props);

    if (size === "small") {
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

    return renderCardSizedDisplay(props, {
      primary: taskType.label,
      secondary: shouldShowCardSecondary(props) ? "Tipo" : null,
      accent: taskType.text,
      leading: <TaskTypeIcon name={iconName} />
    });
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
    validateValue: input => {
      const semantic = getFieldSemantic(input.field);
      if (typeof input.value !== "string" || input.value.trim().length === 0) {
        return null;
      }

      if (semantic === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        return "Informe um email valido.";
      }

      if (semantic === "url") {
        try {
          const parsed = new URL(input.value.trim());
          return parsed.protocol === "http:" || parsed.protocol === "https:" ? null : "Informe uma URL http ou https.";
        } catch {
          return "Informe uma URL valida.";
        }
      }

      return null;
    },
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
    validateValue: input => {
      if (input.value == null || input.value === "") {
        return null;
      }

      const value = typeof input.value === "number" ? input.value : Number(input.value);
      if (!Number.isFinite(value)) {
        return "Informe um numero valido.";
      }

      const min = getNumberConfig(input.field, "min");
      const max = getNumberConfig(input.field, "max");
      if (typeof min === "number" && value < min) {
        return `Informe um valor maior ou igual a ${min}.`;
      }

      if (typeof max === "number" && value > max) {
        return `Informe um valor menor ou igual a ${max}.`;
      }

      return null;
    },
    components: {
      display: DefaultDisplayField,
      edit: NumberFieldEdit,
      contexts: {
        table: { display: TableValueField },
        card: { display: NumberFieldCardDisplay }
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
        card: { display: DateFieldCardDisplay }
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
        card: { display: DateFieldCardDisplay }
      }
    }
  }),
  select: buildDefaultSpec("select", {
    components: {
      display: SelectFieldDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: SelectFieldCardDisplay }
      }
    }
  }),
  catalog_select: buildDefaultSpec("catalog_select", {
    components: {
      display: CatalogSelectFieldDisplay,
      edit: CatalogSelectFieldEdit,
      contexts: {
        table: { display: CatalogSelectFieldDisplay },
        card: { display: CatalogSelectFieldCardDisplay }
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
        card: { display: BooleanFieldCardDisplay }
      }
    }
  }),
  user: buildDefaultSpec("user", {
    components: {
      display: UserFieldDisplay,
      edit: UserFieldEdit,
      contexts: {
        table: { display: UserFieldDisplay },
        card: { display: UserFieldCardDisplay }
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
        card: { display: SelectFieldCardDisplay }
      }
    }
  }),
  status: buildDefaultSpec("status", {
    components: {
      display: SelectFieldDisplay,
      edit: SelectFieldEdit,
      contexts: {
        table: { display: SelectFieldTableDisplay },
        card: { display: SelectFieldCardDisplay }
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
        card: { display: ScheduleFieldCardDisplay }
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
