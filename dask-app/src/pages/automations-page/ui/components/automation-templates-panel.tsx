import type { CommunicationTemplate } from "@/modules/workspace/model";
import { StatusBadge } from "@/shared/ui";
import { statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationTemplatesPanel({
  templates,
  loading,
  error,
  onRefresh
}: {
  templates: CommunicationTemplate[];
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Templates" onRefresh={onRefresh} />
      <AutomationDataList
        items={templates}
        empty="Sem templates."
        loading={loading}
        error={error}
        render={(template) => (
          <div key={template.id} className="automation-studio__row">
            <span>{template.name}</span>
            <StatusBadge size="sm" tone={statusTone(template.status)}>{template.status}</StatusBadge>
            <small>{template.channel}</small>
          </div>
        )}
      />
    </section>
  );
}
