import type { TaskFieldDefinition } from "@/entities/task";
import { getPreviewValue } from "./work-item-editor-settings.model";

interface WorkItemFieldPreviewValueProps {
  field: TaskFieldDefinition;
}

export function WorkItemFieldPreviewValue({ field }: WorkItemFieldPreviewValueProps) {
  if (field.type === "long_text") {
    return <p className="wie__detail-preview-copy">{getPreviewValue(field)}</p>;
  }
  if (field.type === "multi_select" || field.type === "tag") {
    const values = String(getPreviewValue(field)).split(",").map((v) => v.trim()).filter(Boolean);
    return (
      <div className="wie__detail-preview-pills">
        {values.map((v) => <span key={v} className="wie__detail-preview-pill">{v}</span>)}
      </div>
    );
  }
  if (field.type === "checklist") {
    return (
      <div className="wie__detail-preview-checklist">
        <span className="wie__detail-preview-progress">3 de 5 concluidos</span>
        <div className="wie__detail-preview-progressbar"><i /></div>
      </div>
    );
  }
  if (field.type === "boolean") return <div className="wie__detail-preview-input">Ativado</div>;
  if (field.type === "schedule") return <div className="wie__detail-preview-input">24/04 09:00 → 26/04 18:00</div>;
  if (field.type === "billing_summary") {
    return (
      <div className="wie__detail-preview-billing">
        <div className="wie__billing-charge wie__billing-charge--paid">
          <span className="wie__billing-charge-title">Assinatura Mensal</span>
          <span className="wie__billing-charge-amount">R$ 1.500,00</span>
          <span className="wie__billing-charge-status wie__billing-charge-status--paid">Pago</span>
        </div>
        <div className="wie__billing-charge wie__billing-charge--pending">
          <span className="wie__billing-charge-title">Setup Inicial</span>
          <span className="wie__billing-charge-amount">R$ 3.000,00</span>
          <span className="wie__billing-charge-status wie__billing-charge-status--pending">Aguardando pagamento</span>
        </div>
      </div>
    );
  }
  return <div className="wie__detail-preview-input">{getPreviewValue(field)}</div>;
}
