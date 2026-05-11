import { DocumentMarkdownRenderer } from "@/modules/documentation/rendering/DocumentMarkdownRenderer";
import type { DocumentVariableDiagnostic } from "@/modules/documentation/model/document-variable-resolver";

interface DocumentPreviewProps {
  markdown: string;
  diagnostics?: DocumentVariableDiagnostic[];
  className?: string;
}

export function DocumentPreview({ markdown, diagnostics = [], className }: DocumentPreviewProps) {
  return (
    <>
      {diagnostics.length > 0 ? (
        <div className="documentation-page__variable-alert" role="status">
          <strong>Variaveis com atencao</strong>
          <ul>
            {diagnostics.slice(0, 4).map((diagnostic) => (
              <li key={`${diagnostic.key}-${diagnostic.message}`}>{diagnostic.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <DocumentMarkdownRenderer markdown={markdown} className={className} />
    </>
  );
}
