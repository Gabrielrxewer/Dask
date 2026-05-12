import { z } from "zod";
import type { NodeConfigDescriptor } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readNodeConfigPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, source);
}

export function hasNodeConfigValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

export function buildNodeConfigZodSchema(
  descriptor: NodeConfigDescriptor
): z.ZodType<Record<string, unknown>, Record<string, unknown>> {
  return z.record(z.string(), z.unknown()).superRefine((config, ctx) => {
    for (const field of descriptor.fields) {
      if (!field.required) continue;
      const value = readNodeConfigPath(config, field.name);
      if (!hasNodeConfigValue(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.name.split("."),
          message: `${field.label} e obrigatorio.`
        });
      }
    }

    for (const field of descriptor.fields) {
      if (field.type !== "number") continue;
      const value = readNodeConfigPath(config, field.name);
      if (!hasNodeConfigValue(value)) continue;
      const numericValue = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numericValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.name.split("."),
          message: `${field.label} precisa ser um numero valido.`
        });
        continue;
      }
      if (field.min !== undefined && numericValue < field.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.name.split("."),
          message: `${field.label} deve ser maior ou igual a ${field.min}.`
        });
      }
      if (field.max !== undefined && numericValue > field.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.name.split("."),
          message: `${field.label} deve ser menor ou igual a ${field.max}.`
        });
      }
    }

    for (const field of descriptor.fields) {
      if (field.type !== "json" && field.type !== "key-value-list") continue;
      const value = readNodeConfigPath(config, field.name);
      if (!hasNodeConfigValue(value)) continue;
      if (!isRecord(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.name.split("."),
          message: `${field.label} precisa ser configurado pelos campos estruturados.`
        });
      }
    }

    for (const field of descriptor.validation?.required ?? []) {
      if (!hasNodeConfigValue(readNodeConfigPath(config, field))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.split("."),
          message: `${field} e obrigatorio.`
        });
      }
    }

    for (const group of descriptor.validation?.requiredAny ?? []) {
      if (!group.some((field) => hasNodeConfigValue(readNodeConfigPath(config, field)))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: group[0]?.split(".") ?? [],
          message: `Preencha pelo menos um de ${group.join(", ")}.`
        });
      }
    }
  }) as z.ZodType<Record<string, unknown>, Record<string, unknown>>;
}
