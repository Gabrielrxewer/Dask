import { StatusBadge } from "@/shared/ui";
import type { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";

export function WorkflowPreviewPanel({
  preview
}: {
  preview: ReturnType<typeof buildWorkflowPreview>;
}) {
  return (
    <section className="ast__preview">
      <div className="ast__preview-head">
        <h3>Preview de publicacao</h3>
        <StatusBadge size="sm" tone={preview.errors.length > 0 ? "danger" : preview.warnings.length > 0 ? "warning" : "success"}>
          {preview.errors.length > 0 ? "Bloqueado" : preview.warnings.length > 0 ? "Com avisos" : "Publicavel"}
        </StatusBadge>
      </div>
      {preview.errors.length > 0 ? (
        <ul className="ast__preview-list ast__preview-list--danger">
          {preview.errors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      {preview.warnings.length > 0 ? (
        <ul className="ast__preview-list">
          {preview.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      <ol className="ast__preview-steps">
        {preview.steps.map((step) => (
          <li key={step.id}>
            <span>{step.index}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
