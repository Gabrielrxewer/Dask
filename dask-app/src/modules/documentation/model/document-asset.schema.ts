import { z } from "zod";

export const documentAssetTypeSchema = z.enum(["logo", "attachment", "generated_pdf", "exported_html"]);

export const documentAssetSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  documentId: z.string().min(1),
  type: documentAssetTypeSchema.or(z.string()),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  uploadedBy: z.string().min(1),
  createdAt: z.string(),
  contentUrl: z.string().min(1)
});

export type DocumentAsset = z.infer<typeof documentAssetSchema>;
