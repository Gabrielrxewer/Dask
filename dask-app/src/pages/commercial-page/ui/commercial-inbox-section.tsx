import { useMemo, useState } from "react";
import type {
  CommunicationConversationDetail,
  CommunicationMessageSummary,
  CommunicationConversationSummary
} from "@/modules/workspace/model";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/date";
import { AppIcon, Button, EmptyState, StatusBadge } from "@/shared/ui";

function statusTone(status: string): "default" | "muted" | "success" | "warning" | "danger" | "info" {
  if (["active", "published", "completed", "approved", "sent", "delivered"].includes(status)) return "success";
  if (["paused", "waiting", "pending", "draft", "queued", "running"].includes(status)) return "warning";
  if (["archived", "cancelled", "rejected"].includes(status)) return "muted";
  if (["failed", "expired", "blocked"].includes(status)) return "danger";
  return "default";
}

function formatShortTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return date.toLocaleString("pt-BR", isToday
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit" });
}

function getInitials(name: string | null | undefined) {
  const parts = (name ?? "Cliente").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CL";
}

function channelLabel(channel: string) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  return channel;
}

function directionLabel(direction: string) {
  if (direction === "inbound") return "Cliente";
  if (direction === "outbound") return "Dask";
  return "Sistema";
}

function messageText(message: CommunicationMessageSummary) {
  return message.textPreview?.trim() || "Mensagem sem preview.";
}

function isOutbound(message: CommunicationMessageSummary) {
  return message.direction === "outbound";
}

function ConversationList({
  conversations,
  selectedConversationId,
  loading,
  error,
  onOpenConversation
}: {
  conversations: CommunicationConversationSummary[];
  selectedConversationId: string | null;
  loading?: boolean;
  error?: unknown;
  onOpenConversation: (conversationId: string) => void;
}) {
  if (loading) {
    return <EmptyState className="commercial-inbox__empty" size="compact">Carregando...</EmptyState>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel carregar.";
    return <EmptyState className="commercial-inbox__empty" size="compact">{message}</EmptyState>;
  }

  if (conversations.length === 0) {
    return <EmptyState className="commercial-inbox__empty" size="compact">Sem conversas encontradas.</EmptyState>;
  }

  return (
    <div className="commercial-inbox__list">
      {conversations.map((conversation) => {
        const title = conversation.contactName || conversation.workItemTitle || "Cliente";
        const isSelected = selectedConversationId === conversation.conversationId;
        return (
          <button
            key={conversation.conversationId}
            type="button"
            className={cn(
              "commercial-inbox__conversation",
              isSelected && "is-selected",
              conversation.unreadCount > 0 && "has-unread",
              conversation.hasFailedMessage && "has-error"
            )}
            aria-pressed={isSelected}
            onClick={() => onOpenConversation(conversation.conversationId)}
          >
            <span className="commercial-inbox__avatar" aria-hidden="true">{getInitials(title)}</span>
            <span className="commercial-inbox__conversation-main">
              <span className="commercial-inbox__conversation-line">
                <strong>{title}</strong>
                <time>{formatShortTime(conversation.lastMessageAt)}</time>
              </span>
              <span className="commercial-inbox__conversation-preview">
                {conversation.lastMessagePreview ?? conversation.contactMasked ?? "Sem mensagens recentes"}
              </span>
              <span className="commercial-inbox__conversation-tags">
                <span>{channelLabel(conversation.channel)}</span>
                {conversation.workItemTitle ? <span>{conversation.workItemTitle}</span> : null}
              </span>
            </span>
            <span className="commercial-inbox__conversation-meta">
              <StatusBadge size="sm" tone={statusTone(conversation.status)}>{conversation.status}</StatusBadge>
              {conversation.unreadCount > 0 ? <strong>{conversation.unreadCount}</strong> : null}
              {conversation.hasPendingApproval ? <AppIcon name="square-check" size={14} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CommercialInboxSection({
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
  const [search, setSearch] = useState("");
  const selectedConversationId = selectedConversation?.conversation.id ?? null;
  const selectedContactName =
    selectedConversation?.contact.displayName ??
    selectedConversation?.contact.companyName ??
    "Cliente";
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => [
      conversation.contactName,
      conversation.contactMasked,
      conversation.lastMessagePreview,
      conversation.workItemTitle,
      conversation.channel,
      conversation.status
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [conversations, search]);
  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const openTotal = conversations.filter((conversation) => conversation.status === "open").length;

  return (
    <section className="commercial-inbox">
      <aside className="commercial-inbox__sidebar">
        <header className="commercial-inbox__header">
          <div>
            <span>Relacionamento</span>
            <h2>Inbox</h2>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => void onRefresh()}
            aria-label="Atualizar inbox"
            title="Atualizar inbox"
          >
            <AppIcon name="refresh" size={14} />
          </Button>
        </header>

        <div className="commercial-inbox__summary" aria-label="Resumo da inbox">
          <span><strong>{conversations.length}</strong> conversas</span>
          <span><strong>{openTotal}</strong> abertas</span>
          <span><strong>{unreadTotal}</strong> nao lidas</span>
        </div>

        <label className="commercial-inbox__search">
          <AppIcon name="search" size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente, lead ou assunto"
            aria-label="Buscar conversas"
          />
        </label>

        <ConversationList
          conversations={filteredConversations}
          selectedConversationId={selectedConversationId}
          loading={loading}
          error={error}
          onOpenConversation={onOpenConversation}
        />
      </aside>

      <main className="commercial-inbox__chat">
        <header className="commercial-inbox__chat-header">
          {selectedConversation ? (
            <>
              <span className="commercial-inbox__avatar commercial-inbox__avatar--lg" aria-hidden="true">
                {getInitials(selectedContactName)}
              </span>
              <div className="commercial-inbox__chat-title">
                <h3>{selectedContactName}</h3>
                <span>
                  {channelLabel(selectedConversation.conversation.channel)}
                  {selectedConversation.contact.primaryPhone ? ` - ${selectedConversation.contact.primaryPhone}` : ""}
                  {selectedConversation.contact.primaryEmail ? ` - ${selectedConversation.contact.primaryEmail}` : ""}
                </span>
              </div>
              <StatusBadge size="sm" tone={statusTone(selectedConversation.conversation.status)}>
                {selectedConversation.conversation.status}
              </StatusBadge>
            </>
          ) : (
            <div className="commercial-inbox__chat-title">
              <h3>Selecione uma conversa</h3>
              <span>Mensagens, contexto comercial e historico aparecem aqui.</span>
            </div>
          )}
        </header>

        {selectedConversation ? (
          <div className="commercial-inbox__conversation-grid">
            <section className="commercial-inbox__thread" aria-label="Mensagens da conversa">
              {selectedConversation.pendingApprovals.length > 0 ? (
                <div className="commercial-inbox__approval-banner">
                  <AppIcon name="square-check" size={16} />
                  <span>{selectedConversation.pendingApprovals.length} aprovacao pendente nesta conversa</span>
                </div>
              ) : null}

              <div className="commercial-inbox__messages">
                {selectedConversation.messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "commercial-inbox__message",
                      isOutbound(message) ? "commercial-inbox__message--outbound" : "commercial-inbox__message--inbound",
                      message.direction === "system" && "commercial-inbox__message--system"
                    )}
                  >
                    <div className="commercial-inbox__bubble">
                      <strong>{directionLabel(message.direction)}</strong>
                      <p>{messageText(message)}</p>
                      <footer>
                        <time>{formatShortTime(message.occurredAt)}</time>
                        {message.status ? <span>{message.status}</span> : null}
                      </footer>
                    </div>
                  </article>
                ))}
              </div>

              <footer className="commercial-inbox__composer">
                <button type="button" aria-label="Templates de mensagem" disabled>
                  <AppIcon name="zap" size={16} />
                </button>
                <textarea
                  value={replyText}
                  placeholder="Digite uma resposta"
                  aria-label="Resposta da conversa"
                  onChange={(event) => onReplyTextChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && replyText.trim()) {
                      event.preventDefault();
                      void onReply();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="primary"
                  disabled={!replyText.trim()}
                  onClick={() => void onReply()}
                  aria-label="Enviar resposta"
                  title="Enviar resposta"
                >
                  <AppIcon name="send" size={14} />
                </Button>
              </footer>
            </section>

            <aside className="commercial-inbox__context" aria-label="Contexto comercial">
              <section>
                <span>Cliente</span>
                <strong>{selectedContactName}</strong>
                <small>{selectedConversation.contact.status}</small>
              </section>
              <section>
                <span>WorkItem</span>
                <strong>{selectedConversation.workItem?.title ?? "Sem vinculo"}</strong>
                <small>{selectedConversation.workItem?.status ?? "Vincule para acompanhar no funil"}</small>
              </section>
              <section>
                <span>Ultima atividade</span>
                <strong>{formatDateTime(selectedConversation.conversation.lastMessageAt, { fallback: "-" })}</strong>
                <small>{selectedConversation.recentAutomationRuns.length} automacoes recentes</small>
              </section>
            </aside>
          </div>
        ) : (
          <div className="commercial-inbox__empty-chat">
            <span aria-hidden="true">
              <AppIcon name={selectedConversationLoading ? "refresh" : "message"} size={28} />
            </span>
            <strong>{selectedConversationLoading ? "Carregando conversa" : "Nenhuma conversa aberta"}</strong>
            <p>{selectedConversationLoading ? "Buscando mensagens e contexto comercial." : "Selecione um cliente na lista para abrir o atendimento."}</p>
          </div>
        )}
      </main>
    </section>
  );
}
