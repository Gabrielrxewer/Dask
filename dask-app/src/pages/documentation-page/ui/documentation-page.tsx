import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics, type Task } from "@/entities/task";
import {
  documentVariableRegistry,
  resolveDocumentMarkdown,
  useCreateDocumentMutation,
  useCreateFolderMutation,
  useDecideCommercialDocumentMutation,
  useDeleteDocumentMutation,
  useDeleteFolderMutation,
  useDocumentsQuery,
  useFoldersQuery,
  usePublicCommercialDocumentDecisionMutation,
  useRunDocumentationAssistantMutation,
  useSendCommercialDocumentMutation,
  useUpdateDocumentMutation,
  useUpdateFolderMutation,
  useUploadDocumentAssetMutation,
  type CommercialDocumentSendInput,
  type DocumentVariableDiagnostic
} from "@/modules/documentation";
import { getDocumentTemplate } from "@/modules/workspace/model/document-templates";
import {
  useWorkspace,
  useWorkspaceCustomerLookupAction,
  type DocumentKind,
  type DocumentationAssistantMode,
  type WorkspaceDocument,
  type WorkspaceDocumentFolder,
  type WorkspaceDocumentMetadata
} from "@/modules/workspace";
import { buildWorkspaceBoardPathWithTask } from "@/app/router";
import { AppIcon, Button, ConfirmModal, LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { DocumentationAssistantPanel } from "./documentation-assistant-panel";
import { DocumentationCreateModal } from "./documentation-create-modal";
import { DocumentationEditorPanel } from "./documentation-editor-panel";
import type { MarkdownEditorHandle } from "./editable-markdown-preview";
import { DocumentationFilesPane } from "./documentation-files-pane";
import { DocumentationFolderDialog } from "./documentation-folder-dialog";
import { DocumentationSendModal } from "./documentation-send-modal";
import { DocumentationTopNavigation } from "./documentation-top-navigation";
import {
  buildAssistantConversationHistory,
  buildFolderAssistantContent,
  countDocumentWords,
  filterDocumentationDocs,
  getFolderDescendantIds,
  getFolderDocuments,
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
  type DocumentKindFilter
} from "./documentation-page.local";
import { useDocumentAutosave } from "./use-document-autosave";
import "./documentation-page.css";

type DecisionState = "idle" | "submitting" | "success" | "error";
type FolderDialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "rename"; folderId: string };
type AssistantSuggestion = {
  id: string;
  docId: string;
  mode: DocumentationAssistantMode;
  action: "replace_document" | "append_document";
  content: string;
};

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
    metadata.workItemId
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
    isLoading
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
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [folders, setFolders] = useState<WorkspaceDocumentFolder[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [documentKindFilter, setDocumentKindFilter] = useState<DocumentKindFilter>("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [sendModalDocId, setSendModalDocId] = useState<string | null>(null);
  const [sendModalCustomerEmails, setSendModalCustomerEmails] = useState<string[]>([]);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantSuggestion, setAssistantSuggestion] = useState<AssistantSuggestion | null>(null);
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, AssistantMessage[]>>({});
  const [selectedSnippet, setSelectedSnippet] = useState("");
  const [activeMode, setActiveMode] = useState<DocumentationAssistantMode>("chat");
  const [isModeInfoOpen, setIsModeInfoOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [includeSemanticContext, setIncludeSemanticContext] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunLatencyMs, setLastRunLatencyMs] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [internalDecisionState, setInternalDecisionState] = useState<DecisionState>("idle");
  const [internalDecisionError, setInternalDecisionError] = useState<string | null>(null);
  const [clientDecisionState, setClientDecisionState] = useState<DecisionState>("idle");
  const [clientDecisionError, setClientDecisionError] = useState<string | null>(null);

  const documentQueryFilters = useMemo(
    () => ({
      search: documentSearch.trim() || undefined,
      type: documentKindFilter === "all" ? undefined : documentKindFilter,
      tags: selectedTagFilters
    }),
    [documentKindFilter, documentSearch, selectedTagFilters]
  );

  const documentsQuery = useDocumentsQuery(workspaceSlug, documentQueryFilters);
  const foldersQuery = useFoldersQuery(workspaceSlug);
  const createDocumentMutation = useCreateDocumentMutation(workspaceSlug);
  const updateDocumentMutation = useUpdateDocumentMutation(workspaceSlug);
  const deleteDocumentMutation = useDeleteDocumentMutation(workspaceSlug);
  const createFolderMutation = useCreateFolderMutation(workspaceSlug);
  const updateFolderMutation = useUpdateFolderMutation(workspaceSlug);
  const deleteFolderMutation = useDeleteFolderMutation(workspaceSlug);
  const sendDocumentMutation = useSendCommercialDocumentMutation(workspaceSlug);
  const decideDocumentMutation = useDecideCommercialDocumentMutation(workspaceSlug);
  const publicDecisionMutation = usePublicCommercialDocumentDecisionMutation();
  const uploadAssetMutation = useUploadDocumentAssetMutation(workspaceSlug);
  const runDocumentationAssistantMutation = useRunDocumentationAssistantMutation(workspaceSlug);
  const listCustomers = useWorkspaceCustomerLookupAction(workspaceSlug || null);

  useEffect(() => {
    if (isClient) {
      setIsAssistantOpen(false);
      setIsCreateModalOpen(false);
      setSendModalDocId(null);
    }
  }, [isClient]);

  useEffect(() => {
    setInternalDecisionState("idle");
    setInternalDecisionError(null);
    setClientDecisionState("idle");
    setClientDecisionError(null);
    setAssistantSuggestion((current) => current && current.docId !== activeDocId ? null : current);
  }, [activeDocId]);

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
  const availableTags = useMemo(
    () => Array.from(new Set(docs.flatMap((doc) => doc.tags ?? []))).sort((left, right) => left.localeCompare(right)),
    [docs]
  );

  const activeMessages = useMemo(() => {
    const chatKey = activeDoc?.id ?? (activeFolder ? `folder:${activeFolder.id}` : null);
    if (!chatKey) {
      return [];
    }
    return chatsByDoc[chatKey] ?? [];
  }, [activeFolder, chatsByDoc, activeDoc]);

  const wordCount = useMemo(() => countDocumentWords(activeDoc), [activeDoc]);

  const activeLinkedTask = useMemo(
    () => activeDoc ? findLinkedTask(activeDoc, snapshot?.tasks ?? []) : null,
    [activeDoc, snapshot?.tasks]
  );

  const renderedDocument = useMemo(() => {
    if (!activeDoc) {
      return { markdown: "", diagnostics: [] as DocumentVariableDiagnostic[] };
    }

    const resolved = resolveDocumentMarkdown(activeDoc.content, {
      document: activeDoc,
      workItem: activeLinkedTask,
      workspace: snapshot
    });

    return {
      ...resolved,
      markdown: resolved.markdown.replace(/!\[Logo do cliente\]\(\s*\)\s*/g, "")
    };
  }, [activeDoc, activeLinkedTask, snapshot]);

  const renderedMarkdown = renderedDocument.markdown;
  const variableDiagnostics = renderedDocument.diagnostics;

  const pushMessage = useCallback((docId: string, message: AssistantMessage) => {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }, []);

  const replaceDocWithServerVersion = useCallback((nextDoc: WorkspaceDocument) => {
    setDocs((previous) => previous.map((doc) => (doc.id === nextDoc.id ? nextDoc : doc)));
  }, []);

  const autosave = useDocumentAutosave({
    readOnly: isClient,
    updateDocument: updateDocumentMutation.mutateAsync,
    onSaved: replaceDocWithServerVersion
  });

  const updateDocDraft = useCallback((docId: string, patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "kind" | "tags" | "metadata">>) => {
    if (isClient) return;

    let nextDraft: WorkspaceDocument | null = null;
    setDocs((previous) =>
      previous.map((doc) => {
        if (doc.id !== docId) return doc;
        nextDraft = { ...doc, ...patch };
        return nextDraft;
      })
    );
    if (nextDraft) autosave.queue(nextDraft);
  }, [autosave, isClient]);

  const appendDocDraft = useCallback((docId: string, chunk: string) => {
    let nextDraft: WorkspaceDocument | null = null;
    setDocs((previous) =>
      previous.map((doc) => {
        if (doc.id !== docId) {
          return doc;
        }
        nextDraft = {
          ...doc,
          content: doc.content.trim().length === 0 ? chunk : `${doc.content.trimEnd()}\n\n${chunk}`
        };
        return nextDraft;
      })
    );
    if (nextDraft) autosave.queue(nextDraft);
  }, [autosave]);

  const selectDoc = useCallback(async (docId: string) => {
    if (activeDocId && activeDocId !== docId) {
      await autosave.flush(activeDocId);
    }
    setActiveDocId(docId);
    setActiveFolderId(null);
  }, [activeDocId, autosave]);

  const selectFolder = useCallback(async (folderId: string) => {
    if (activeDocId) {
      await autosave.flush(activeDocId);
    }
    setActiveFolderId(folderId);
    setActiveDocId(null);
    setSelectedSnippet("");
  }, [activeDocId, autosave]);

  useEffect(() => {
    setIsDocsLoading(documentsQuery.isLoading || foldersQuery.isLoading);
    if (documentsQuery.error || foldersQuery.error) {
      const error = documentsQuery.error ?? foldersQuery.error;
      setLoadError(error instanceof Error ? error.message : "Falha ao carregar docs.");
      return;
    }
    setLoadError(null);
  }, [documentsQuery.error, documentsQuery.isLoading, foldersQuery.error, foldersQuery.isLoading]);

  useEffect(() => {
    if (!documentsQuery.data) return;

    const fetchedDocs = documentsQuery.data;
    setDocs((currentDocs) => {
      const dirtyIds = new Set(currentDocs.filter((doc) => autosave.isDirty(doc.id)).map((doc) => doc.id));
      return fetchedDocs.map((doc) => currentDocs.find((current) => current.id === doc.id && dirtyIds.has(doc.id)) ?? doc);
    });
    setActiveDocId((current) => {
      if (initialDocId && fetchedDocs.some((doc) => doc.id === initialDocId)) {
        return initialDocId;
      }
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
      folders.forEach((folder) => {
        const key = `folder:${folder.id}`;
        if (previous[key]) {
          next[key] = previous[key];
        }
      });
      return next;
    });
  }, [autosave.isDirty, documentsQuery.data, folders, initialDocId]);

  useEffect(() => {
    if (!foldersQuery.data) return;
    const fetchedFolders = foldersQuery.data;
    setFolders(fetchedFolders);
    setActiveFolderId((current) =>
      current && fetchedFolders.some((folder) => folder.id === current) ? current : null
    );
  }, [foldersQuery.data]);

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

  async function sendActiveCommercialDocument(input: CommercialDocumentSendInput) {
    if (!sendModalDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    await autosave.flush(sendModalDoc.id);
    if (autosave.isDirty(sendModalDoc.id)) {
      throw new Error("Nao foi possivel salvar as alteracoes antes do envio.");
    }

    const sentDocument = await sendDocumentMutation.mutateAsync({
      documentId: sendModalDoc.id,
      emails: input.recipients,
      subject: input.subject,
      message: input.message,
      includeAttachments: input.includeAttachments,
      selectedAssetIds: input.selectedAssetIds,
      expirationDate: input.expirationDate,
      requireLogin: input.requireLogin,
      allowAcceptReject: input.allowAcceptReject,
      linkedWorkItemId: input.linkedWorkItemId,
      resolvedPreviewSnapshot: renderedMarkdown
    });
    replaceDocWithServerVersion(sentDocument);
  }

  async function createNewDoc(kind: DocumentKind) {
    setRunError(null);
    setSaveError(null);

    try {
      const template = getDocumentTemplate(kind);
      const created = await createDocumentMutation.mutateAsync({
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
      const duplicated = await createDocumentMutation.mutateAsync({
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
      await deleteDocumentMutation.mutateAsync(activeDoc.id);
      autosave.discard(activeDoc.id);
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

  function handleEditorSelection(selectedText: string) {
    setSelectedSnippet(selectedText.trim().slice(0, 6000));
  }

  function focusEditorAtSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.focus();
      editor.setSelectionRange(start, end);
      handleEditorSelection(editor.getSelectedText());
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
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const value = editor.getValue();
    const { start: selectionStart, end: selectionEnd } = editor.getSelection();
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
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const value = editor.getValue();
    const { start: selectionStart, end: selectionEnd } = editor.getSelection();
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
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const value = editor.getValue();
    const { start: selectionStart, end: selectionEnd } = editor.getSelection();
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

  function insertVariable(variableKey: string) {
    if (!activeDoc) {
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      updateDocDraft(activeDoc.id, {
        content: `${activeDoc.content}${activeDoc.content.endsWith(" ") || activeDoc.content.length === 0 ? "" : " "}{{${variableKey}}}`
      });
      return;
    }

    const value = editor.getValue();
    const { start: selectionStart, end: selectionEnd } = editor.getSelection();
    const insertion = `{{${variableKey}}}`;
    const nextContent = `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`;
    const cursor = selectionStart + insertion.length;
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
      const result = await runDocumentationAssistantMutation.mutateAsync({
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
        setAssistantSuggestion({
          id: `${activeDoc.id}:${Date.now()}`,
          docId: activeDoc.id,
          mode: inferredMode,
          action: "replace_document",
          content: result.updatedDocument
        });
        pushMessage(chatKey, createMessage("system", inferredMode, "A IA preparou uma substituicao. Revise e aplique se estiver de acordo."));
      }

      if (activeDoc && result.action === "append_document" && result.updatedDocument) {
        setAssistantSuggestion({
          id: `${activeDoc.id}:${Date.now()}`,
          docId: activeDoc.id,
          mode: inferredMode,
          action: "append_document",
          content: result.updatedDocument
        });
        pushMessage(chatKey, createMessage("system", inferredMode, "A IA preparou um trecho novo. Revise e aplique se estiver de acordo."));
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

  function applyAssistantSuggestion() {
    if (!assistantSuggestion) {
      return;
    }

    if (assistantSuggestion.action === "replace_document") {
      updateDocDraft(assistantSuggestion.docId, { content: assistantSuggestion.content });
    } else {
      appendDocDraft(assistantSuggestion.docId, assistantSuggestion.content);
    }

    const chatKey = assistantSuggestion.docId;
    pushMessage(chatKey, createMessage("system", assistantSuggestion.mode, "Sugestao aplicada ao rascunho da doc."));
    setAssistantSuggestion(null);
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
  const canInternalDecideDocument = Boolean(
    !isClient &&
      activeDoc &&
      (activeDocKind === "proposal" || activeDocKind === "contract") &&
      (internalDecisionState === "success" || ["sent", "viewed"].includes(activeCommercialStatus))
  );
  const canSend = !isRunning && !isLoading && !isDocsLoading && Boolean(activeDoc || activeFolder);
  const { status: assistantStatus, tone: assistantTone } = resolveDocumentationAssistantStatus({
    isRunning,
    activeDocId: activeDoc?.id ?? null,
    isSavingDocId: autosave.isSavingDocId
  });
  const activeSaveError = saveError ?? autosave.saveError;

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleRunAssistant();
      }
    }
  }

  function toggleTagFilter(tag: string) {
    setSelectedTagFilters((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]
    );
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

  async function submitFolderDialog(name: string) {
    if (!folderDialog || !name.trim()) {
      return;
    }

    setRunError(null);
    try {
      if (folderDialog.mode === "create") {
        const parentId = folderDialog.parentId;
        const created = await createFolderMutation.mutateAsync({
          name: name.trim(),
          parentId,
          position: folders.filter((folder) => (folder.parentId ?? null) === parentId).length
        });
        setFolders((previous) => [...previous, created]);
        await selectFolder(created.id);
      } else {
        const folder = folders.find((entry) => entry.id === folderDialog.folderId);
        if (!folder || name.trim() === folder.name) {
          setFolderDialog(null);
          return;
        }
        const updated = await updateFolderMutation.mutateAsync({ folderId: folder.id, patch: { name: name.trim() } });
        setFolders((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
      }
      setFolderDialog(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao salvar pasta.");
    }
  }

  async function confirmDeleteFolder() {
    const folderId = deleteFolderId;
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) {
      return;
    }

    setRunError(null);
    try {
      await deleteFolderMutation.mutateAsync(folder.id);
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
      setDeleteFolderId(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao excluir pasta.");
    }
  }

  async function moveDocToFolder(docId: string, folderId: string | null) {
    const doc = docs.find((entry) => entry.id === docId);
    if (!doc) {
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
      const updated = await updateDocumentMutation.mutateAsync({
        documentId: docId,
        patch: { metadata, expectedUpdatedAt: doc.updatedAt }
      });
      replaceDocWithServerVersion(updated);
      setSaveError(null);
    } catch (error) {
      replaceDocWithServerVersion(doc);
      setSaveError(error instanceof Error ? error.message : "Falha ao mover doc.");
    }
  }

  async function moveFolderToFolder(folderId: string, parentId: string | null) {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder || folder.parentId === parentId) {
      return;
    }

    if (parentId) {
      const descendantIds = new Set(getFolderDescendantIds(folders, folder.id));
      if (parentId === folder.id || descendantIds.has(parentId)) {
        setSaveError("Nao e possivel mover uma pasta para dentro dela mesma.");
        return;
      }
    }

    setFolders((previous) =>
      previous.map((entry) => entry.id === folderId ? { ...entry, parentId } : entry)
    );
    try {
      const updated = await updateFolderMutation.mutateAsync({
        folderId,
        patch: {
          parentId,
          position: folders.filter((entry) => (entry.parentId ?? null) === parentId).length
        }
      });
      setFolders((previous) => previous.map((entry) => entry.id === updated.id ? updated : entry));
      setSaveError(null);
    } catch (error) {
      setFolders((previous) => previous.map((entry) => entry.id === folder.id ? folder : entry));
      setSaveError(error instanceof Error ? error.message : "Falha ao mover pasta.");
    }
  }

  async function submitInternalDocumentDecision(decision: "approve" | "accept" | "sign" | "reject") {
    if (!activeDoc || internalDecisionState === "submitting") {
      return;
    }

    setInternalDecisionState("submitting");
    setInternalDecisionError(null);

    try {
      const updated = await decideDocumentMutation.mutateAsync({
        documentId: activeDoc.id,
        decision
      });
      replaceDocWithServerVersion(updated);
      setInternalDecisionState("success");
    } catch (error) {
      setInternalDecisionState("error");
      setInternalDecisionError(error instanceof Error ? error.message : "Nao foi possivel registrar a decisao.");
    }
  }

  async function submitClientDocumentDecision(decision: "approve" | "accept" | "reject") {
    if (!activeDoc || !clientDocumentToken || clientDecisionState === "submitting" || publicDecisionMutation.isPending) {
      return;
    }

    setClientDecisionState("submitting");
    setClientDecisionError(null);

    try {
      await publicDecisionMutation.mutateAsync({ publicAccessId: clientDocumentToken, decision });
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
    delete nextMetadata.logoAssetId;
    updateDocDraft(activeDoc.id, { metadata: nextMetadata });
  }

  async function handleClientLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!activeDoc) {
      return;
    }

    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    try {
      setUploadProgress(0);
      const asset = await uploadAssetMutation.mutateAsync({
        documentId: activeDoc.id,
        type: "logo",
        file,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        onProgress: (progress) => setUploadProgress(progress.percent)
      });
      updateDocDraft(activeDoc.id, {
        metadata: {
          ...(activeDoc.metadata ?? {}),
          logoAssetId: asset.id,
          clientLogoUrl: asset.contentUrl
        }
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Nao foi possivel enviar o logo.");
    } finally {
      setUploadProgress(null);
    }
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
      {folderDialog ? (
        <DocumentationFolderDialog
          mode={folderDialog.mode}
          initialName={folderDialog.mode === "rename" ? folders.find((folder) => folder.id === folderDialog.folderId)?.name ?? "" : ""}
          isSubmitting={createFolderMutation.isPending || updateFolderMutation.isPending}
          onClose={() => setFolderDialog(null)}
          onSubmit={submitFolderDialog}
        />
      ) : null}
      {deleteFolderId ? (
        <ConfirmModal
          titleId="documentation-delete-folder-title"
          title="Excluir pasta"
          description={`As docs da pasta "${folders.find((folder) => folder.id === deleteFolderId)?.name ?? "selecionada"}" voltam para a raiz.`}
          confirmLabel="Excluir pasta"
          tone="danger"
          isConfirming={deleteFolderMutation.isPending}
          onClose={() => setDeleteFolderId(null)}
          onConfirm={() => void confirmDeleteFolder()}
        />
      ) : null}
      <WorkspaceFrame className={`documentation-page${!isClient && isAssistantOpen ? " documentation-page--assistant-open" : ""}`}>
        <LoadingState
          text="Carregando documentação..."
          animation="documentation"
          variant="frame"
          visible={isLoading || isDocsLoading}
        />
        {loadError || activeSaveError || runError ? (
          <div className="documentation-page__error-banner" role="alert">
            <strong>Atencao</strong>
            <span>{loadError ?? activeSaveError ?? runError}</span>
          </div>
        ) : null}
        <DocumentationFilesPane
          docsCount={docs.length}
          filteredDocs={filteredDocs}
          folders={folders}
          activeDocId={activeDoc?.id ?? null}
          activeFolderId={activeFolder?.id ?? null}
          documentKindFilter={documentKindFilter}
          search={documentSearch}
          tags={availableTags}
          selectedTags={selectedTagFilters}
          fromCard={fromCard}
          isDocsLoading={isDocsLoading}
          canManageFolders={!fromCard}
          currentUserId={snapshot?.currentUserId ?? null}
          isClient={Boolean(isClient)}
          onFilterChange={setDocumentKindFilter}
          onSearchChange={setDocumentSearch}
          onToggleTag={toggleTagFilter}
          onSelectDoc={selectDoc}
          onSelectFolder={selectFolder}
          onCreateFolder={(parentId) => setFolderDialog({ mode: "create", parentId: parentId ?? null })}
          onRenameFolder={(folderId) => setFolderDialog({ mode: "rename", folderId })}
          onDeleteFolder={(folderId) => setDeleteFolderId(folderId)}
          onMoveDocToFolder={(docId, folderId) => void moveDocToFolder(docId, folderId)}
          onMoveFolderToFolder={(folderId, parentId) => void moveFolderToFolder(folderId, parentId)}
        />

        <DocumentationEditorPanel
          activeDoc={activeDoc}
          activeDocKind={activeDocKind}
          linkedWorkItem={activeLinkedTask}
          editorRef={editorRef}
          logoFileInputRef={logoFileInputRef}
          selectedSnippet={selectedSnippet}
          wordCount={wordCount}
          renderedMarkdown={renderedMarkdown}
          variableDiagnostics={variableDiagnostics}
          variableItems={documentVariableRegistry.map((variable) => ({
            id: variable.key,
            label: variable.label,
            hint: variable.key
          }))}
          autosaveStatus={activeDoc ? autosave.statusByDocId[activeDoc.id] ?? "saved" : "saved"}
          saveError={activeSaveError}
          uploadProgress={uploadProgress}
          readOnly={isClient}
          clientDecision={
            canClientDecideDocument
              ? {
                  positiveLabel: activeDocKind === "proposal" ? "Aprovar proposta" : "Aceitar contrato",
                  description: "Seu aceite fica registrado com sua identidade autenticada.",
                  isSubmitting: clientDecisionState === "submitting" || publicDecisionMutation.isPending,
                  error: clientDecisionError,
                  success: clientDecisionState === "success",
                  onAccept: () =>
                    void submitClientDocumentDecision(activeDocKind === "proposal" ? "approve" : "accept"),
                  onReject: () => void submitClientDocumentDecision("reject")
                }
              : canInternalDecideDocument
                ? {
                    positiveLabel: activeDocKind === "proposal" ? "Aprovar internamente" : "Aceitar internamente",
                    description: "A decisao interna fica registrada com versao e hash do documento.",
                    isSubmitting: internalDecisionState === "submitting",
                    error: internalDecisionError,
                    success: internalDecisionState === "success",
                    onAccept: () =>
                      void submitInternalDocumentDecision(activeDocKind === "proposal" ? "approve" : "accept"),
                    onReject: () => void submitInternalDocumentDecision("reject")
                  }
              : undefined
          }
          onUpdateDocDraft={updateDocDraft}
          onUpdateProposalMetadata={updateActiveProposalMetadata}
          onChooseClientLogoFile={() => logoFileInputRef.current?.click()}
          onRemoveClientLogo={removeClientLogo}
          onClientLogoFileChange={handleClientLogoFileChange}
          onMarkdownToolbarAction={handleMarkdownToolbarAction}
          onInsertVariable={insertVariable}
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
          saveError={activeSaveError}
          runError={runError}
          pendingSuggestion={assistantSuggestion?.docId === activeDoc?.id ? assistantSuggestion : null}
          onClose={() => setIsAssistantOpen(false)}
          onClearChat={clearActiveChat}
          onModeChange={setActiveMode}
          onToggleModeInfo={() => setIsModeInfoOpen((previous) => !previous)}
          onPromptChange={setPrompt}
          onPromptKeyDown={handlePromptKeyDown}
          onRunAssistant={() => void handleRunAssistant()}
          onApplySuggestion={applyAssistantSuggestion}
          onDismissSuggestion={() => setAssistantSuggestion(null)}
          onSemanticContextChange={setIncludeSemanticContext}
        />
        ) : null}
      </WorkspaceFrame>
    </AppShell>
  );
}
