import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceDocument } from "@/modules/workspace";

export type DocumentAutosaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

interface UseDocumentAutosaveInput {
  readOnly?: boolean;
  debounceMs?: number;
  updateDocument: (input: {
    documentId: string;
    patch: {
      title: string;
      content: string;
      kind: WorkspaceDocument["kind"];
      tags: string[];
      metadata: WorkspaceDocument["metadata"];
      expectedUpdatedAt?: string;
    };
  }) => Promise<WorkspaceDocument>;
  onSaved: (document: WorkspaceDocument) => void;
}

type FlushDocument = (documentId?: string | null) => Promise<WorkspaceDocument | null>;

export interface DocumentAutosavePatch {
  title: string;
  content: string;
  kind: WorkspaceDocument["kind"];
  tags: string[];
  metadata: WorkspaceDocument["metadata"];
  expectedUpdatedAt?: string;
}

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const details = (error as { details?: unknown }).details;
  return (
    (typeof details === "object" && details !== null && (details as { code?: unknown }).code === "DOCUMENT_VERSION_CONFLICT") ||
    /changed since this draft|conflito|conflict/i.test(error.message)
  );
}

export function buildDocumentAutosavePatch(draft: WorkspaceDocument): DocumentAutosavePatch {
  return {
    title: draft.title,
    content: draft.content,
    kind: draft.kind,
    tags: draft.tags ?? [],
    metadata: draft.metadata ?? {},
    expectedUpdatedAt: draft.updatedAt
  };
}

export function useDocumentAutosave({
  readOnly = false,
  debounceMs = 700,
  updateDocument,
  onSaved
}: UseDocumentAutosaveInput) {
  const draftsByDocRef = useRef<Record<string, WorkspaceDocument>>({});
  const dirtyDocIdsRef = useRef<Set<string>>(new Set());
  const versionByDocRef = useRef<Record<string, number>>({});
  const scheduledFlushesByDocRef = useRef<Record<string, number>>({});
  const inFlightDocIdsRef = useRef<Set<string>>(new Set());
  const flushRef = useRef<FlushDocument>(async () => null);
  const [savingDocIds, setSavingDocIds] = useState<Set<string>>(new Set());
  const [statusByDocId, setStatusByDocId] = useState<Record<string, DocumentAutosaveStatus>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const clearScheduledFlush = useCallback((documentId: string) => {
    const timer = scheduledFlushesByDocRef.current[documentId];
    if (timer) {
      window.clearTimeout(timer);
      delete scheduledFlushesByDocRef.current[documentId];
    }
  }, []);

  const scheduleFlush = useCallback(
    (documentId: string) => {
      clearScheduledFlush(documentId);
      scheduledFlushesByDocRef.current[documentId] = window.setTimeout(() => {
        void flushRef.current(documentId);
      }, debounceMs);
    },
    [clearScheduledFlush, debounceMs]
  );

  const flush = useCallback(
    async (documentId?: string | null) => {
      if (readOnly) return null;
      const targetIds = documentId ? [documentId] : Array.from(dirtyDocIdsRef.current);
      let lastSaved: WorkspaceDocument | null = null;

      for (const targetId of targetIds) {
        if (inFlightDocIdsRef.current.has(targetId)) {
          scheduleFlush(targetId);
          continue;
        }

        const draft = draftsByDocRef.current[targetId];
        if (!draft || !dirtyDocIdsRef.current.has(targetId)) {
          continue;
        }

        clearScheduledFlush(targetId);
        const versionAtFlush = versionByDocRef.current[targetId] ?? 0;
        inFlightDocIdsRef.current.add(targetId);
        setSavingDocIds((current) => new Set(current).add(targetId));
        setStatusByDocId((current) => ({ ...current, [targetId]: "saving" }));

        try {
          const saved = await updateDocument({
            documentId: targetId,
            patch: buildDocumentAutosavePatch(draft)
          });

          const currentVersion = versionByDocRef.current[targetId] ?? 0;
          if (currentVersion === versionAtFlush) {
            dirtyDocIdsRef.current.delete(targetId);
            delete draftsByDocRef.current[targetId];
            onSaved(saved);
            setStatusByDocId((current) => ({ ...current, [targetId]: "saved" }));
            lastSaved = saved;
          } else {
            const currentDraft = draftsByDocRef.current[targetId];
            if (currentDraft) {
              draftsByDocRef.current[targetId] = {
                ...currentDraft,
                updatedAt: saved.updatedAt
              };
            }
            setStatusByDocId((current) => ({ ...current, [targetId]: "dirty" }));
            scheduleFlush(targetId);
          }
          setSaveError(null);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao salvar esta doc.";
          setSaveError(message);
          setStatusByDocId((current) => ({ ...current, [targetId]: isConflictError(error) ? "conflict" : "error" }));
        } finally {
          setSavingDocIds((current) => {
            const next = new Set(current);
            next.delete(targetId);
            return next;
          });
          inFlightDocIdsRef.current.delete(targetId);
        }
      }

      return lastSaved;
    },
    [clearScheduledFlush, onSaved, readOnly, scheduleFlush, updateDocument]
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queue = useCallback(
    (document: WorkspaceDocument) => {
      if (readOnly) return;
      draftsByDocRef.current[document.id] = document;
      dirtyDocIdsRef.current.add(document.id);
      versionByDocRef.current[document.id] = (versionByDocRef.current[document.id] ?? 0) + 1;
      setStatusByDocId((current) => ({ ...current, [document.id]: "dirty" }));
      scheduleFlush(document.id);
    },
    [readOnly, scheduleFlush]
  );

  const discard = useCallback(
    (documentId: string) => {
      clearScheduledFlush(documentId);
      inFlightDocIdsRef.current.delete(documentId);
      dirtyDocIdsRef.current.delete(documentId);
      delete draftsByDocRef.current[documentId];
      delete versionByDocRef.current[documentId];
      setStatusByDocId((current) => ({ ...current, [documentId]: "saved" }));
    },
    [clearScheduledFlush]
  );

  const isDirty = useCallback((documentId: string) => dirtyDocIdsRef.current.has(documentId), []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      for (const timer of Object.values(scheduledFlushesByDocRef.current)) {
        window.clearTimeout(timer);
      }
      scheduledFlushesByDocRef.current = {};
    };
  }, [flush]);

  return {
    queue,
    flush,
    discard,
    isDirty,
    saveError,
    statusByDocId,
    isSavingDocId: Array.from(savingDocIds)[0] ?? null
  };
}
