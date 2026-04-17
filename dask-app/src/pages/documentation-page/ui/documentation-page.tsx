import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace, type DocumentationAssistantMode, type WorkspaceDocument } from "@/modules/workspace";
import { Button, StatusBadge, TextInput, Textarea } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./documentation-page.css";

type AssistantRole = "user" | "assistant" | "system";

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  mode: DocumentationAssistantMode;
  content: string;
  createdAt: string;
}

const DEFAULT_INSTRUCTIONS: Record<DocumentationAssistantMode, string> = {
  chat: "Converse comigo sobre esta doc e responda objetivamente.",
  write: "Escreva documentacao em markdown pronta para uso.",
  maintain: "Revise e atualize esta documentacao mantendo o contexto."
};

const MODE_LABELS: Record<DocumentationAssistantMode, string> = {
  chat: "Chat",
  write: "Escrita",
  maintain: "Manutencao"
};

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createMessage(role: AssistantRole, mode: DocumentationAssistantMode, content: string): AssistantMessage {
  return {
    id: createId(),
    role,
    mode,
    content,
    createdAt: new Date().toISOString()
  };
}

function inferIntentMode(prompt: string, fallback: DocumentationAssistantMode): DocumentationAssistantMode {
  const normalized = prompt.toLowerCase();
  const rewritePattern = /(reescrev|reescreva|editar|edite|revise|melhore|corrija|atualize|refatore|reorganize)/;
  if (rewritePattern.test(normalized)) {
    return "maintain";
  }

  const writingPattern = /(escreva|crie|gere|adicione uma secao|nova secao|novo topico|documente)/;
  if (writingPattern.test(normalized)) {
    return "write";
  }

  return fallback;
}

export function DocumentationPage() {
  const {
    snapshot,
    isLoading,
    runDocumentationAssistant,
    listWorkspaceDocuments,
    createWorkspaceDocument,
    updateWorkspaceDocument,
    deleteWorkspaceDocument
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const dirtyDocIdsRef = useRef<Set<string>>(new Set());
  const saveSeqByDocRef = useRef<Record<string, number>>({});

  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, AssistantMessage[]>>({});
  const [selectedSnippet, setSelectedSnippet] = useState("");
  const [activeMode, setActiveMode] = useState<DocumentationAssistantMode>("chat");
  const [isModeInfoOpen, setIsModeInfoOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [includeSemanticContext, setIncludeSemanticContext] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingDocId, setIsSavingDocId] = useState<string | null>(null);
  const [lastRunLatencyMs, setLastRunLatencyMs] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const activeDoc = useMemo(() => {
    return docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;
  }, [docs, activeDocId]);

  const activeMessages = useMemo(() => {
    if (!activeDoc) {
      return [];
    }
    return chatsByDoc[activeDoc.id] ?? [];
  }, [chatsByDoc, activeDoc]);

  const pushMessage = useCallback((docId: string, message: AssistantMessage) => {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }, []);

  const updateDocDraft = useCallback((docId: string, patch: Partial<Pick<WorkspaceDocument, "title" | "content">>) => {
    setDocs((previous) =>
      previous.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              ...patch
            }
          : doc
      )
    );
    dirtyDocIdsRef.current.add(docId);
  }, []);

  const appendDocDraft = useCallback((docId: string, chunk: string) => {
    setDocs((previous) =>
      previous.map((doc) => {
        if (doc.id !== docId) {
          return doc;
        }
        return {
          ...doc,
          content: doc.content.trim().length === 0 ? chunk : `${doc.content.trimEnd()}\n\n${chunk}`
        };
      })
    );
    dirtyDocIdsRef.current.add(docId);
  }, []);

  const replaceDocWithServerVersion = useCallback((nextDoc: WorkspaceDocument) => {
    setDocs((previous) => previous.map((doc) => (doc.id === nextDoc.id ? nextDoc : doc)));
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsDocsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setRunError(null);
    setSelectedSnippet("");
    dirtyDocIdsRef.current = new Set();
    saveSeqByDocRef.current = {};

    listWorkspaceDocuments()
      .then((fetchedDocs) => {
        if (!mounted) {
          return;
        }
        setDocs(fetchedDocs);
        setActiveDocId((current) => {
          if (current && fetchedDocs.some((doc) => doc.id === current)) {
            return current;
          }
          return fetchedDocs[0]?.id ?? null;
        });
        setChatsByDoc((previous) => {
          const next: Record<string, AssistantMessage[]> = {};
          fetchedDocs.forEach((doc) => {
            if (previous[doc.id]) {
              next[doc.id] = previous[doc.id];
            }
          });
          return next;
        });
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar docs.");
      })
      .finally(() => {
        if (mounted) {
          setIsDocsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [listWorkspaceDocuments]);

  useEffect(() => {
    setSelectedSnippet("");
    setSaveError(null);
    setRunError(null);
  }, [activeDoc?.id]);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [activeMessages.length, isRunning, activeDoc?.id]);

  useEffect(() => {
    const textarea = promptInputRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 32;
    const maxHeight = 112;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [prompt]);

  const persistDocDraft = useCallback(
    async (document: WorkspaceDocument, sequence: number) => {
      setIsSavingDocId(document.id);
      try {
        const updated = await updateWorkspaceDocument(document.id, {
          title: document.title,
          content: document.content
        });

        if (saveSeqByDocRef.current[document.id] !== sequence) {
          return;
        }

        dirtyDocIdsRef.current.delete(document.id);
        replaceDocWithServerVersion(updated);
        setSaveError(null);
      } catch (error) {
        if (saveSeqByDocRef.current[document.id] !== sequence) {
          return;
        }

        setSaveError(error instanceof Error ? error.message : "Falha ao salvar esta doc.");
      } finally {
        if (saveSeqByDocRef.current[document.id] === sequence) {
          setIsSavingDocId((current) => (current === document.id ? null : current));
        }
      }
    },
    [replaceDocWithServerVersion, updateWorkspaceDocument]
  );

  useEffect(() => {
    if (!activeDoc) {
      return;
    }

    if (!dirtyDocIdsRef.current.has(activeDoc.id)) {
      return;
    }

    const docSnapshot = { ...activeDoc };
    const timeoutHandle = setTimeout(() => {
      const nextSequence = (saveSeqByDocRef.current[docSnapshot.id] ?? 0) + 1;
      saveSeqByDocRef.current[docSnapshot.id] = nextSequence;
      void persistDocDraft(docSnapshot, nextSequence);
    }, 500);

    return () => {
      clearTimeout(timeoutHandle);
    };
  }, [activeDoc, persistDocDraft]);

  async function createNewDoc() {
    setRunError(null);
    setSaveError(null);

    try {
      const created = await createWorkspaceDocument({
        title: `Nova doc ${docs.length + 1}`,
        content: "",
        position: docs.length
      });
      setDocs((previous) => [...previous, created]);
      setActiveDocId(created.id);
      setSelectedSnippet("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao criar doc.");
    }
  }

  async function duplicateActiveDoc() {
    if (!activeDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    try {
      const duplicated = await createWorkspaceDocument({
        title: `${activeDoc.title} (copia)`,
        content: activeDoc.content,
        position: docs.length
      });
      setDocs((previous) => [...previous, duplicated]);
      setActiveDocId(duplicated.id);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao duplicar doc.");
    }
  }

  async function removeActiveDoc() {
    if (!activeDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    try {
      await deleteWorkspaceDocument(activeDoc.id);
      dirtyDocIdsRef.current.delete(activeDoc.id);
      delete saveSeqByDocRef.current[activeDoc.id];
      const nextDocs = docs.filter((doc) => doc.id !== activeDoc.id);
      setDocs(nextDocs);
      setActiveDocId(nextDocs[0]?.id ?? null);
      setChatsByDoc((previous) => {
        const next = { ...previous };
        delete next[activeDoc.id];
        return next;
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao excluir doc.");
    }
  }

  function handleEditorSelection(textarea: HTMLTextAreaElement) {
    const nextSelection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
    setSelectedSnippet(nextSelection.slice(0, 6000));
  }

  async function handleRunAssistant() {
    if (!activeDoc) {
      return;
    }

    const docId = activeDoc.id;
    const docTitle = activeDoc.title;
    const docContent = activeDoc.content;
    const instruction = (prompt.trim() || DEFAULT_INSTRUCTIONS[activeMode]).slice(0, 6000);
    const inferredMode = inferIntentMode(instruction, activeMode);
    const conversationHistory = [...activeMessages, createMessage("user", inferredMode, instruction)]
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-8)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content.slice(0, 1800)
      }));

    pushMessage(docId, createMessage("user", inferredMode, instruction));
    setRunError(null);
    setIsRunning(true);
    const runStartedAt = Date.now();

    try {
      const result = await runDocumentationAssistant({
        mode: inferredMode,
        instruction,
        documentTitle: docTitle,
        documentContent: docContent,
        selection: selectedSnippet || undefined,
        conversationHistory,
        includeSemanticContext,
        topKContextDocs: 5
      });
      setLastRunLatencyMs(Date.now() - runStartedAt);

      pushMessage(docId, createMessage("assistant", inferredMode, result.content));

      if (result.action === "replace_document" && result.updatedDocument) {
        updateDocDraft(docId, { content: result.updatedDocument });
        pushMessage(docId, createMessage("system", inferredMode, "A IA atualizou esta doc automaticamente."));
      }

      if (result.action === "append_document" && result.updatedDocument) {
        appendDocDraft(docId, result.updatedDocument);
        pushMessage(docId, createMessage("system", inferredMode, "A IA anexou novo trecho nesta doc."));
      }

      setPrompt("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao processar IA de documentacao.");
      pushMessage(docId, createMessage("system", inferredMode, "Nao foi possivel processar sua solicitacao agora."));
    } finally {
      setIsRunning(false);
    }
  }

  function clearActiveChat() {
    if (!activeDoc) {
      return;
    }

    setChatsByDoc((previous) => ({
      ...previous,
      [activeDoc.id]: []
    }));
    setRunError(null);
  }

  const canDeleteDoc = docs.length > 0;
  const canSend = !isRunning && !isLoading && !isDocsLoading && Boolean(activeDoc);
  const assistantStatus = isRunning
    ? "Pensando"
    : activeDoc && isSavingDocId === activeDoc.id
      ? "Salvando"
      : "Pronta";
  const assistantTone = isRunning || (activeDoc && isSavingDocId === activeDoc.id) ? "warning" : "success";

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleRunAssistant();
      }
    }
  }

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Documentacao"
      pageLabel="Docs Hub"
    >
      <div className="documentation-page">
        <aside className="documentation-page__files-pane">
          <header className="documentation-page__files-header">
            <div>
              <p>Documentos</p>
              <h2>{docs.length} docs</h2>
            </div>
            <Button type="button" size="sm" onClick={() => void createNewDoc()} disabled={isDocsLoading || isLoading}>
              Nova doc
            </Button>
          </header>

          <div className="documentation-page__files-actions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void duplicateActiveDoc()}
              disabled={!activeDoc || isDocsLoading || isLoading}
            >
              Duplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void removeActiveDoc()}
              disabled={!activeDoc || !canDeleteDoc || isDocsLoading || isLoading}
            >
              Excluir
            </Button>
          </div>

          <nav className="documentation-page__files-list">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`documentation-page__file-item${activeDoc?.id === doc.id ? " documentation-page__file-item--active" : ""}`}
                onClick={() => setActiveDocId(doc.id)}
              >
                <strong>{doc.title}</strong>
                <span>{`Atualizado em ${formatRelativeDate(doc.updatedAt)}`}</span>
              </button>
            ))}
            {!isDocsLoading && docs.length === 0 ? (
              <div className="documentation-page__panel-empty documentation-page__panel-empty--compact">
                <h3>Nenhuma doc criada</h3>
                <p>Clique em "Nova doc" para começar.</p>
              </div>
            ) : null}
          </nav>
        </aside>

        <section className="documentation-page__editor-pane">
          {activeDoc ? (
            <>
              <header className="documentation-page__editor-header">
                <div className="documentation-page__editor-title">
                  <TextInput
                    value={activeDoc.title}
                    onChange={(event) => updateDocDraft(activeDoc.id, { title: event.target.value })}
                    placeholder="Titulo da doc"
                  />
                  <p>{`Ultima edicao: ${formatRelativeDate(activeDoc.updatedAt)}`}</p>
                </div>
                <div className="documentation-page__editor-badges">
                  <StatusBadge>{`${activeDoc.content.length} chars`}</StatusBadge>
                  {selectedSnippet ? <StatusBadge tone="warning">Trecho selecionado</StatusBadge> : null}
                </div>
              </header>

              <Textarea
                value={activeDoc.content}
                onChange={(event) => updateDocDraft(activeDoc.id, { content: event.target.value })}
                onMouseUp={(event) => handleEditorSelection(event.currentTarget)}
                onKeyUp={(event) => handleEditorSelection(event.currentTarget)}
                placeholder="Escreva livremente. O chat conversa somente sobre a doc selecionada."
                className="documentation-page__editor-textarea"
              />

              <footer className="documentation-page__editor-footer">
                <p>
                  {selectedSnippet
                    ? `Foco da IA: "${selectedSnippet.slice(0, 140)}${selectedSnippet.length > 140 ? "..." : ""}"`
                    : "Selecione um trecho para pedir ajustes especificos na doc."}
                </p>
              </footer>
            </>
          ) : (
            <div className="documentation-page__panel-empty">
              <h3>Selecione uma doc</h3>
              <p>Crie uma nova doc ou selecione uma existente para começar a editar.</p>
            </div>
          )}
        </section>

        <aside className="documentation-page__assistant-pane">
          <header className="documentation-page__assistant-header">
            <div>
              <h2>Chat IA</h2>
              <p>{activeDoc ? `ON: ${activeDoc.title}` : "Selecione uma doc"}</p>
            </div>
            <div className="documentation-page__assistant-tools">
              <button
                type="button"
                className="documentation-page__clear-chat-button"
                aria-label="Limpar chat"
                title="Limpar chat desta doc"
                disabled={activeMessages.length === 0 || isRunning}
                onClick={clearActiveChat}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M4 6h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M10 10v7M14 10v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <StatusBadge tone={assistantTone}>{assistantStatus}</StatusBadge>
            </div>
          </header>

          <div className="documentation-page__modes">
            {(Object.keys(MODE_LABELS) as DocumentationAssistantMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`documentation-page__mode-chip${activeMode === mode ? " documentation-page__mode-chip--active" : ""}`}
                onClick={() => setActiveMode(mode)}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
            <button
              type="button"
              className="documentation-page__mode-info-button"
              aria-label="Mais informacoes sobre os modos do chat"
              aria-expanded={isModeInfoOpen}
              onClick={() => setIsModeInfoOpen((previous) => !previous)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 17v-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 8h.01"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
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
              <div className="documentation-page__messages-empty-state">
                <div className="documentation-page__messages-empty-avatar" aria-hidden="true">
                  AI
                </div>
                <h3>Vamos comecar esta doc?</h3>
                <p>
                  Digite livremente no chat. Se pedir para reescrever, revisar ou melhorar, eu atualizo o conteudo da
                  doc automaticamente.
                </p>
              </div>
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
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="Converse com a IA sobre esta doc. Ex.: Reescreva de forma mais objetiva."
                className="documentation-page__composer-input"
              />
              <button
                type="button"
                className="documentation-page__send-button"
                aria-label="Enviar mensagem"
                disabled={!canSend}
                onClick={() => void handleRunAssistant()}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 19 19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 5h10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="documentation-page__composer-hint">Enter envia - Shift + Enter quebra linha</p>
            {lastRunLatencyMs !== null ? (
              <p className="documentation-page__composer-latency">{`Ultima resposta: ${(lastRunLatencyMs / 1000).toFixed(1)}s`}</p>
            ) : null}
            <label className="documentation-page__composer-checkbox">
              <input
                type="checkbox"
                checked={includeSemanticContext}
                onChange={(event) => setIncludeSemanticContext(event.target.checked)}
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
      </div>
    </AppShell>
  );
}
