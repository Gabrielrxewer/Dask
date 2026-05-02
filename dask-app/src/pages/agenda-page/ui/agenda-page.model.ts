import type { Task } from "@/entities/task";

export type AgendaSegment = {
  id: string;
  start: number;
  end: number;
  title: string;
  subtitle: string;
  tone: {
    background: string;
    border: string;
    text: string;
  };
  taskId?: string;
  lane: number;
  laneCount: number;
};

export type PlannedTask = {
  task: Task;
  window: { start: number; end: number; explicit: boolean };
};

export type AvailabilityMode = "people" | "resources";
export type DetailKind = "person" | "resource";
export type AvailabilityState = "free" | "partial" | "busy" | "conflict";

export type AvailabilityRow = {
  id: string;
  label: string;
  tasks: PlannedTask[];
  detailKind: DetailKind;
  subtitle?: string;
};

export type AvailabilitySlot = {
  key: string;
  startOffset: number;
  endOffset: number;
  state: AvailabilityState;
  tasks: PlannedTask[];
  slotStart: number;
  slotEnd: number;
};

export type AvailabilityRowSnapshot = AvailabilityRow & {
  slots: AvailabilitySlot[];
  occupiedCount: number;
};

export type DetailTarget = {
  id: string;
  label: string;
  kind: DetailKind;
};

export type SlotInspection = {
  rowLabel: string;
  rowKind: DetailKind;
  state: AvailabilityState;
  tasks: PlannedTask[];
  slotStart: number;
  slotEnd: number;
};

export type UnscheduledGroup = {
  assigneeId: string;
  label: string;
  tasks: Task[];
  totalCount: number;
  plannedCount: number;
  doneCount: number;
  unscheduledCount: number;
};

export const MINUTE_MS = 1000 * 60;
export const DAY_MS = 1000 * 60 * 60 * 24;
export const AGENDA_START_HOUR = 6;
export const AGENDA_END_HOUR = 22;
export const SLOT_MINUTES = 30;
export const AGENDA_ROW_HEIGHT = 34;
export const RESOURCE_KEYS = ["resource", "resources", "recurso", "recursos", "room", "sala", "equipment", "equipamento"];

export function toHourLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function toAgendaDayLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

export function toWeekRangeLabel(weekStart: number): string {
  const weekEnd = addDays(weekStart, 6);
  return `${toAgendaDayLabel(weekStart)} - ${toAgendaDayLabel(weekEnd)}`;
}

export function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function startOfDay(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfWeek(value: number): number {
  const dayStart = startOfDay(value);
  const weekday = new Date(dayStart).getDay();
  const distanceToMonday = (weekday + 6) % 7;
  return dayStart - distanceToMonday * DAY_MS;
}

export function addDays(value: number, days: number): number {
  return value + days * DAY_MS;
}

export function resolvePlannedWindow(task: Task): { start: number; end: number; explicit: boolean } | null {
  const plannedStart = parseDateTime(task.plannedStartAt);
  const plannedEnd = parseDateTime(task.plannedEndAt);
  if (plannedStart === null && plannedEnd === null) {
    return null;
  }
  const fallbackStart = plannedStart ?? plannedEnd ?? Date.now();
  const fallbackEnd = plannedEnd ?? fallbackStart + 1000 * 60 * 60;
  const normalizedEnd = fallbackEnd > fallbackStart ? fallbackEnd : fallbackStart + 1000 * 60 * 30;
  return { start: fallbackStart, end: normalizedEnd, explicit: true };
}

export function normalizeResourceKey(value: string): string {
  return value
    .trim()
    .replace(/^recurso:\s*/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function extractTaskResources(task: Task): Array<{ id: string; label: string }> {
  const values = RESOURCE_KEYS.flatMap((key) => {
    const raw = task.customFields[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.split(",").map(part => part.trim()).filter(Boolean);
    }
    if (Array.isArray(raw)) {
      return raw.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
    }
    return [];
  });

  const fallback = task.tags
    .filter(tag => tag.toLowerCase().startsWith("recurso:"))
    .map(tag => tag.split(":")[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const allValues = values.length > 0 ? values : fallback;
  const byId = new Map<string, string>();

  allValues.forEach((value) => {
    const id = normalizeResourceKey(value);
    if (!id) {
      return;
    }
    if (!byId.has(id)) {
      byId.set(id, value.trim());
    }
  });

  return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
}

export function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return endA > startB && startA < endB;
}

export function getOverlapDuration(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export function getInitialSelectedDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

export function getStateLabel(state: AvailabilityState, count: number): string {
  if (state === "conflict") {
    return `Conflito (${count})`;
  }
  if (state === "busy") {
    return "Ocupado";
  }
  if (state === "partial") {
    return "Parcial";
  }
  return "Livre";
}
