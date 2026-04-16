import { useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace, type DocumentationAssistantMode } from "@/modules/workspace";
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

interface DocPage {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredDocumentationState {
  docs: DocPage[];
  activeDocId: string | null;
  chatsByDoc: Record<string, AssistantMessage[]>;
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

function createDefaultDoc(): DocPage {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "Nova doc",
    content: "",
    createdAt: now,
    updatedAt: now
  };
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

function buildStoredState(raw: string | null): StoredDocumentationState {
  if (!raw) {
    const defaultDoc = createDefaultDoc();
    return {
      docs: [defaultDoc],
      activeDocId: defaultDoc.id,
      chatsByDoc: {}
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDocumentationState>;
    const docs = Array.isArray(parsed.docs) && parsed.docs.length > 0 ? parsed.docs : [createDefaultDoc()];
    const activeDocId = docs.some((doc) => doc.id === parsed.activeDocId)
      ? (parsed.activeDocId ?? docs[0].id)
      : docs[0].id;
    const chatsByDoc = parsed.chatsByDoc && typeof parsed.chatsByDoc === "object" ? parsed.chatsByDoc : {};
    return { docs, activeDocId, chatsByDoc };
  } catch {
    const defaultDoc = createDefaultDoc();
    return {
      docs: [defaultDoc],
      activeDocId: defaultDoc.id,
      chatsByDoc: {}
    };
  }
}

export function DocumentationPage() {
  const { snapshot, isLoading, runDocumentationAssistant } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const storageKey = useMemo(() => `dask-doc-v2:${snapshot?.id ?? "workspace"}`, [snapshot?.id]);

  const [docs, setDocs] = useState<DocPage[]>([createDefaultDoc()]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, AssistantMessage[]>>({});
  const [selectedSnippet, setSelectedSnippet] = useState("");
  const [activeMode, setActiveMode] = useState<DocumentationAssistantMode>("chat");
  const [prompt, setPrompt] = useState("");
  const [includeSemanticContext, setIncludeSemanticContext] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    const stored = buildStoredState(localStorage.getItem(storageKey));
    setDocs(stored.docs);
    setActiveDocId(stored.activeDocId);
    setChatsByDoc(stored.chatsByDoc);
  }, [storageKey]);

  useEffect(() => {
    if (!activeDocId || docs.some((doc) => doc.id === activeDocId)) {
      return;
    }
    setActiveDocId(docs[0]?.id ?? null);
  }, [activeDocId, docs]);

  useEffect(() => {
    const state: StoredDocumentationState = {
      docs,
      activeDocId,
      chatsByDoc
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, docs, activeDocId, chatsByDoc]);

  const activeDoc = useMemo(() => {
    return docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;
  }, [docs, activeDocId]);

  const activeMessages = useMemo(() => {
    if (!activeDoc) {
      return [];
    }
    return chatsByDoc[activeDoc.id] ?? [];
  }, [chatsByDoc, activeDoc]);

  function updateDoc(docId: string, patch: Partial<Pick<DocPage, "title" | "content">>) {
    setDocs((previous) =>
      previous.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              ...patch,
              updatedAt: new Date().toISOString()
            }
          : doc
      )
    );
  }

  function pushMessage(docId: string, message: AssistantMessage) {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }

  function createNewDoc() {
    const now = new Date().toISOString();
    const nextDoc: DocPage = {
      id: createId(),
      title: `Nova doc ${docs.length + 1}`,
      content: "",
      createdAt: now,
      updatedAt: now
    };
    setDocs((previous) => [nextDoc, ...previous]);
    setActiveDocId(nextDoc.id);
    setRunError(null);
    setSelectedSnippet("");
  }

  function duplicateActiveDoc() {
    if (!activeDoc) {
      return;
    }

    const now = new Date().toISOString();
    const duplicated: DocPage = {
      ...activeDoc,
      id: createId(),
      title: `${activeDoc.title} (copia)`,
      createdAt: now,
      updatedAt: now
    };

    setDocs((previous) => [duplicated, ...previous]);
    setActiveDocId(duplicated.id);
  }

  function removeActiveDoc() {
    if (!activeDoc) {
      return;
    }

    if (docs.length <= 1) {
      const replacement = createDefaultDoc();
      setDocs([replacement]);
      setActiveDocId(replacement.id);
      setChatsByDoc({});
      return;
    }

    const nextDocs = docs.filter((doc) => doc.id !== activeDoc.id);
    setDocs(nextDocs);
    setActiveDocId(nextDocs[0]?.id ?? null);
    setChatsByDoc((previous) => {
      const next = { ...previous };
      delete next[activeDoc.id];
      return next;
    });
  }

  function handleEditorSelection(textarea: HTMLTextAreaElement) {
    const nextSelection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
    setSelectedSnippet(nextSelection.slice(0, 6000));
  }

  async function handleRunAssistant() {
    if (!activeDoc) {
      return;
    }

    const instruction = (prompt.trim() || DEFAULT_INSTRUCTIONS[activeMode]).slice(0, 6000);
    const inferredMode = inferIntentMode(instruction, activeMode);
    pushMessage(activeDoc.id, createMessage("user", inferredMode, instruction));
    setRunError(null);
    setIsRunning(true);

    try {
      const result = await runDocumentationAssistant({
        mode: inferredMode,
        instruction,
        documentTitle: activeDoc.title,
        documentContent: activeDoc.content,
        selection: selectedSnippet || undefined,
        includeSemanticContext,
        topKContextDocs: 5
      });

      pushMessage(activeDoc.id, createMessage("assistant", inferredMode, result.content));

      if (result.action === "replace_document" && result.updatedDocument) {
        updateDoc(activeDoc.id, { content: result.updatedDocument });
        pushMessage(
          activeDoc.id,
          createMessage("system", inferredMode, "A IA atualizou esta doc automaticamente.")
        );
      }

      if (result.action === "append_document" && result.updatedDocument) {
        const nextContent =
          activeDoc.content.trim().length === 0
            ? result.updatedDocument
            : `${activeDoc.content.trimEnd()}\n\n${result.updatedDocument}`;
        updateDoc(activeDoc.id, { content: nextContent });
        pushMessage(
          activeDoc.id,
          createMessage("system", inferredMode, "A IA anexou novo trecho nesta doc.")
        );
      }

      setPrompt("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao processar IA de documentacao.");
      pushMessage(
        activeDoc.id,
        createMessage("system", inferredMode, "Nao foi possivel processar sua solicitacao agora.")
      );
    } finally {
      setIsRunning(false);
    }
  }

  const canDeleteDoc = docs.length > 1;

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
            <Button type="button" size="sm" onClick={createNewDoc}>
              Nova doc
            </Button>
          </header>

          <div className="documentation-page__files-actions">
            <Button type="button" size="sm" variant="outline" onClick={duplicateActiveDoc} disabled={!activeDoc}>
              Duplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={removeActiveDoc}
              disabled={!activeDoc || !canDeleteDoc}
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
          </nav>
        </aside>

        <section className="documentation-page__editor-pane">
          {activeDoc ? (
            <>
              <header className="documentation-page__editor-header">
                <div className="documentation-page__editor-title">
                  <TextInput
                    value={activeDoc.title}
                    onChange={(event) => updateDoc(activeDoc.id, { title: event.target.value })}
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
                onChange={(event) => updateDoc(activeDoc.id, { content: event.target.value })}
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
            <p>Nenhuma doc selecionada.</p>
          )}
        </section>

        <aside className="documentation-page__assistant-pane">
          <header className="documentation-page__assistant-header">
            <div>
              <h2>Chat IA</h2>
              <p>{activeDoc ? `ON: ${activeDoc.title}` : "Selecione uma doc"}</p>
            </div>
            <StatusBadge tone={isRunning ? "warning" : "success"}>
              {isRunning ? "Executando" : "Pronta"}
            </StatusBadge>
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
          </div>

          <div className="documentation-page__messages">
            {activeMessages.length === 0 ? (
              <p className="documentation-page__messages-empty">
                Este chat ainda nao tem historico para esta doc.
              </p>
            ) : (
              activeMessages.map((message) => (
                <article
                  key={message.id}
                  className={`documentation-page__message documentation-page__message--${message.role}`}
                >
                  <header>
                    <strong>{message.role === "assistant" ? "Dask AI" : message.role === "user" ? "Voce" : "Sistema"}</strong>
                    <span>{`${MODE_LABELS[message.mode]} • ${formatRelativeDate(message.createdAt)}`}</span>
                  </header>
                  <p>{message.content}</p>
                </article>
              ))
            )}
          </div>

          <div className="documentation-page__composer">
            <Textarea
              rows={4}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Digite livremente. Ex.: Reescreva esta doc deixando mais objetiva."
            />
            <label className="documentation-page__composer-checkbox">
              <input
                type="checkbox"
                checked={includeSemanticContext}
                onChange={(event) => setIncludeSemanticContext(event.target.checked)}
              />
              Enriquecer com contexto do workspace
            </label>
            <Button
              type="button"
              disabled={isRunning || isLoading || !activeDoc}
              onClick={() => void handleRunAssistant()}
            >
              {isRunning ? "Processando..." : "Enviar para IA"}
            </Button>
            {runError ? <p className="documentation-page__error">{runError}</p> : null}
          </div>

          <div className="documentation-page__assistant-footer">
            <p>
              Se voce pedir para reescrever/editar, a IA atualiza a doc automaticamente.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
