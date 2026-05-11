export { parseDocumentVariables } from "@/modules/documentation/model/document-variable-parser";
export type { ParsedDocumentVariable } from "@/modules/documentation/model/document-variable-parser";
export {
  buildLegacyDocumentVariables,
  documentVariableRegistry
} from "@/modules/documentation/model/document-variable-registry";
export type {
  DocumentVariableContext,
  DocumentVariableDefinition
} from "@/modules/documentation/model/document-variable-registry";
export { resolveDocumentMarkdown } from "@/modules/documentation/model/document-variable-resolver";
export type {
  DocumentVariableDiagnostic,
  ResolvedDocumentMarkdown
} from "@/modules/documentation/model/document-variable-resolver";
export {
  commercialDocumentDecisionSchema,
  commercialDocumentSendSchema
} from "@/modules/documentation/model/commercial-document.schema";
export type {
  CommercialDocumentDecision,
  CommercialDocumentSendInput
} from "@/modules/documentation/model/commercial-document.schema";
export { documentAssetSchema, documentAssetTypeSchema } from "@/modules/documentation/model/document-asset.schema";
export type { DocumentAsset } from "@/modules/documentation/model/document-asset.schema";
export { documentPermissionSchema, documentPermissionScopeSchema } from "@/modules/documentation/model/document-permission.schema";
export type { DocumentPermission } from "@/modules/documentation/model/document-permission.schema";
export {
  documentVariableContextSchema,
  documentVariableDiagnosticSchema,
  documentVariableKeySchema
} from "@/modules/documentation/model/document-variable.schema";
export type {
  DocumentVariableContextModel,
  DocumentVariableDiagnosticModel
} from "@/modules/documentation/model/document-variable.schema";
export { documentationDocumentKindSchema, documentationDocumentSchema } from "@/modules/documentation/model/documentation-document.schema";
export type { DocumentationDocument } from "@/modules/documentation/model/documentation-document.schema";
export { documentationFolderSchema } from "@/modules/documentation/model/documentation-folder.schema";
export type { DocumentationFolder } from "@/modules/documentation/model/documentation-folder.schema";
export {
  commercialDocumentStatusSchema,
  documentationMetadataSchema,
  documentVisibilitySchema
} from "@/modules/documentation/model/documentation-metadata.schema";
export type { DocumentationMetadata } from "@/modules/documentation/model/documentation-metadata.schema";
