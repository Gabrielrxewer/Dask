function parseIsoDate(isoDate: string): Date | null {
  const raw = isoDate.trim();
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(isoDate: string, locale = "pt-BR"): string {
  const date = parseIsoDate(isoDate);
  if (!date) {
    return "Sem prazo";
  }

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(date);
}

export function isDateWithinNextDays(isoDate: string, days: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const target = parseIsoDate(isoDate);
  if (!target) {
    return false;
  }

  return target >= today && target <= end;
}
