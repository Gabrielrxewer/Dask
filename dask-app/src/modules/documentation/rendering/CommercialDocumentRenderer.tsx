import { DocumentPreview } from "@/modules/documentation/rendering/DocumentPreview";
import type { DocumentVariableDiagnostic } from "@/modules/documentation/model/document-variable-resolver";

interface CommercialDocumentRendererProps {
  markdown: string;
  diagnostics?: DocumentVariableDiagnostic[];
  className?: string;
}

export function CommercialDocumentRenderer({
  markdown,
  diagnostics,
  className
}: CommercialDocumentRendererProps) {
  return <DocumentPreview markdown={markdown} diagnostics={diagnostics} className={className} />;
}
