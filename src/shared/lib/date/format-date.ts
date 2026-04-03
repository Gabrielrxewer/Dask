export function formatShortDate(isoDate: string, locale = "pt-BR"): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(date);
}

export function isDateWithinNextDays(isoDate: string, days: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const target = new Date(`${isoDate}T00:00:00`);
  return target >= today && target <= end;
}
