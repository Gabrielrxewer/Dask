import { z } from "zod";

export const documentVisibilitySchema = z.enum([
  "internal",
  "client_visible",
  "commercial_shared",
  "public_authenticated"
]);

export const commercialDocumentStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "approved",
  "rejected",
  "accepted",
  "signed"
]);

export const documentationMetadataSchema = z
  .object({
    linkedWorkItemId: z.string().min(1).nullable().optional(),
    tags: z.array(z.string().min(1)).optional(),
    visibility: documentVisibilitySchema.optional(),
    commercialStatus: commercialDocumentStatusSchema.optional(),
    status: z.union([commercialDocumentStatusSchema, z.string()]).optional(),
    logoAssetId: z.string().min(1).nullable().optional(),
    attachmentAssetIds: z.array(z.string().min(1)).optional(),
    variableContextType: z.literal("work_item").nullable().optional(),
    variableContextVersion: z.string().min(1).nullable().optional(),
    sentAt: z.string().nullable().optional(),
    acceptedAt: z.string().nullable().optional(),
    rejectedAt: z.string().nullable().optional(),
    acceptedVersionHash: z.string().nullable().optional(),
    publicAccessPolicy: z
      .object({
        requireLogin: z.boolean().default(true),
        allowAcceptReject: z.boolean().default(true)
      })
      .partial()
      .optional()
  })
  .catchall(z.unknown());

export type DocumentationMetadata = z.infer<typeof documentationMetadataSchema>;
