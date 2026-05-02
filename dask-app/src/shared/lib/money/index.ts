interface FormatMoneyOptions {
  currency?: string;
  fallback?: string;
  locale?: string;
}

export function formatMoney(value: unknown, config: FormatMoneyOptions = {}): string {
  const rawValue = typeof value === "number" ? value : String(value ?? "0").replace(",", ".");
  const amount = Number(rawValue);
  if (!Number.isFinite(amount)) {
    return config.fallback ?? "-";
  }

  return new Intl.NumberFormat(config.locale ?? "pt-BR", {
    style: "currency",
    currency: config.currency ?? "BRL"
  }).format(amount);
}

export function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatMoney(value);
}
