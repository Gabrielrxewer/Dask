import { describe, expect, it } from "vitest";
import type { WorkspaceDocument } from "@/modules/workspace";
import { buildDocumentAutosavePatch } from "./use-document-autosave";

describe("document autosave", () => {
  it("builds a versioned autosave patch from the current draft", () => {
    const draft = {
      id: "doc-1",
      title: "Proposta ACME",
      content: "# Escopo",
      kind: "proposal",
      tags: ["comercial"],
      metadata: { status: "draft" },
      updatedAt: "2026-05-10T10:00:00.000Z"
    } as WorkspaceDocument;

    expect(buildDocumentAutosavePatch(draft)).toEqual({
      title: "Proposta ACME",
      content: "# Escopo",
      kind: "proposal",
      tags: ["comercial"],
      metadata: { status: "draft" },
      expectedUpdatedAt: "2026-05-10T10:00:00.000Z"
    });
  });
});
