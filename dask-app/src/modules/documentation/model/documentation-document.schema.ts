import { z } from "zod";
import { documentationMetadataSchema } from "@/modules/documentation/model/documentation-metadata.schema";

export const documentationDocumentKindSchema = z.enum(["wiki", "proposal", "contract"]);

export const documentationDocumentSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  kind: documentationDocumentKindSchema,
  linkedEntityType: z.enum(["work_item", "customer", "proposal", "contract"]).optional(),
  linkedEntityId: z.string().optional(),
  tags: z.array(z.string()),
  metadata: documentationMetadataSchema,
  position: z.number(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type DocumentationDocument = z.infer<typeof documentationDocumentSchema>;
