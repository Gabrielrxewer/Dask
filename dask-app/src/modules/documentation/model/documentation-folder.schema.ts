import { z } from "zod";

export const documentationFolderSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().nullable(),
  position: z.number(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type DocumentationFolder = z.infer<typeof documentationFolderSchema>;
