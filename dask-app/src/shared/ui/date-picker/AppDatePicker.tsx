import { useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { AppIcon } from "@/shared/ui/icon";
import { AppPopover } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/cn";

export interface AppDatePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  closeOnSelect?: boolean;
  className?: string;
  triggerClassName?: string;
  calendarClassName?: string;
  "aria-label"?: string;
}

export interface AppDateTimePickerProps extends Omit<AppDatePickerProps, "onChange"> {
  value?: string | null;
  onChange: (value: string | null) => void;
  minuteStep?: number;
}

export interface AppDateRangeValue {
  from?: string | null;
  to?: string | null;
}

export interface AppDateRangePickerProps {
  value?: AppDateRangeValue | null;
  onChange: (value: AppDateRangeValue | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  calendarClassName?: string;
  "aria-label"?: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function datePart(value?: string | null): string {
  return value?.split("T")[0] ?? "";
}

function parseDate(value?: string | null): Date | undefined {
  const rawDate = datePart(value);
  if (!rawDate) return undefined;
  const [yearRaw, monthRaw, dayRaw] = rawDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayDate(value?: string | null): string {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
}

function parseTime(value?: string | null): string {
  const rawTime = value?.split("T")[1]?.slice(0, 5);
  return rawTime && /^\d{2}:\d{2}$/.test(rawTime) ? rawTime : "09:00";
}

function displayDateTime(value?: string | null): string {
  const dateLabel = displayDate(value);
  if (!dateLabel) return "";
  const time = value?.includes("T") ? parseTime(value) : "";
  return time ? `${dateLabel} ${time}` : dateLabel;
}

function formatRangeLabel(value?: AppDateRangeValue | null, placeholder = "Selecionar periodo"): string {
  const from = displayDate(value?.from);
  const to = displayDate(value?.to);
  if (from && to) return `${from} - ${to}`;
  if (from) return `${from} - ...`;
  if (to) return `... - ${to}`;
  return placeholder;
}

export function AppDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Selecionar data",
  closeOnSelect = true,
  className,
  triggerClassName,
  calendarClassName,
  "aria-label": ariaLabel = "Selecionar data"
}: AppDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDate(value), [value]);
  const label = displayDate(value);

  return (
    <AppPopover
      open={open}
      onOpenChange={setOpen}
      align="start"
      sideOffset={8}
      contentClassName={cn("app-date-picker__popover", calendarClassName)}
      trigger={(
        <button
          type="button"
          className={cn("app-date-picker__trigger", triggerClassName, className)}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <AppIcon name="calendar-check" size={15} />
          <span className={cn(!label && "app-date-picker__placeholder")}>{label || placeholder}</span>
          {value && !disabled ? (
            <span
              className="app-date-picker__clear"
              role="button"
              tabIndex={0}
              aria-label="Limpar data"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                  setOpen(false);
                }
              }}
            >
              <AppIcon name="x" size={13} />
            </span>
          ) : null}
        </button>
      )}
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => {
          onChange(date ? formatDate(date) : null);
          if (date && closeOnSelect) setOpen(false);
        }}
        disabled={disabled}
        className="app-date-picker__calendar"
      />
    </AppPopover>
  );
}

export function AppDateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Selecionar data e hora",
  minuteStep = 5,
  className,
  triggerClassName,
  calendarClassName,
  "aria-label": ariaLabel = "Selecionar data e hora"
}: AppDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(datePart(value));
  const [draftTime, setDraftTime] = useState(parseTime(value));
  const selected = useMemo(() => parseDate(draftDate), [draftDate]);
  const label = displayDateTime(value);

  const syncDraft = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraftDate(datePart(value));
      setDraftTime(parseTime(value));
    }
  };

  const commit = () => {
    onChange(draftDate ? `${draftDate}T${draftTime}` : null);
    setOpen(false);
  };

  return (
    <AppPopover
      open={open}
      onOpenChange={syncDraft}
      align="start"
      sideOffset={8}
      contentClassName={cn("app-date-picker__popover app-date-picker__popover--datetime", calendarClassName)}
      trigger={(
        <button
          type="button"
          className={cn("app-date-picker__trigger", triggerClassName, className)}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <AppIcon name="calendar-check" size={15} />
          <span className={cn(!label && "app-date-picker__placeholder")}>{label || placeholder}</span>
          {value && !disabled ? (
            <span
              className="app-date-picker__clear"
              role="button"
              tabIndex={0}
              aria-label="Limpar data e hora"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
            >
              <AppIcon name="x" size={13} />
            </span>
          ) : null}
        </button>
      )}
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => setDraftDate(date ? formatDate(date) : "")}
        disabled={disabled}
        className="app-date-picker__calendar"
      />
      <div className="app-date-picker__time-row">
        <label className="app-date-picker__time-field">
          <span>Horario</span>
          <input
            type="time"
            value={draftTime}
            step={minuteStep * 60}
            onChange={(event) => setDraftTime(event.target.value)}
            disabled={disabled}
          />
        </label>
        <div className="app-date-picker__actions">
          <button type="button" className="app-date-picker__secondary-action" onClick={() => onChange(null)}>
            Limpar
          </button>
          <button type="button" className="app-date-picker__primary-action" onClick={commit} disabled={!draftDate || disabled}>
            Aplicar
          </button>
        </div>
      </div>
    </AppPopover>
  );
}

export function AppDateRangePicker({
  value,
  onChange,
  disabled,
  placeholder = "Selecionar periodo",
  className,
  triggerClassName,
  calendarClassName,
  "aria-label": ariaLabel = "Selecionar periodo"
}: AppDateRangePickerProps) {
  const selected = useMemo<DateRange | undefined>(() => {
    const from = parseDate(value?.from);
    const to = parseDate(value?.to);
    return from || to ? { from, to } : undefined;
  }, [value?.from, value?.to]);

  return (
    <AppPopover
      trigger={(
        <button
          type="button"
          className={cn("app-date-picker__trigger", triggerClassName, className)}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <AppIcon name="calendar-check" size={15} />
          <span className={cn(!value?.from && !value?.to && "app-date-picker__placeholder")}>
            {formatRangeLabel(value, placeholder)}
          </span>
        </button>
      )}
      contentClassName={cn("app-date-picker__popover", calendarClassName)}
      align="start"
      sideOffset={8}
    >
      <DayPicker
        mode="range"
        selected={selected}
        onSelect={(range) => {
          const nextValue = range?.from || range?.to
            ? {
                from: range.from ? formatDate(range.from) : null,
                to: range.to ? formatDate(range.to) : null
              }
            : null;
          onChange(nextValue);
        }}
        disabled={disabled}
        className="app-date-picker__calendar"
      />
    </AppPopover>
  );
}
