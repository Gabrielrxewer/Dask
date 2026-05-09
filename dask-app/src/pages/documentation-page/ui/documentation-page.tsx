import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics, type Task } from "@/entities/task";
import { getDocumentTemplate } from "@/modules/workspace/model/document-templates";
import { useWorkspace, type DocumentKind, type DocumentationAssistantMode, type WorkspaceDocument, type WorkspaceDocumentFolder, type WorkspaceDocumentMetadata } from "@/modules/workspace";
import { buildWorkspaceBoardPathWithTask } from "@/app/router";
import { LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { publicCommercialDocumentService } from "@/pages/proposal-public-page/api/public-commercial-document-service";
import { DocumentationAssistantPanel } from "./documentation-assistant-panel";
import { DocumentationCreateModal } from "./documentation-create-modal";
import { DocumentationEditorPanel } from "./documentation-editor-panel";
import { DocumentationFilesPane } from "./documentation-files-pane";
import { DocumentationSendModal } from "./documentation-send-modal";
import { DocumentationTopNavigation } from "./documentation-top-navigation";
import {
  buildAssistantConversationHistory,
  buildFolderAssistantContent,
  countDocumentWords,
  filterDocumentationDocs,
  getFolderDescendantIds,
  getFolderDocuments,
  renderWorkspaceDocumentMarkdown,
  resolveDocumentationAssistantStatus
} from "./documentation-page.model";
import {
  DEFAULT_INSTRUCTIONS,
  DOCUMENT_KIND_LABELS,
  createMessage,
  getCommercialDocumentStatus,
  inferIntentMode,
  normalizeDocumentKind,
  type AssistantMessage,
  type DocumentKindFilter,
  type EditorViewMode
} from "./documentation-page.local";
import "./documentation-page.css";

type DecisionState = "idle" | "submitting" | "success" | "error";

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmailCandidate(value: unknown): string {
  return readString(value).toLowerCase();
}

function collectEmails(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .map(normalizeEmailCandidate)
        .filter(Boolean)
    )
  );
}

function findLinkedTask(document: WorkspaceDocument, tasks: Task[]): Task | null {
  const metadata = readRecord(document.metadata);
  const candidateIds = [
    document.linkedEntityType === "work_item" ? document.linkedEntityId : "",
    metadata.workItemId,
    metadata.sourceWorkItemId,
    metadata.itemId,
    metadata.taskId,
    metadata.leadId
  ].map(readString).filter(Boolean);

  return tasks.find((task) => candidateIds.includes(task.id)) ?? null;
}

function readLinkedCustomerId(document: WorkspaceDocument, linkedTask: Task | null): string {
  const metadata = readRecord(document.metadata);
  const customer = readRecord(metadata.customer);
  const fields = readRecord(linkedTask?.customFields);

  return [
    document.linkedEntityType === "customer" ? document.linkedEntityId : "",
    metadata.customerId,
    customer.id,
    fields.customerId
  ].map(readString).find(Boolean) ?? "";
}

function collectDocumentRecipientEmails(document: WorkspaceDocument, linkedTask: Task | null): string[] {
  const metadata = readRecord(document.metadata);
  const customer = readRecord(metadata.customer);
  const fields = readRecord(linkedTask?.customFields);

  return collectEmails([
    metadata.sentToEmails,
    metadata.sentToEmail,
    metadata.clientEmail,
    metadata.contactEmail,
    customer.email,
    fields.contactEmail,
    fields.clientEmail,
    fields.email
  ]);
}

export function DocumentationPage() {
  const {
    snapshot,
    isLoading,
    runDocumentationAssistant,
    listWorkspaceDocuments,
    listWorkspaceDocumentFolders,
    listCustomers,
    createWorkspaceDocument,
    createWorkspaceDocumentFolder,
    updateWorkspaceDocumentFolder,
    updateWorkspaceDocument,
    sendWorkspaceDocument,
    deleteWorkspaceDocumentFolder,
    deleteWorkspaceDocument
  } = useWorkspace();
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get("docId");
  const fromCard = searchParams.get("from") === "card";
  const clientDocumentIntent = searchParams.get("intent");
  const clientDocumentToken = searchParams.get("docToken") ?? "";
  const fromCardTaskId = searchParams.get("taskId") ?? "";
  const fromCardBoardMode = searchParams.get("boardMode") ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const isClient = snapshot?.access?.isClient || snapshot?.access?.role === "CLIENT";
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const dirtyDocIdsRef = useRef<Set<string>>(new Set());
  const saveSeqByDocRef = useRef<Record<string, number>>({});

  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [folders, setFolders] = useState<WorkspaceDocumentFolder[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [documentKindFilter, setDocumentKindFilter] = useState<DocumentKindFilter>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sendModalDocId, setSendModalDocId] = useState<string | null>(null);
  const [sendModalCustomerEmails, setSendModalCustomerEmails] = useState<string[]>([]);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, AssistantMessage[]>>({});
  const [selectedSnippet, setSelectedSnippet] = useState("");
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>("split");
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
  const [clientDecisionState, setClientDecisionState] = useState<DecisionState>("idle");
  const [clientDecisionError, setClientDecisionError] = useState<string | null>(null);

  useEffect(() => {
    if (isClient) {
      setEditorViewMode("preview");
      setIsAssistantOpen(false);
      setIsCreateModalOpen(false);
      setSendModalDocId(null);
    }
  }, [isClient]);

  const activeDoc = useMemo(() => {
    return docs.find((doc) => doc.id === activeDocId) ?? null;
  }, [docs, activeDocId]);

  const activeFolder = useMemo(() => {
    return folders.find((folder) => folder.id === activeFolderId) ?? null;
  }, [activeFolderId, folders]);

  const activeFolderDocs = useMemo(() => {
    return activeFolder ? getFolderDocuments(docs, folders, activeFolder.id) : [];
  }, [activeFolder, docs, folders]);

  const activeDocKind = normalizeDocumentKind(activeDoc?.kind);
  const sendModalDoc = useMemo(
    () => docs.find((doc) => doc.id === sendModalDocId) ?? null,
    [docs, sendModalDocId]
  );
  const sendModalLinkedTask = useMemo(
    () => sendModalDoc ? findLinkedTask(sendModalDoc, snapshot?.tasks ?? []) : null,
    [sendModalDoc, snapshot?.tasks]
  );
  const sendModalInitialEmails = useMemo(
    () => sendModalDoc ? collectEmails([...collectDocumentRecipientEmails(sendModalDoc, sendModalLinkedTask), ...sendModalCustomerEmails]) : [],
    [sendModalCustomerEmails, sendModalDoc, sendModalLinkedTask]
  );

  const filteredDocs = useMemo(
    () => filterDocumentationDocs({ docs, documentKindFilter, fromCard, initialDocId }),
    [docs, documentKindFilter, fromCard, initialDocId]
  );

  const activeMessages = useMemo(() => {
    const chatKey = activeDoc?.id ?? (activeFolder ? `folder:${activeFolder.id}` : null);
    if (!chatKey) {
      return [];
    }
    return chatsByDoc[chatKey] ?? [];
  }, [activeFolder, chatsByDoc, activeDoc]);

  const wordCount = useMemo(() => countDocumentWords(activeDoc), [activeDoc]);

  const renderedMarkdown = useMemo(
    () => renderWorkspaceDocumentMarkdown(activeDoc, snapshot),
    [activeDoc, snapshot]
  );

  const pushMessage = useCallback((docId: string, message: AssistantMessage) => {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }, []);

  const updateDocDraft = useCallback((docId: string, patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "kind" | "tags" | "metadata">>) => {
    if (isClient) {
      return;
    }

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
  }, [isClient]);

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

  const selectDoc = useCallback((docId: string) => {
    setActiveDocId(docId);
    setActiveFolderId(null);
  }, []);

  const selectFolder = useCallback((folderId: string) => {
    setActiveFolderId(folderId);
    setActiveDocId(null);
    setSelectedSnippet("");
  }, []);

  const persistDocImmediately = useCallback(
    async (document: WorkspaceDocument) => {
      const nextSequence = (saveSeqByDocRef.current[document.id] ?? 0) + 1;
      saveSeqByDocRef.current[document.id] = nextSequence;
      setIsSavingDocId(document.id);

      try {
        const updated = await updateWorkspaceDocument(document.id, {
          title: document.title,
          content: document.content,
          kind: normalizeDocumentKind(document.kind),
          tags: document.tags ?? [],
          metadata: document.metadata ?? {}
        });

        dirtyDocIdsRef.current.delete(document.id);
        replaceDocWithServerVersion(updated);
        setSaveError(null);
        return updated;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Falha ao salvar esta doc.");
        throw error;
      } finally {
        if (saveSeqByDocRef.current[document.id] === nextSequence) {
          setIsSavingDocId((current) => (current === document.id ? null : current));
        }
      }
    },
    [replaceDocWithServerVersion, updateWorkspaceDocument]
  );

  useEffect(() => {
    let mounted = true;
    setIsDocsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setRunError(null);
    setSelectedSnippet("");
    dirtyDocIdsRef.current = new Set();
    saveSeqByDocRef.current = {};

    Promise.all([listWorkspaceDocuments(), listWorkspaceDocumentFolders()])
      .then(([fetchedDocs, fetchedFolders]) => {
        if (!mounted) {
          return;
        }
        setDocs(fetchedDocs);
        setFolders(fetchedFolders);
        setActiveDocId((current) => {
          if (initialDocId && fetchedDocs.some((doc) => doc.id === initialDocId)) {
            return initialDocId;
          }
          if (current && fetchedDocs.some((doc) => doc.id === current)) {
            return current;
          }
          return fetchedDocs[0]?.id ?? null;
        });
        setActiveFolderId((current) =>
          current && fetchedFolders.some((folder) => folder.id === current) ? current : null
        );
        setChatsByDoc((previous) => {
          const next: Record<string, AssistantMessage[]> = {};
          fetchedDocs.forEach((doc) => {
            if (previous[doc.id]) {
              next[doc.id] = previous[doc.id];
            }
          });
          fetchedFolders.forEach((folder) => {
            const key = `folder:${folder.id}`;
            if (previous[key]) {
              next[key] = previous[key];
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
  }, [listWorkspaceDocumentFolders, listWorkspaceDocuments]);

  useEffect(() => {
    setSelectedSnippet("");
    setSaveError(null);
    setRunError(null);
  }, [activeDoc?.id]);

  useEffect(() => {
    if (activeFolderId) {
      return;
    }

    if (documentKindFilter === "all" && !activeDocId && docs.length > 0) {
      setActiveDocId(docs[0].id);
      return;
    }

    if (documentKindFilter === "all") {
      return;
    }

    if (activeDocId && filteredDocs.some((doc) => doc.id === activeDocId)) {
      return;
    }

    setActiveDocId(filteredDocs[0]?.id ?? null);
  }, [activeDocId, activeFolderId, docs, documentKindFilter, filteredDocs]);

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
          content: document.content,
          kind: normalizeDocumentKind(document.kind),
          tags: document.tags ?? [],
          metadata: document.metadata ?? {}
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
    let active = true;
    setSendModalCustomerEmails([]);

    if (!sendModalDoc) {
      return;
    }

    const linkedTask = findLinkedTask(sendModalDoc, snapshot?.tasks ?? []);
    const customerId = readLinkedCustomerId(sendModalDoc, linkedTask);
    if (!customerId) {
      return;
    }

    listCustomers()
      .then((customers) => {
        if (!active) {
          return;
        }

        const customer = customers.find((entry) => entry.id === customerId);
        setSendModalCustomerEmails(collectEmails([customer?.email]));
      })
      .catch(() => {
        if (active) {
          setSendModalCustomerEmails([]);
        }
      });

    return () => {
      active = false;
    };
  }, [listCustomers, sendModalDoc, snapshot?.tasks]);

  async function sendActiveCommercialDocument(emails: string[]) {
    if (!sendModalDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    if (dirtyDocIdsRef.current.has(sendModalDoc.id)) {
      await persistDocImmediately(sendModalDoc);
    }

    const sentDocument = await sendWorkspaceDocument(sendModalDoc.id, { emails });
    replaceDocWithServerVersion(sentDocument);
  }

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

  async function createNewDoc(kind: DocumentKind) {
    setRunError(null);
    setSaveError(null);

    try {
      const template = getDocumentTemplate(kind);
      const created = await createWorkspaceDocument({
        title: template.title,
        content: template.content,
        kind,
        tags: [DOCUMENT_KIND_LABELS[kind]],
        metadata: template.metadata ?? {},
        position: docs.length
      });
      setDocs((previous) => [...previous, created]);
      setActiveDocId(created.id);
      setActiveFolderId(null);
      setSelectedSnippet("");
      setDocumentKindFilter("all");
      setIsCreateModalOpen(false);
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
        kind: activeDocKind,
        tags: activeDoc.tags ?? [],
        metadata: activeDoc.metadata ?? {},
        position: docs.length
      });
      setDocs((previous) => [...previous, duplicated]);
      setActiveDocId(duplicated.id);
      setActiveFolderId(null);
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

  function focusEditorAtSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const textarea = editorTextareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(start, end);
      handleEditorSelection(textarea);
    });
  }

  function updateEditorFromToolbar(
    nextContent: string,
    selectionStart: number,
    selectionEnd: number
  ) {
    if (!activeDoc) {
      return;
    }
    updateDocDraft(activeDoc.id, { content: nextContent });
    focusEditorAtSelection(selectionStart, selectionEnd);
  }

  function insertInlineSyntax(prefix: string, suffix = prefix, placeholder = "texto") {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const insertionTarget = selected || placeholder;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const insertion = `${prefix}${insertionTarget}${suffix}`;
    const nextContent = `${before}${insertion}${after}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + insertionTarget.length;

    updateEditorFromToolbar(nextContent, cursorStart, cursorEnd);
  }

  function insertLinePrefix(prefix: string, placeholder = "Novo item") {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const insertionTarget = selected || placeholder;
    const transformed = insertionTarget
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const nextContent = `${before}${transformed}${after}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = selectionStart + transformed.length;

    updateEditorFromToolbar(nextContent, cursorStart, cursorEnd);
  }

  function insertBlockTemplate(template: string, selectionOffset = 0) {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const needsLineBreakBefore = before.length > 0 && !before.endsWith("\n");
    const needsLineBreakAfter = after.length > 0 && !after.startsWith("\n");
    const prefix = needsLineBreakBefore ? "\n" : "";
    const suffix = needsLineBreakAfter ? "\n" : "";
    const insertion = `${prefix}${template}${suffix}`;
    const nextContent = `${before}${insertion}${after}`;
    const cursor = selectionStart + prefix.length + selectionOffset;

    updateEditorFromToolbar(nextContent, cursor, cursor);
  }

  function handleMarkdownToolbarAction(action: string) {
    switch (action) {
      case "bold":
        insertInlineSyntax("**");
        return;
      case "italic":
        insertInlineSyntax("*");
        return;
      case "underline":
        insertInlineSyntax("<u>", "</u>");
        return;
      case "strike":
        insertInlineSyntax("~~");
        return;
      case "h1":
        insertLinePrefix("# ", "Titulo principal");
        return;
      case "h2":
        insertLinePrefix("## ", "Subtitulo");
        return;
      case "quote":
        insertLinePrefix("> ", "Citacao");
        return;
      case "ul":
        insertLinePrefix("- ", "Novo item");
        return;
      case "ol":
        insertLinePrefix("1. ", "Novo item");
        return;
      case "check":
        insertLinePrefix("- [ ] ", "Tarefa");
        return;
      case "code-inline":
        insertInlineSyntax("`", "`", "codigo");
        return;
      case "code-block":
        insertBlockTemplate("```ts\n// codigo\n```", 6);
        return;
      case "link":
        insertInlineSyntax("[", "](https://)", "texto do link");
        return;
      case "table":
        insertBlockTemplate("| Coluna A | Coluna B |\n| --- | --- |\n| Valor 1 | Valor 2 |", 2);
        return;
      case "divider":
        insertBlockTemplate("---");
        return;
      default:
        return;
    }
  }

  async function handleRunAssistant() {
    if (!activeDoc && !activeFolder) {
      return;
    }

    const chatKey = activeDoc ? activeDoc.id : `folder:${activeFolder!.id}`;
    const docTitle = activeDoc ? activeDoc.title : `Pasta: ${activeFolder!.name}`;
    const docContent = activeDoc
      ? activeDoc.content
      : buildFolderAssistantContent({ folder: activeFolder!, docs: activeFolderDocs });
    const docPath = activeFolder
      ? `${activeFolder.name} (${activeFolderDocs.length} docs, incluindo subpastas)`
      : undefined;
    const instruction = (prompt.trim() || DEFAULT_INSTRUCTIONS[activeMode]).slice(0, 6000);
    const inferredMode = inferIntentMode(instruction, activeMode);
    const conversationHistory = buildAssistantConversationHistory({
      activeMessages,
      mode: inferredMode,
      instruction
    });

    pushMessage(chatKey, createMessage("user", inferredMode, instruction));
    setRunError(null);
    setIsRunning(true);
    const runStartedAt = Date.now();

    try {
      const result = await runDocumentationAssistant({
        mode: inferredMode,
        instruction,
        documentTitle: docTitle,
        documentPath: docPath,
        documentContent: docContent,
        selection: selectedSnippet || undefined,
        conversationHistory,
        includeSemanticContext,
        topKContextDocs: 5
      });
      setLastRunLatencyMs(Date.now() - runStartedAt);

      pushMessage(chatKey, createMessage("assistant", inferredMode, result.content));

      if (activeDoc && result.action === "replace_document" && result.updatedDocument) {
        updateDocDraft(activeDoc.id, { content: result.updatedDocument });
        pushMessage(chatKey, createMessage("system", inferredMode, "A IA atualizou esta doc automaticamente."));
      }

      if (activeDoc && result.action === "append_document" && result.updatedDocument) {
        appendDocDraft(activeDoc.id, result.updatedDocument);
        pushMessage(chatKey, createMessage("system", inferredMode, "A IA anexou novo trecho nesta doc."));
      }

      if (activeFolder && result.action !== "chat") {
        pushMessage(chatKey, createMessage("system", inferredMode, "Esta conversa analisou a pasta; nenhuma doc foi alterada automaticamente."));
      }

      setPrompt("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao processar IA de documentacao.");
      pushMessage(chatKey, createMessage("system", inferredMode, "Nao foi possivel processar sua solicitacao agora."));
    } finally {
      setIsRunning(false);
    }
  }

  function clearActiveChat() {
    const chatKey = activeDoc?.id ?? (activeFolder ? `folder:${activeFolder.id}` : null);
    if (!chatKey) {
      return;
    }

    setChatsByDoc((previous) => ({
      ...previous,
      [chatKey]: []
    }));
    setRunError(null);
  }

  const canDeleteDoc = docs.length > 0;
  const canSendCommercialDocument = activeDocKind === "proposal" || activeDocKind === "contract";
  const activeCommercialStatus = activeDoc ? getCommercialDocumentStatus(activeDoc) : "draft";
  const canClientDecideDocument = Boolean(
    isClient &&
      activeDoc &&
      clientDocumentIntent === "accept" &&
      clientDocumentToken &&
      (activeDocKind === "proposal" || activeDocKind === "contract") &&
      (clientDecisionState === "success" || !["approved", "accepted", "signed", "rejected"].includes(activeCommercialStatus))
  );
  const canSend = !isRunning && !isLoading && !isDocsLoading && Boolean(activeDoc || activeFolder);
  const { status: assistantStatus, tone: assistantTone } = resolveDocumentationAssistantStatus({
    isRunning,
    activeDocId: activeDoc?.id ?? null,
    isSavingDocId
  });

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleRunAssistant();
      }
    }
  }

  function updateActiveProposalMetadata(patch: WorkspaceDocumentMetadata) {
    if (!activeDoc) {
      return;
    }

    updateDocDraft(activeDoc.id, {
      metadata: {
        ...(activeDoc.metadata ?? {}),
        ...patch
      }
    });
  }

  async function createFolder(parentId: string | null = null) {
    const name = window.prompt(parentId ? "Nome da subpasta" : "Nome da pasta");
    if (!name?.trim()) {
      return;
    }

    setRunError(null);
    try {
      const created = await createWorkspaceDocumentFolder({
        name: name.trim(),
        parentId,
        position: folders.filter((folder) => (folder.parentId ?? null) === parentId).length
      });
      setFolders((previous) => [...previous, created]);
      selectFolder(created.id);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao criar pasta.");
    }
  }

  async function renameFolder(folderId: string) {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) {
      return;
    }

    const name = window.prompt("Nome da pasta", folder.name);
    if (!name?.trim() || name.trim() === folder.name) {
      return;
    }

    setRunError(null);
    try {
      const updated = await updateWorkspaceDocumentFolder(folder.id, { name: name.trim() });
      setFolders((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao editar pasta.");
    }
  }

  async function removeFolder(folderId: string) {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) {
      return;
    }

    const confirmed = window.confirm(`Excluir a pasta "${folder.name}"? As docs voltam para a raiz.`);
    if (!confirmed) {
      return;
    }

    setRunError(null);
    try {
      await deleteWorkspaceDocumentFolder(folder.id);
      const folderIds = new Set([folder.id, ...getFolderDescendantIds(folders, folder.id)]);
      setFolders((previous) => previous.filter((entry) => !folderIds.has(entry.id)));
      setDocs((previous) =>
        previous.map((doc) => {
          const folderIdValue = doc.metadata?.folderId;
          if (typeof folderIdValue !== "string" || !folderIds.has(folderIdValue)) {
            return doc;
          }
          const metadata = { ...(doc.metadata ?? {}) };
          delete metadata.folderId;
          return { ...doc, metadata };
        })
      );
      setActiveFolderId((current) => current && folderIds.has(current) ? null : current);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao excluir pasta.");
    }
  }

  async function moveDocToFolder(docId: string, folderId: string | null) {
    const doc = docs.find((entry) => entry.id === docId);
    if (!doc || isClient) {
      return;
    }

    const metadata = { ...(doc.metadata ?? {}) };
    if (folderId) {
      metadata.folderId = folderId;
    } else {
      delete metadata.folderId;
    }

    setDocs((previous) => previous.map((entry) => entry.id === docId ? { ...entry, metadata } : entry));
    try {
      const updated = await updateWorkspaceDocument(docId, { metadata });
      replaceDocWithServerVersion(updated);
      setSaveError(null);
    } catch (error) {
      replaceDocWithServerVersion(doc);
      setSaveError(error instanceof Error ? error.message : "Falha ao mover doc.");
    }
  }

  async function submitClientDocumentDecision(decision: "approve" | "accept" | "reject") {
    if (!activeDoc || !clientDocumentToken || clientDecisionState === "submitting") {
      return;
    }

    setClientDecisionState("submitting");
    setClientDecisionError(null);

    try {
      await publicCommercialDocumentService.decide(clientDocumentToken, decision);
      const nextStatus =
        decision === "reject"
          ? "rejected"
          : activeDocKind === "proposal"
            ? "approved"
            : "accepted";

      setDocs((previous) =>
        previous.map((doc) =>
          doc.id === activeDoc.id
            ? {
                ...doc,
                metadata: {
                  ...(doc.metadata ?? {}),
                  status: nextStatus
                }
              }
            : doc
        )
      );
      setClientDecisionState("success");
    } catch (error) {
      setClientDecisionState("error");
      setClientDecisionError(error instanceof Error ? error.message : "Nao foi possivel registrar sua decisao.");
    }
  }

  function removeClientLogo() {
    if (!activeDoc) {
      return;
    }

    const nextMetadata = { ...(activeDoc.metadata ?? {}) };
    delete nextMetadata.clientLogoUrl;
    updateDocDraft(activeDoc.id, { metadata: nextMetadata });
  }

  function handleClientLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!activeDoc) {
      return;
    }

    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateDocDraft(activeDoc.id, {
        metadata: {
          ...(activeDoc.metadata ?? {}),
          clientLogoUrl: typeof reader.result === "string" ? reader.result : ""
        }
      });
    };
    reader.readAsDataURL(file);
  }

  const topNavigation = (
    <DocumentationTopNavigation
      fromCard={fromCard}
      disabled={isDocsLoading || isLoading}
      isAssistantOpen={isAssistantOpen}
      hasActiveDoc={Boolean(activeDoc)}
      canDeleteDoc={canDeleteDoc}
      canSendCommercialDocument={!isClient && canSendCommercialDocument && Boolean(activeDoc)}
      readOnly={isClient}
      onBack={() => navigate(buildWorkspaceBoardPathWithTask(workspaceSlug, fromCardTaskId, fromCardBoardMode))}
      onCreate={() => setIsCreateModalOpen(true)}
      onSendCommercialDocument={() => setSendModalDocId(activeDoc?.id ?? null)}
      onToggleAssistant={() => setIsAssistantOpen((previous) => !previous)}
      onDuplicate={() => void duplicateActiveDoc()}
      onDelete={() => void removeActiveDoc()}
    />
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      {isCreateModalOpen ? (
        <DocumentationCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={createNewDoc}
        />
      ) : null}
      {!isClient && sendModalDoc ? (
        <DocumentationSendModal
          document={sendModalDoc}
          initialEmails={sendModalInitialEmails}
          onClose={() => setSendModalDocId(null)}
          onSend={sendActiveCommercialDocument}
        />
      ) : null}
      <WorkspaceFrame className={`documentation-page${!isClient && isAssistantOpen ? " documentation-page--assistant-open" : ""}`}>
        <LoadingState
          text="Carregando documentação..."
          animation="documentation"
          variant="frame"
          visible={isLoading || isDocsLoading}
        />
        <DocumentationFilesPane
          docsCount={docs.length}
          filteredDocs={filteredDocs}
          folders={folders}
          activeDocId={activeDoc?.id ?? null}
          activeFolderId={activeFolder?.id ?? null}
          documentKindFilter={documentKindFilter}
          fromCard={fromCard}
          isDocsLoading={isDocsLoading}
          onFilterChange={setDocumentKindFilter}
          onSelectDoc={selectDoc}
          onSelectFolder={selectFolder}
          onCreateFolder={(parentId) => void createFolder(parentId ?? null)}
          onRenameFolder={(folderId) => void renameFolder(folderId)}
          onDeleteFolder={(folderId) => void removeFolder(folderId)}
          onMoveDocToFolder={(docId, folderId) => void moveDocToFolder(docId, folderId)}
        />

        <DocumentationEditorPanel
          activeDoc={activeDoc}
          activeDocKind={activeDocKind}
          editorTextareaRef={editorTextareaRef}
          logoFileInputRef={logoFileInputRef}
          selectedSnippet={selectedSnippet}
          wordCount={wordCount}
          renderedMarkdown={renderedMarkdown}
          editorViewMode={editorViewMode}
          readOnly={isClient}
          clientDecision={
            canClientDecideDocument
              ? {
                  positiveLabel: activeDocKind === "proposal" ? "Aprovar proposta" : "Aceitar contrato",
                  isSubmitting: clientDecisionState === "submitting",
                  error: clientDecisionError,
                  success: clientDecisionState === "success",
                  onAccept: () =>
                    void submitClientDocumentDecision(activeDocKind === "proposal" ? "approve" : "accept"),
                  onReject: () => void submitClientDocumentDecision("reject")
                }
              : undefined
          }
          onUpdateDocDraft={updateDocDraft}
          onUpdateProposalMetadata={updateActiveProposalMetadata}
          onChooseClientLogoFile={() => logoFileInputRef.current?.click()}
          onRemoveClientLogo={removeClientLogo}
          onClientLogoFileChange={handleClientLogoFileChange}
          onMarkdownToolbarAction={handleMarkdownToolbarAction}
          onEditorViewModeChange={setEditorViewMode}
          onEditorSelection={handleEditorSelection}
        />

        {!isClient ? (
        <DocumentationAssistantPanel
          isAssistantOpen={isAssistantOpen}
          activeDoc={activeDoc}
          activeContextTitle={activeFolder ? `Pasta: ${activeFolder.name}` : activeDoc?.title ?? ""}
          activeMessages={activeMessages}
          isRunning={isRunning}
          assistantTone={assistantTone}
          assistantStatus={assistantStatus}
          activeMode={activeMode}
          isModeInfoOpen={isModeInfoOpen}
          messagesRef={messagesRef}
          promptInputRef={promptInputRef}
          prompt={prompt}
          canSend={canSend}
          lastRunLatencyMs={lastRunLatencyMs}
          includeSemanticContext={includeSemanticContext}
          loadError={loadError}
          saveError={saveError}
          runError={runError}
          onClose={() => setIsAssistantOpen(false)}
          onClearChat={clearActiveChat}
          onModeChange={setActiveMode}
          onToggleModeInfo={() => setIsModeInfoOpen((previous) => !previous)}
          onPromptChange={setPrompt}
          onPromptKeyDown={handlePromptKeyDown}
          onRunAssistant={() => void handleRunAssistant()}
          onSemanticContextChange={setIncludeSemanticContext}
        />
        ) : null}
      </WorkspaceFrame>
    </AppShell>
  );
}
