import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowNodeSidebarMenu } from "@/shared/ui";
import {
  WorkflowPreviewPanel,
  buildDefaultNodeConfig,
  buildWorkflowPreview
} from "@/pages/automations-page/ui/automations-page";

const commercialNodeTypes = [
  "move_work_item",
  "update_work_item_fields",
  "create_proposal",
  "create_contract",
  "send_document",
  "update_document_status",
  "ensure_customer_from_work_item",
  "create_billing_order",
  "create_followup_task",
  "register_card_activity"
];

describe("Automation Studio commercial automation UI", () => {
  it("creates visual defaults for every official CRM business node", () => {
    for (const nodeType of commercialNodeTypes) {
      expect(buildDefaultNodeConfig(nodeType)).not.toEqual({});
    }

    expect(buildDefaultNodeConfig("create_proposal")).toMatchObject({
      itemIdPath: "event.payload.itemId",
      templateKey: "commercial_proposal",
      targetFieldSlug: "proposalId"
    });
    expect(buildDefaultNodeConfig("create_contract")).toMatchObject({
      proposalFieldSlug: "proposalId",
      templateKey: "commercial_contract",
      targetFieldSlug: "contractId"
    });
    expect(buildDefaultNodeConfig("create_document")).toEqual({});
  });

  it("uses the shared FlowCanvas node sidebar menu and keeps CRM recipes compact", () => {
    const html = renderToStaticMarkup(
      <FlowNodeSidebarMenu
        actionSections={[
          {
            id: "crm-recipes",
            title: "Receitas CRM",
            actions: [{ id: "proposal-approved-create-contract", label: "Proposta aprovada -> contrato" }]
          }
        ]}
        sections={[
          {
            id: "proposals",
            title: "Propostas",
            items: [{ id: "create_proposal", label: "Criar proposta", description: "Cria proposta real", color: "#2563eb" }]
          },
          {
            id: "contracts",
            title: "Contratos",
            items: [{ id: "create_contract", label: "Criar contrato", description: "Cria contrato real", color: "#16a34a" }]
          }
        ]}
      />
    );

    expect(html).toContain("Receitas CRM");
    expect(html).toContain("Proposta aprovada -&gt; contrato");
    expect(html).not.toContain("Cria contrato executavel");
    expect(html).toContain("Propostas");
    expect(html).toContain("Criar proposta");
    expect(html).toContain("Contratos");
    expect(html).toContain("Criar contrato");
    expect(html).not.toContain("create_document");
    expect(html).not.toContain("draggable");
  });

  it("blocks publish preview when required visual config is missing", () => {
    const nodeMeta = new Map([
      [
        "trigger",
        {
          type: "trigger",
          label: "Gatilho",
          description: "Evento",
          color: "#64748b",
          icon: "zap",
          group: "triggers",
          configSchema: { type: "trigger", label: "Gatilho", required: ["triggerType"], description: "Evento" }
        }
      ],
      [
        "create_proposal",
        {
          type: "create_proposal",
          label: "Criar proposta",
          description: "Proposta",
          color: "#2563eb",
          icon: "file",
          group: "proposals",
          configSchema: {
            type: "create_proposal",
            label: "Criar proposta",
            required: ["itemIdPath", "targetFieldSlug", "templateKey"],
            description: "Cria proposta"
          }
        }
      ]
    ]) as Parameters<typeof buildWorkflowPreview>[2];
    const nodes = [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          nodeType: "trigger",
          label: "WorkItem comercial criado",
          summary: "",
          config: { triggerType: "commercial_work_item_created" }
        }
      },
      {
        id: "proposal",
        type: "create_proposal",
        position: { x: 240, y: 0 },
        data: {
          nodeType: "create_proposal",
          label: "Criar proposta",
          summary: "",
          config: { itemIdPath: "event.payload.itemId", targetFieldSlug: "proposalId" }
        }
      }
    ] as Parameters<typeof buildWorkflowPreview>[0];

    const preview = buildWorkflowPreview(nodes, [{ id: "edge", source: "trigger", target: "proposal" }], nodeMeta);
    const html = renderToStaticMarkup(<WorkflowPreviewPanel preview={preview} />);

    expect(preview.errors).toContain("Criar proposta: preencha templateKey.");
    expect(html).toContain("Bloqueado");
    expect(html).toContain("Criar proposta: preencha templateKey.");
  });
});
