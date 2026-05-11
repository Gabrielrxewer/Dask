import { z } from "zod";

export const marketingCampaignObjectiveSchema = z.enum([
  "LEAD_NURTURE",
  "ONBOARDING",
  "REACTIVATION",
  "BILLING_REMINDER",
  "RENEWAL",
  "EXPANSION",
  "PRODUCT_UPDATE",
  "NEWSLETTER",
  "CUSTOM"
]);

export const marketingCampaignChannelSchema = z.enum(["EMAIL", "NEWSLETTER"]);

export const marketingCampaignVariantSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da variante.").max(120),
  subject: z.string().trim().min(1, "Informe o assunto.").max(220),
  preheader: z.string().trim().max(280).optional(),
  bodyMarkdown: z.string().trim().min(1, "Informe o conteudo.").max(200000),
  bodyHtml: z.string().trim().max(300000).optional(),
  weight: z.coerce.number().int().min(1).max(1000).optional(),
  isControl: z.boolean().optional()
});

export const createMarketingCampaignSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160),
  description: z.string().trim().max(4000).optional(),
  objective: marketingCampaignObjectiveSchema,
  channel: marketingCampaignChannelSchema.default("EMAIL"),
  segmentId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  senderProfileId: z.string().uuid().optional(),
  variants: z.array(marketingCampaignVariantSchema).max(6).optional()
});

const optionalUuidFormFieldSchema = z.string().trim().refine((value) => {
  return value === "" || z.string().uuid().safeParse(value).success;
}, "Selecione um registro valido.");

export const marketingCampaignComposerSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160),
  description: z.string().trim().max(4000),
  objective: marketingCampaignObjectiveSchema,
  segmentId: optionalUuidFormFieldSchema,
  templateId: optionalUuidFormFieldSchema,
  subject: z.string().trim().min(1, "Informe o assunto.").max(220),
  bodyMarkdown: z.string().trim().min(1, "Informe o conteudo.").max(200000)
});

export const scheduleMarketingCampaignSchema = z.object({
  scheduledAt: z.string().trim().min(1, "Informe data e hora.").refine((value) => {
    return !Number.isNaN(new Date(value).getTime());
  }, "Data de agendamento invalida.")
});

export const sendMarketingTestEmailSchema = z.object({
  to: z.string().trim().email("Informe um e-mail valido."),
  subject: z.string().trim().max(220).optional(),
  content: z.string().max(200000).optional()
});

export const marketingAiCampaignSchema = z.object({
  objective: z.string().trim().min(2, "Informe o objetivo.").max(200),
  tone: z.string().trim().max(120).optional(),
  targetStage: z.string().trim().max(120).optional(),
  segmentHint: z.string().trim().max(200).optional(),
  documentLimit: z.coerce.number().int().min(1).max(12).optional()
});

export const marketingAiCampaignComposerSchema = z.object({
  objective: z.string().trim().min(2, "Informe o objetivo.").max(200),
  tone: z.string().trim().max(120),
  targetStage: z.string().trim().max(120),
  segmentHint: z.string().trim().max(200)
});

export type CreateMarketingCampaignFormValues = z.infer<typeof createMarketingCampaignSchema>;
export type MarketingCampaignComposerFormValues = z.infer<typeof marketingCampaignComposerSchema>;
export type ScheduleMarketingCampaignFormValues = z.infer<typeof scheduleMarketingCampaignSchema>;
export type SendMarketingTestEmailFormValues = z.infer<typeof sendMarketingTestEmailSchema>;
export type MarketingAiCampaignFormValues = z.infer<typeof marketingAiCampaignSchema>;
export type MarketingAiCampaignComposerFormValues = z.infer<typeof marketingAiCampaignComposerSchema>;
