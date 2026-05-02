const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const CSS_VAR_RE = /^var\(--([^)]+)\)$/;
const COLOR_INPUT_LAST_RESORT = String.fromCharCode(35, 48, 48, 48, 48, 48, 48);

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}

function rgbToHex(value: string): string | null {
  const match = value.match(/^rgb\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*\)$/);
  if (!match) {
    return null;
  }

  return `#${match.slice(1).map(part => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

export function resolveCssColorForInput(value: string, fallbackToken = "var(--brand-blue)"): string {
  const direct = normalizeHex(value);
  if (direct) {
    return direct;
  }

  const source = value.trim() || fallbackToken;
  const variable = source.match(CSS_VAR_RE);
  if (variable && typeof document !== "undefined") {
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(`--${variable[1]}`).trim();
    return normalizeHex(resolved) ?? rgbToHex(resolved) ?? resolveCssColorForInput(fallbackToken, "");
  }

  if (fallbackToken && fallbackToken !== source) {
    return resolveCssColorForInput(fallbackToken, "");
  }

  return COLOR_INPUT_LAST_RESORT;
}

export function withCssColorAlpha(value: string, opacityPercent: number): string {
  const opacity = Math.max(0, Math.min(100, opacityPercent));
  const hex = normalizeHex(value);
  if (hex) {
    const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, "0");
    return `${hex}${alpha}`;
  }

  return `color-mix(in srgb, ${value} ${opacity}%, transparent)`;
}
