import type { ComponentProps, KeyboardEvent, Ref } from "react";
import type { DocumentationAssistantMode, WorkspaceDocument } from "@/modules/workspace";
import { AppIcon, Button, EmptyState, StatusBadge, Textarea } from "@/shared/ui";
import {
  formatRelativeDate,
  MODE_LABELS,
  type AssistantMessage
} from "./documentation-page.local";

interface DocumentationAssistantPanelProps {
  isAssistantOpen: boolean;
  activeDoc: WorkspaceDocument | null;
  activeContextTitle: string;
  activeMessages: AssistantMessage[];
  isRunning: boolean;
  assistantTone: ComponentProps<typeof StatusBadge>["tone"];
  assistantStatus: string;
  activeMode: DocumentationAssistantMode;
  isModeInfoOpen: boolean;
  messagesRef: Ref<HTMLDivElement>;
  promptInputRef: Ref<HTMLTextAreaElement>;
  prompt: string;
  canSend: boolean;
  lastRunLatencyMs: number | null;
  includeSemanticContext: boolean;
  loadError: string | null;
  saveError: string | null;
  runError: string | null;
  onClose: () => void;
  onClearChat: () => void;
  onModeChange: (mode: DocumentationAssistantMode) => void;
  onToggleModeInfo: () => void;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRunAssistant: () => void;
  onSemanticContextChange: (enabled: boolean) => void;
}

export function DocumentationAssistantPanel({
  isAssistantOpen,
  activeDoc,
  activeContextTitle,
  activeMessages,
  isRunning,
  assistantTone,
  assistantStatus,
  activeMode,
  isModeInfoOpen,
  messagesRef,
  promptInputRef,
  prompt,
  canSend,
  lastRunLatencyMs,
  includeSemanticContext,
  loadError,
  saveError,
  runError,
  onClose,
  onClearChat,
  onModeChange,
  onToggleModeInfo,
  onPromptChange,
  onPromptKeyDown,
  onRunAssistant,
  onSemanticContextChange
}: DocumentationAssistantPanelProps) {
  return (
    <>
      {isAssistantOpen ? (
        <button
          type="button"
          className="documentation-page__assistant-backdrop"
          aria-label="Fechar Chat IA"
          onClick={onClose}
        />
      ) : null}

      <aside className="documentation-page__assistant-pane" aria-hidden={!isAssistantOpen}>
        <header className="documentation-page__assistant-header">
          <div>
            <h2>Chat IA</h2>
            <p>{activeContextTitle ? `ON: ${activeContextTitle}` : "Selecione uma doc ou pasta"}</p>
          </div>
          <div className="documentation-page__assistant-tools">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="documentation-page__clear-chat-button"
              aria-label="Limpar chat"
              title="Limpar chat desta doc"
              disabled={activeMessages.length === 0 || isRunning}
              onClick={onClearChat}
            >
              <AppIcon name="trash" />
            </Button>
            <StatusBadge tone={assistantTone}>{assistantStatus}</StatusBadge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="documentation-page__close-chat-button"
              aria-label="Fechar Chat IA"
              title="Fechar Chat IA"
              onClick={onClose}
            >
              <AppIcon name="x" />
            </Button>
          </div>
        </header>

        <div className="documentation-page__modes">
          <button
            type="button"
            className={`documentation-page__mode-chip${activeMode === "chat" ? " documentation-page__mode-chip--active" : ""}`}
            onClick={() => onModeChange("chat")}
          >
            <AppIcon className="documentation-page__mode-chip-icon" name="message" />
            {MODE_LABELS.chat}
          </button>
          <button
            type="button"
            className={`documentation-page__mode-chip${activeMode === "write" ? " documentation-page__mode-chip--active" : ""}`}
            onClick={() => onModeChange("write")}
          >
            <AppIcon className="documentation-page__mode-chip-icon" name="pencil" />
            {MODE_LABELS.write}
          </button>
          <button
            type="button"
            className={`documentation-page__mode-chip${activeMode === "maintain" ? " documentation-page__mode-chip--active" : ""}`}
            onClick={() => onModeChange("maintain")}
          >
            <AppIcon className="documentation-page__mode-chip-icon" name="wrench" />
            {MODE_LABELS.maintain}
          </button>
          <button
            type="button"
            className="documentation-page__mode-info-button"
            aria-label="Mais informacoes sobre os modos do chat"
            aria-expanded={isModeInfoOpen}
            onClick={onToggleModeInfo}
          >
            <AppIcon name="info" />
          </button>
          {isModeInfoOpen ? (
            <div className="documentation-page__mode-info-popover" role="status">
              <strong>Modos do Chat IA</strong>
              <p>
                Chat responde duvidas sobre a doc. Escrita cria novos trechos em markdown. Manutencao revisa,
                corrige ou atualiza o conteudo existente.
              </p>
            </div>
          ) : null}
        </div>

        <div ref={messagesRef} className="documentation-page__messages">
          {activeMessages.length === 0 ? (
            <EmptyState
              className="documentation-page__messages-empty-state"
              icon={<span className="documentation-page__messages-empty-avatar">AI</span>}
              title="Vamos comecar esta doc?"
              description={activeDoc ? "Digite livremente no chat. Se pedir para reescrever, revisar ou melhorar, eu atualizo o conteudo da doc automaticamente." : "Digite livremente no chat para analisar os docs desta pasta."}
            />
          ) : (
            activeMessages.map((message) => (
              <article
                key={message.id}
                className={`documentation-page__message documentation-page__message--${message.role}`}
              >
                <div className="documentation-page__message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? "AI" : message.role === "user" ? "VO" : "SI"}
                </div>
                <div className="documentation-page__message-bubble">
                  <header>
                    <strong>{message.role === "assistant" ? "Dask AI" : message.role === "user" ? "Voce" : "Sistema"}</strong>
                    <span>{`${MODE_LABELS[message.mode]} - ${formatRelativeDate(message.createdAt)}`}</span>
                  </header>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          )}

          {isRunning ? (
            <article className="documentation-page__message documentation-page__message--thinking">
              <div className="documentation-page__message-avatar" aria-hidden="true">
                AI
              </div>
              <div className="documentation-page__message-bubble">
                <header>
                  <strong>Dask AI</strong>
                  <span>Pensando...</span>
                </header>
                <div className="documentation-page__thinking-dots" aria-label="IA pensando">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          ) : null}
        </div>

        <div className="documentation-page__composer">
          <div className="documentation-page__composer-shell">
            <Textarea
              ref={promptInputRef}
              rows={3}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={onPromptKeyDown}
              placeholder="Converse com a IA sobre esta doc. Ex.: Reescreva de forma mais objetiva."
              className="documentation-page__composer-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="documentation-page__send-button"
              aria-label="Enviar mensagem"
              disabled={!canSend}
              onClick={onRunAssistant}
            >
              <AppIcon name="send" strokeWidth={2} />
            </Button>
          </div>
          <p className="documentation-page__composer-hint">Enter envia - Shift + Enter quebra linha</p>
          {lastRunLatencyMs !== null ? (
            <p className="documentation-page__composer-latency">{`Ultima resposta: ${(lastRunLatencyMs / 1000).toFixed(1)}s`}</p>
          ) : null}
          <label className="documentation-page__composer-checkbox">
            <input
              type="checkbox"
              checked={includeSemanticContext}
              onChange={(event) => onSemanticContextChange(event.target.checked)}
            />
            Enriquecer com contexto do workspace
          </label>
          {loadError ? <p className="documentation-page__error">{loadError}</p> : null}
          {saveError ? <p className="documentation-page__error">{saveError}</p> : null}
          {runError ? <p className="documentation-page__error">{runError}</p> : null}
        </div>

        <div className="documentation-page__assistant-footer">
          <p>Se voce pedir para reescrever ou editar, a IA atualiza a doc automaticamente.</p>
        </div>
      </aside>
    </>
  );
}
