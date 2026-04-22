import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CELL_H = 32; // px — height of each time cell
const CELL_GAP = 3; // px — gap between cells
const CELL_STEP = CELL_H + CELL_GAP;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(dateStr: string, timeStr: string, mode: "date" | "datetime"): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const base = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (mode === "datetime" && timeStr) return `${base}  ${timeStr}`;
  return base;
}

function buildCalendarGrid(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: Array<{ label: number; dateStr: string; inMonth: boolean }> = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ label: d, dateStr: toLocalDateStr(new Date(year, month - 1, d)), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ label: d, dateStr: toLocalDateStr(new Date(year, month, d)), inMonth: true });
  }
  while (cells.length < 42) {
    const d = cells.length - firstWeekday - daysInMonth + 1;
    cells.push({ label: d, dateStr: toLocalDateStr(new Date(year, month + 1, d)), inMonth: false });
  }
  return cells;
}

function parseHM(timeStr: string): { h: number; m: number } {
  const [hPart, mPart] = timeStr.split(":");
  const h = parseInt(hPart ?? "");
  const m = parseInt(mPart ?? "");
  return {
    h: Number.isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
    m: Number.isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
  };
}

function snapMinute(m: number): number {
  return MINUTES.reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
}

function normalizeTime(timeStr: string): string {
  if (!timeStr) return "";
  const { h, m } = parseHM(timeStr);
  return `${pad(h)}:${pad(snapMinute(m))}`;
}

function scrollToCenter(el: HTMLDivElement | null, index: number) {
  if (!el) return;
  const top = index * CELL_STEP - el.clientHeight / 2 + CELL_H / 2;
  el.scrollTop = Math.max(0, top);
}

// ── Time Selector ────────────────────────────────────────────────────────────

interface TimeSelectorProps {
  h: number;
  m: number;
  hasTime: boolean;
  onChangeH: (h: number) => void;
  onChangeM: (m: number) => void;
}

function TimeSelector({ h, m, hasTime, onChangeH, onChangeM }: TimeSelectorProps) {
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const minIndex = MINUTES.indexOf(m);

  // Scroll on mount and when selection changes
  useLayoutEffect(() => {
    scrollToCenter(hourRef.current, h);
  }, [h]);

  useLayoutEffect(() => {
    if (minIndex >= 0) scrollToCenter(minRef.current, minIndex);
  }, [minIndex]);

  return (
    <div className="dtp__time-selector">
      {/* Current time display */}
      <div className="dtp__time-display" aria-live="polite">
        <span className={`dtp__time-display-val${!hasTime ? " is-empty" : ""}`}>{pad(h)}</span>
        <span className="dtp__time-display-sep">:</span>
        <span className={`dtp__time-display-val${!hasTime ? " is-empty" : ""}`}>{pad(m)}</span>
      </div>

      {/* Scroll columns */}
      <div className="dtp__time-cols">
        <div className="dtp__time-col">
          <span className="dtp__time-col-label">Hora</span>
          <div className="dtp__time-scroll" ref={hourRef} role="listbox" aria-label="Hora">
            {HOURS.map(hVal => (
              <button
                key={hVal}
                type="button"
                role="option"
                aria-selected={hVal === h}
                className={`dtp__time-cell${hVal === h && hasTime ? " is-selected" : ""}`}
                onClick={() => onChangeH(hVal)}
              >
                {pad(hVal)}
              </button>
            ))}
          </div>
        </div>

        <div className="dtp__time-divider" aria-hidden="true">:</div>

        <div className="dtp__time-col">
          <span className="dtp__time-col-label">Min</span>
          <div className="dtp__time-scroll" ref={minRef} role="listbox" aria-label="Minuto">
            {MINUTES.map(mVal => (
              <button
                key={mVal}
                type="button"
                role="option"
                aria-selected={mVal === m}
                className={`dtp__time-cell${mVal === m && hasTime ? " is-selected" : ""}`}
                onClick={() => onChangeM(mVal)}
              >
                {pad(mVal)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: "date" | "datetime";
  autoFocus?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Definir data",
  mode = "datetime",
  autoFocus = false
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Local draft state — only committed on "Aplicar"
  const [localDate, setLocalDate] = useState("");
  const [localH, setLocalH] = useState(0);
  const [localM, setLocalM] = useState(0);
  const [hasTime, setHasTime] = useState(false);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const todayStr = toLocalDateStr(new Date());

  const syncFromValue = () => {
    const [d = "", t = ""] = value.includes("T") ? value.split("T") : [value, ""];
    setLocalDate(d);

    if (d) {
      const parts = d.split("-");
      const y = parseInt(parts[0] ?? "");
      const mo = parseInt(parts[1] ?? "") - 1;
      if (!Number.isNaN(y) && !Number.isNaN(mo)) { setViewYear(y); setViewMonth(mo); }
    } else {
      setViewYear(new Date().getFullYear());
      setViewMonth(new Date().getMonth());
    }

    if (t && mode === "datetime") {
      const { h, m } = parseHM(t);
      setLocalH(h);
      setLocalM(snapMinute(m)); // normalize to nearest 5-min step
      setHasTime(true);
    } else {
      setLocalH(0);
      setLocalM(0);
      setHasTime(false);
    }
  };

  const openPicker = () => {
    if (disabled) return;
    syncFromValue();
    setIsOpen(true);
  };

  const buildResult = () => {
    if (!localDate) return null;
    if (mode === "date") return localDate;
    return `${localDate}T${pad(localH)}:${pad(localM)}`;
  };

  const apply = () => {
    onChange(buildResult());
    setIsOpen(false);
  };

  const clear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const discard = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) discard();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") discard();
      if (e.key === "Enter") apply();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, localDate, localH, localM]);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells = buildCalendarGrid(viewYear, viewMonth);

  const [rawD = "", rawT = ""] = value.includes("T") ? value.split("T") : [value, ""];
  const displayValue = formatDisplay(rawD, rawT, mode);
  const hasFilled = rawD.length > 0;

  const handleDayClick = (dateStr: string) => {
    setLocalDate(dateStr);
    if (mode === "datetime" && !hasTime) setHasTime(true);
  };

  const goToday = () => {
    setLocalDate(todayStr);
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth());
    if (mode === "datetime" && !hasTime) setHasTime(true);
  };

  return (
    <div ref={containerRef} className="dtp">
      <button
        ref={triggerRef}
        type="button"
        className={`dtp__trigger${hasFilled ? " is-filled" : ""}${isOpen ? " is-open" : ""}`}
        onClick={openPicker}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg className="dtp__trigger-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="2.5" width="12" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 1v3M4 1v3M1 6h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="dtp__trigger-value">{displayValue || placeholder}</span>
        {hasFilled && !disabled && (
          <span
            className="dtp__trigger-clear"
            role="button"
            tabIndex={0}
            aria-label="Limpar data"
            onClick={e => { e.stopPropagation(); clear(); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); clear(); } }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="dtp__popover" role="dialog" aria-label="Selecionar data">
          {/* Nav */}
          <div className="dtp__nav">
            <button type="button" className="dtp__nav-btn" onClick={prevMonth} aria-label="Mês anterior">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M8.5 10.5L4.5 6.5l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="dtp__today-link" onClick={goToday}>
              {MONTHS_PT[viewMonth]} {viewYear}
            </button>
            <button type="button" className="dtp__nav-btn" onClick={nextMonth} aria-label="Próximo mês">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Calendar grid */}
          <div className="dtp__grid" role="grid">
            {DAYS_SHORT.map(d => (
              <span key={d} className="dtp__day-header" role="columnheader">{d}</span>
            ))}
            {cells.map(cell => (
              <button
                key={cell.dateStr}
                type="button"
                role="gridcell"
                className={[
                  "dtp__day",
                  !cell.inMonth && "is-outside",
                  cell.dateStr === todayStr && "is-today",
                  cell.dateStr === localDate && "is-selected"
                ].filter(Boolean).join(" ")}
                onClick={() => handleDayClick(cell.dateStr)}
              >
                {cell.label}
              </button>
            ))}
          </div>

          {/* Time selector */}
          {mode === "datetime" && (
            <div className="dtp__time-row">
              <TimeSelector
                h={localH}
                m={localM}
                hasTime={hasTime}
                onChangeH={h => { setLocalH(h); setHasTime(true); }}
                onChangeM={m => { setLocalM(m); setHasTime(true); }}
              />
            </div>
          )}

          {/* Footer */}
          <div className="dtp__footer">
            <button type="button" className="dtp__clear-btn" onClick={clear}>
              Limpar
            </button>
            <button type="button" className="dtp__apply-btn" onClick={apply} disabled={!localDate}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
