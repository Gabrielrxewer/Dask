import { z } from "zod";

export const documentVariableKeySchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,119}$/);

export const documentVariableDiagnosticSchema = z.object({
  key: documentVariableKeySchema,
  message: z.string().min(1),
  severity: z.enum(["warning", "error"])
});

export const documentVariableContextSchema = z.object({
  type: z.literal("work_item"),
  version: z.string().min(1),
  linkedWorkItemId: z.string().min(1).nullable()
});

export type DocumentVariableDiagnosticModel = z.infer<typeof documentVariableDiagnosticSchema>;
export type DocumentVariableContextModel = z.infer<typeof documentVariableContextSchema>;
