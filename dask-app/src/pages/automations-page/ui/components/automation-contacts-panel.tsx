import type { CommunicationConversationSummary } from "@/modules/workspace/model";
import { StatusBadge } from "@/shared/ui";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationContactsPanel({
  conversations,
  loading,
  error,
  onRefresh
}: {
  conversations: CommunicationConversationSummary[];
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Contatos" onRefresh={onRefresh} />
      <AutomationDataList
        items={conversations}
        empty="Sem contatos."
        loading={loading}
        error={error}
        render={(conversation) => (
          <div key={conversation.conversationId} className="automation-studio__row">
            <span>{conversation.contactName}</span>
            <StatusBadge size="sm" tone="info">{conversation.channel}</StatusBadge>
            <small>{conversation.contactMasked}</small>
          </div>
        )}
      />
    </section>
  );
}
