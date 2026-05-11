import { z } from "zod";
import { documentVisibilitySchema } from "@/modules/documentation/model/documentation-metadata.schema";

export const documentPermissionScopeSchema = z.enum(["document", "folder"]);

export const documentPermissionSchema = z.object({
  scope: documentPermissionScopeSchema,
  targetId: z.string().min(1),
  visibility: documentVisibilitySchema,
  inheritFromParent: z.boolean().default(true),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canOrganize: z.boolean(),
  canDecide: z.boolean()
});

export type DocumentPermission = z.infer<typeof documentPermissionSchema>;
