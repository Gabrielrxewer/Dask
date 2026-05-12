import type {
  CommunicationConversationDetail,
  CommunicationConversationSummary
} from "@/modules/workspace/model";
import { Button, EmptyState, StatusBadge } from "@/shared/ui";
import { statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationInboxPanel({
  conversations,
  selectedConversation,
  selectedConversationLoading,
  replyText,
  loading,
  error,
  onRefresh,
  onOpenConversation,
  onReplyTextChange,
  onReply
}: {
  conversations: CommunicationConversationSummary[];
  selectedConversation: CommunicationConversationDetail | null;
  selectedConversationLoading: boolean;
  replyText: string;
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
  onOpenConversation: (conversationId: string) => void;
  onReplyTextChange: (value: string) => void;
  onReply: () => Promise<void>;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Inbox" onRefresh={onRefresh} />
      <div className="automation-studio__split">
        <AutomationDataList
          items={conversations}
          empty="Sem conversas."
          loading={loading}
          error={error}
          render={(conversation) => (
            <button key={conversation.conversationId} type="button" onClick={() => onOpenConversation(conversation.conversationId)}>
              <span>{conversation.contactName}</span>
              <StatusBadge size="sm" tone={statusTone(conversation.status)}>{conversation.status}</StatusBadge>
              <small>{conversation.lastMessagePreview ?? conversation.contactMasked}</small>
            </button>
          )}
        />
        <div className="automation-studio__detail">
          {selectedConversation ? (
            <>
              <h3>{selectedConversation.contact.displayName ?? selectedConversation.contact.companyName ?? "Contato"}</h3>
              <div className="automation-studio__messages">
                {selectedConversation.messages.map((message) => (
                  <div key={message.id}>
                    <strong>{message.direction}</strong>
                    <span>{message.textPreview}</span>
                  </div>
                ))}
              </div>
              <textarea value={replyText} onChange={(event) => onReplyTextChange(event.target.value)} />
              <Button size="sm" variant="primary" onClick={() => void onReply()}>Responder</Button>
            </>
          ) : (
            <EmptyState className="automation-studio__empty-panel" size="compact">
              {selectedConversationLoading ? "Carregando conversa." : "Abra uma conversa."}
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
