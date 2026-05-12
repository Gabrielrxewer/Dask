import type { WhatsAppConsent } from "@/modules/workspace/model";
import { Button, StatusBadge } from "@/shared/ui";
import { formatDate, statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationSettingsPanel({
  consents,
  loading,
  error,
  onRefresh,
  onOptOutFirstConsent
}: {
  consents: WhatsAppConsent[];
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
  onOptOutFirstConsent: () => Promise<void>;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Configuracoes" onRefresh={onRefresh} />
      <AutomationDataList
        items={consents}
        empty="Sem consentimentos."
        loading={loading}
        error={error}
        render={(consent) => (
          <div key={consent.id} className="automation-studio__row">
            <span>{consent.address}</span>
            <StatusBadge size="sm" tone={statusTone(consent.status)}>{consent.status}</StatusBadge>
            <small>{formatDate(consent.updatedAt)}</small>
          </div>
        )}
      />
      <Button size="sm" variant="outline" disabled={consents.length === 0} onClick={() => void onOptOutFirstConsent()}>
        Aplicar opt-out no primeiro item
      </Button>
    </section>
  );
}
