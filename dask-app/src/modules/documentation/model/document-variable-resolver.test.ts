import { describe, expect, it } from "vitest";
import { resolveDocumentMarkdown } from "@/modules/documentation/model/document-variable-resolver";

const document = {
  id: "document-1",
  workspaceId: "workspace-1",
  title: "Proposta",
  content: "",
  kind: "proposal",
  tags: [],
  metadata: {},
  position: 0,
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z"
} as never;

const workspace = {
  id: "workspace-1",
  key: "dask",
  name: "Dask",
  membersById: {
    "user-1": {
      id: "user-1",
      name: "Ana"
    }
  }
} as never;

const workItem = {
  id: "item-1",
  title: "Implantacao Enterprise",
  status: "em_andamento",
  assignee: "user-1",
  createdAt: "2026-05-01T00:00:00.000Z",
  customFields: {
    estimatedValue: 12000,
    customerName: "<script>alert(1)</script>ACME"
  }
} as never;

describe("resolveDocumentMarkdown", () => {
  it("resolves only registered WorkItem and workspace variables", () => {
    const result = resolveDocumentMarkdown(
      [
        "Card: {{workItem.title}}",
        "Status: {{workItem.status}}",
        "Responsavel: {{workItem.assignee.name}}",
        "Cliente: {{customer.name}}",
        "Valor: {{fields.estimatedValue}}",
        "Workspace: {{workspace.name}}"
      ].join("\n"),
      { document, workspace, workItem }
    );

    expect(result.markdown).toContain("Card: Implantacao Enterprise");
    expect(result.markdown).toContain("Status: em_andamento");
    expect(result.markdown).toContain("Responsavel: Ana");
    expect(result.markdown).toContain("Cliente: ACME");
    expect(result.markdown).toContain("Valor: 12000");
    expect(result.markdown).toContain("Workspace: Dask");
    expect(result.markdown).not.toContain("<script>");
    expect(result.diagnostics).toEqual([]);
  });

  it("keeps arbitrary or unknown variables unresolved and reports diagnostics", () => {
    const result = resolveDocumentMarkdown(
      "Token: {{workItem.secretToken}}\nExec: {{constructor.prototype}}\nOk: {{workItem.title}}",
      { document, workspace, workItem }
    );

    expect(result.markdown).toContain("{{workItem.secretToken}}");
    expect(result.markdown).toContain("{{constructor.prototype}}");
    expect(result.markdown).toContain("Ok: Implantacao Enterprise");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "workItem.secretToken", severity: "error" }),
        expect.objectContaining({ key: "constructor.prototype", severity: "error" })
      ])
    );
  });

  it("warns when WorkItem variables are used without a linked WorkItem", () => {
    const result = resolveDocumentMarkdown("Card: {{workItem.title}}", {
      document,
      workspace,
      workItem: null
    });

    expect(result.markdown).toContain("Card: ");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "workItem", severity: "warning" })
      ])
    );
  });
});
