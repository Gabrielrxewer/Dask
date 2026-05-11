import { AppError } from '@/core/errors/app-error';
import type { DashboardFilter, DashboardFilters, SerializedDashboardFilters } from '@/modules/dashboard/dashboard.types';

const filterLabels: Record<DashboardFilter['key'], string> = {
  from: 'Inicio',
  to: 'Fim',
  assigneeId: 'Responsavel',
  itemTypeId: 'Tipo de card',
  stateId: 'Estado',
  columnId: 'Coluna',
  workflowId: 'Workflow',
  status: 'Status'
};

const stringFilterKeys = ['assigneeId', 'itemTypeId', 'stateId', 'columnId', 'workflowId', 'status'] as const;

type StringFilterKey = (typeof stringFilterKeys)[number];

function readSingleString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseIsoDate(value: string | undefined, key: 'from' | 'to'): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid dashboard filter '${key}'. Use ISO date format.`, 422);
  }

  return parsed;
}

function validateToken(value: string, key: string): void {
  if (value.length > 128) {
    throw new AppError(`Invalid dashboard filter '${key}'.`, 422);
  }
}

export class DashboardFiltersService {
  public parse(query: unknown): DashboardFilters {
    const source = query && typeof query === 'object' && !Array.isArray(query)
      ? query as Record<string, unknown>
      : {};

    const from = parseIsoDate(readSingleString(source, 'from'), 'from');
    const to = parseIsoDate(readSingleString(source, 'to'), 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new AppError("Dashboard filter 'from' must be before 'to'.", 422);
    }

    const filters: DashboardFilters = {
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    };

    for (const key of stringFilterKeys) {
      const value = readSingleString(source, key);
      if (value) {
        validateToken(value, key);
        filters[key] = value;
      }
    }

    return filters;
  }

  public serialize(filters: DashboardFilters): SerializedDashboardFilters {
    return {
      ...(filters.from ? { from: filters.from.toISOString() } : {}),
      ...(filters.to ? { to: filters.to.toISOString() } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.itemTypeId ? { itemTypeId: filters.itemTypeId } : {}),
      ...(filters.stateId ? { stateId: filters.stateId } : {}),
      ...(filters.columnId ? { columnId: filters.columnId } : {}),
      ...(filters.workflowId ? { workflowId: filters.workflowId } : {}),
      ...(filters.status ? { status: filters.status } : {})
    };
  }

  public toWidgetFilters(filters: DashboardFilters, keys: DashboardFilter['key'][]): DashboardFilter[] {
    const serialized = this.serialize(filters);

    return keys.flatMap((key) => {
      const value = serialized[key];
      return value ? [{ key, label: filterLabels[key], value }] : [];
    });
  }

  public pickStringFilter(filters: DashboardFilters, key: StringFilterKey): string | undefined {
    return filters[key];
  }
}
