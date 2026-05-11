import { describe, expect, it } from "vitest";
import { commercialDocumentSendSchema } from "@/modules/documentation/model/commercial-document.schema";

describe("commercialDocumentSendSchema", () => {
  it("normalizes defaults for authenticated commercial sending", () => {
    const result = commercialDocumentSendSchema.parse({
      recipients: ["cliente@example.com"]
    });

    expect(result).toMatchObject({
      recipients: ["cliente@example.com"],
      includeAttachments: true,
      selectedAssetIds: [],
      requireLogin: true,
      allowAcceptReject: true
    });
  });

  it("rejects empty or invalid recipients", () => {
    expect(() => commercialDocumentSendSchema.parse({ recipients: [] })).toThrow();
    expect(() => commercialDocumentSendSchema.parse({ recipients: ["sem-email"] })).toThrow();
  });

  it("keeps send policy fields explicit when provided", () => {
    const result = commercialDocumentSendSchema.parse({
      recipients: ["cliente@example.com", "financeiro@example.com"],
      subject: "Proposta",
      message: "Segue documento.",
      includeAttachments: false,
      selectedAssetIds: ["asset-1"],
      expirationDate: "2026-06-01T00:00:00.000Z",
      requireLogin: true,
      allowAcceptReject: false,
      linkedWorkItemId: "item-1",
      resolvedPreviewSnapshot: "# Proposta resolvida"
    });

    expect(result).toMatchObject({
      includeAttachments: false,
      selectedAssetIds: ["asset-1"],
      allowAcceptReject: false,
      linkedWorkItemId: "item-1",
      resolvedPreviewSnapshot: "# Proposta resolvida"
    });
  });
});
