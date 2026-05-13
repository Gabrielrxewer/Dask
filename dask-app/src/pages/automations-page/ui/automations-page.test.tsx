import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AutomationCapabilities, AutomationWorkflow, AutomationWorkflowVersion } from "@/modules/workspace/model";
import { FlowNodeSidebarMenu } from "@/shared/ui";
import {
  WorkflowPreviewPanel,
  buildDefaultNodeConfig,
  buildWorkflowPreview
} from "@/pages/automations-page/ui/automations-page";
import { getAutomationWorkflowBadge } from "@/pages/automations-page/model/automation-workflow-metadata";
import { buildAutomationNodeMenuSections } from "@/pages/automations-page/ui/components/automation-flows-view";
import { AutomationPublishControls } from "@/pages/automations-page/ui/components/automation-publish-controls";
import { AutomationWorkflowInspector } from "@/pages/automations-page/ui/components/automation-workflow-inspector";
import { AutomationWorkflowList } from "@/pages/automations-page/ui/components/automation-workflow-list";

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

function workflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
  return {
    id: "workflow-user",
    workspaceId: "workspace-a",
    name: "Novo fluxo",
    description: null,
    status: "draft",
    currentVersionId: "version-1",
    createdById: "user-1",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

function version(overrides: Partial<AutomationWorkflowVersion> = {}): AutomationWorkflowVersion {
  return {
    id: "version-1",
    workflowId: "workflow-user",
    workspaceId: "workspace-a",
    version: 1,
    status: "draft",
    definitionJson: {},
    graphNodesJson: [],
    graphEdgesJson: [],
    publishedAt: null,
    publishedById: null,
    createdAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}

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

  it("uses the shared FlowCanvas node sidebar menu without exposing CRM recipes", () => {
    const html = renderToStaticMarkup(
      <FlowNodeSidebarMenu
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

    expect(html).not.toContain("Receitas CRM");
    expect(html).not.toContain("Proposta aprovada -&gt; contrato");
    expect(html).not.toContain("Cria contrato executavel");
    expect(html).toContain("Propostas");
    expect(html).toContain("Criar proposta");
    expect(html).toContain("Contratos");
    expect(html).toContain("Criar contrato");
    expect(html).not.toContain("create_document");
    expect(html).not.toContain("draggable");
  });

  it("builds the creation palette from nodes when recipes are absent or present", () => {
    const capabilitiesWithoutRecipes: AutomationCapabilities = {
      schemaVersion: 1,
      nodeCatalog: [
        {
          type: "trigger",
          label: "Gatilho",
          description: "Entrada do workflow",
          color: "#64748b",
          icon: "zap",
          group: "triggers",
          isTrigger: true
        },
        {
          type: "create_proposal",
          label: "Criar proposta",
          description: "Cria proposta comercial vinculada",
          color: "#2563eb",
          icon: "file",
          group: "proposals"
        }
      ],
      defaultGraph: {
        version: 1,
        nodes: [
          { id: "trigger", type: "trigger", label: "Execucao manual", config: { triggerType: "manual" } },
          { id: "end", type: "end", label: "Fim", config: {} }
        ],
        edges: [{ id: "trigger-end", source: "trigger", target: "end" }]
      }
    };
    const capabilitiesWithRecipes: AutomationCapabilities = {
      ...capabilitiesWithoutRecipes,
      recipeCatalog: [
        {
          id: "proposal-approved-create-contract",
          name: "Proposta aprovada -> contrato",
          description: "Receita comercial legada",
          category: "contract",
          graph: capabilitiesWithoutRecipes.defaultGraph
        }
      ]
    };

    const sectionsWithoutRecipes = buildAutomationNodeMenuSections(capabilitiesWithoutRecipes.nodeCatalog);
    const sectionsWithRecipes = buildAutomationNodeMenuSections(capabilitiesWithRecipes.nodeCatalog);
    const html = renderToStaticMarkup(<FlowNodeSidebarMenu sections={sectionsWithRecipes} />);

    expect(capabilitiesWithoutRecipes.recipeCatalog).toBeUndefined();
    expect(sectionsWithRecipes).toEqual(sectionsWithoutRecipes);
    expect(html).toContain("Gatilhos");
    expect(html).toContain("Criar proposta");
    expect(html).not.toContain("Proposta aprovada -&gt; contrato");
    expect(html).not.toContain("Receita comercial legada");
  });

  it("marks native workflows discreetly without introducing recipe language", () => {
    const nativeWorkflow = workflow({
      id: "workflow-native",
      name: "Follow-up comercial",
      metadata: {
        origin: "native",
        domain: "commercial",
        isProtected: true,
        isEditable: false,
        nativeKey: "commercial.followup"
      }
    });
    const userWorkflow = workflow({ id: "workflow-user", name: "Meu fluxo" });
    const html = renderToStaticMarkup(
      <AutomationWorkflowList
        workflows={[nativeWorkflow, userWorkflow]}
        selectedWorkflowId="workflow-native"
        busy={false}
        onCreateWorkflow={async () => undefined}
        onSelectWorkflow={() => undefined}
      />
    );

    expect(getAutomationWorkflowBadge(nativeWorkflow)).toMatchObject({ label: "Comercial" });
    expect(getAutomationWorkflowBadge(userWorkflow)).toBeNull();
    expect(html).toContain("Follow-up comercial");
    expect(html).toContain("Comercial");
    expect(html).toContain("Meu fluxo");
    expect(html).not.toContain("Receita");
  });

  it("shows installed native workflows from the workflow list with available status actions", () => {
    const nativeWorkflow = workflow({
      id: "workflow-native-installed",
      name: "Entrada automatica comercial",
      origin: "native",
      nativeDomain: "commercial",
      isProtected: true,
      editableMode: "config_only",
      nativeKey: "commercial.intake",
      status: "paused"
    });
    const publishedVersion = version({
      id: "version-published",
      status: "published"
    });
    const listHtml = renderToStaticMarkup(
      <AutomationWorkflowList
        workflows={[nativeWorkflow]}
        selectedWorkflowId="workflow-native-installed"
        busy={false}
        onCreateWorkflow={async () => undefined}
        onSelectWorkflow={() => undefined}
      />
    );
    const controlsHtml = renderToStaticMarkup(
      <AutomationPublishControls
        workflow={nativeWorkflow}
        selectedVersion={publishedVersion}
        currentVersion={publishedVersion}
        busy={false}
        onStatusChange={async () => undefined}
        onCloneVersion={async () => undefined}
        onRun={async () => undefined}
        onSaveWorkflow={async () => true}
        onPublish={async () => undefined}
      />
    );

    expect(getAutomationWorkflowBadge(nativeWorkflow)).toMatchObject({ label: "Comercial" });
    expect(listHtml).toContain("Entrada automatica comercial");
    expect(listHtml).toContain("Comercial");
    expect(listHtml).toContain("paused");
    expect(listHtml).not.toContain("Receita");
    expect(controlsHtml).toContain("aria-label=\"Pausar\"");
    expect(controlsHtml).toContain("aria-label=\"Ativar\"");
    expect(controlsHtml).toContain("aria-label=\"Arquivar\"");
    expect(controlsHtml).toContain("aria-label=\"Salvar draft\"");
    expect(controlsHtml).toContain("aria-label=\"Publicar\"");
  });

  it("respects native workflow edit and protection metadata when rendering actions", () => {
    const nativeWorkflow = workflow({
      origin: "native",
      domain: "commercial",
      isProtected: true,
      isEditable: false,
      nativeKey: "commercial.followup"
    });
    const draftVersion = version();
    const inspectorHtml = renderToStaticMarkup(
      <AutomationWorkflowInspector
        workflow={nativeWorkflow}
        workflowName="Follow-up comercial"
        workflowDescription="Fluxo instalado pelo sistema"
        workflowPreview={{ steps: [], warnings: [], errors: [] }}
        setWorkflowName={() => undefined}
        setWorkflowDescription={() => undefined}
      />
    );
    const controlsHtml = renderToStaticMarkup(
      <AutomationPublishControls
        workflow={nativeWorkflow}
        selectedVersion={draftVersion}
        currentVersion={draftVersion}
        busy={false}
        onStatusChange={async () => undefined}
        onCloneVersion={async () => undefined}
        onRun={async () => undefined}
        onSaveWorkflow={async () => true}
        onPublish={async () => undefined}
      />
    );

    expect(inspectorHtml).toContain("Comercial");
    expect(inspectorHtml).toContain("Protegida");
    expect(inspectorHtml).toContain("commercial.followup");
    expect(inspectorHtml).toContain("disabled");
    expect(controlsHtml).toContain("aria-label=\"Arquivar\"");
    expect(controlsHtml).toContain("aria-label=\"Clonar versao\"");
    expect(controlsHtml).toContain("aria-label=\"Salvar draft\"");
    expect(controlsHtml).toContain("aria-label=\"Publicar\"");
    expect(controlsHtml.match(/disabled=\"\"/g)?.length).toBeGreaterThanOrEqual(4);
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
