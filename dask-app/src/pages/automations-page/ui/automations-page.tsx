import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useCurrentWorkspace } from "@/modules/workspace";
import { AppShell } from "@/widgets/app-shell";
import {
  useAutomationCanvasEditor,
  useAutomationCapabilitiesQuery,
  useAutomationOperations,
  useAutomationVersionSelection,
  useAutomationWorkflowActions,
  useAutomationWorkflowEditor,
  useAutomationWorkflowSelection,
  useAutomationWorkflows
} from "@/pages/automations-page/hooks";
import {
  studioTabs
} from "@/pages/automations-page/model/automation-page-view-model";
import type { StudioTab } from "@/pages/automations-page/model/automation-page.types";
import { EmptyState, LoadingState, WorkspaceFrame, WorkspaceTopNavigation } from "@/shared/ui";
import { AutomationApprovalsPanel } from "./components/automation-approvals-panel";
import { AutomationContactsPanel } from "./components/automation-contacts-panel";
import { AutomationFlowsView } from "./components/automation-flows-view";
import { AutomationInboxPanel } from "./components/automation-inbox-panel";
import { AutomationPublishControls } from "./components/automation-publish-controls";
import { AutomationRunsPanel } from "./components/automation-runs-panel";
import { AutomationSettingsPanel } from "./components/automation-settings-panel";
import { AutomationTemplatesPanel } from "./components/automation-templates-panel";
import "./automations-page.css";

export { buildDefaultNodeConfig } from "@/pages/automations-page/model/automation-node-registry";
export { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";
export { WorkflowPreviewPanel } from "./components/workflow-preview-panel";

export function AutomationsPage() {
  const { workspaceSlug, snapshot, isSnapshotLoading } = useCurrentWorkspace();
  const [activeTab, setActiveTab] = useState<StudioTab>("flows");
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const setFeedback = useCallback((_feedback: string | null) => undefined, []);

  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot]);
  const capabilitiesQuery = useAutomationCapabilitiesQuery(workspaceSlug);
  const workflowsQuery = useAutomationWorkflows(workspaceSlug);
  const workflows = workflowsQuery.data?.items ?? [];
  const capabilities = capabilitiesQuery.data ?? null;
  const workflowSelection = useAutomationWorkflowSelection({ workflows });
  const versionsQuery = useAutomationWorkflowEditor(workspaceSlug, workflowSelection.selectedWorkflowId);
  const versions = versionsQuery.data?.items ?? [];
  const versionSelection = useAutomationVersionSelection({
    versions,
    selectedWorkflow: workflowSelection.selectedWorkflow
  });

  const boardColumns = useMemo(() => snapshot?.boardColumns ?? [], [snapshot?.boardColumns]);
  const workflowStates = useMemo(() => snapshot?.workflowStates ?? [], [snapshot?.workflowStates]);
  const customFields = useMemo(() => snapshot?.customFieldDefinitions ?? [], [snapshot?.customFieldDefinitions]);
  const itemTypes = useMemo(() => snapshot?.itemTypes ?? [], [snapshot?.itemTypes]);

  useEffect(() => {
    if (!workflowSelection.selectedWorkflow) {
      setWorkflowName("");
      setWorkflowDescription("");
      return;
    }
    setWorkflowName(workflowSelection.selectedWorkflow.name);
    setWorkflowDescription(workflowSelection.selectedWorkflow.description ?? "");
  }, [workflowSelection.selectedWorkflow]);

  const canvasEditor = useAutomationCanvasEditor({
    capabilities,
    selectedVersion: versionSelection.selectedVersion,
    boardColumns,
    workflowStates,
    customFields,
    itemTypes,
    setFeedback
  });

  const workflowActions = useAutomationWorkflowActions({
    workspaceSlug,
    capabilities,
    workflowsCount: workflows.length,
    selectedWorkflow: workflowSelection.selectedWorkflow,
    selectedVersion: versionSelection.selectedVersion,
    workflowName,
    workflowDescription,
    canvasNodes: canvasEditor.canvasNodes,
    canvasEdges: canvasEditor.canvasEdges,
    firstValidationError: canvasEditor.firstValidationError,
    setSelectedWorkflowId: workflowSelection.setSelectedWorkflowId,
    setSelectedVersionId: versionSelection.setSelectedVersionId,
    setActiveTab,
    setFeedback
  });

  const operations = useAutomationOperations({
    workspaceSlug,
    activeTab,
    selectedWorkflowId: workflowSelection.selectedWorkflowId
  });

  if (isSnapshotLoading || capabilitiesQuery.isLoading || !capabilities) {
    if (capabilitiesQuery.error) {
      const message = capabilitiesQuery.error instanceof Error
        ? capabilitiesQuery.error.message
        : "Nao foi possivel carregar Automation Studio.";

      return (
        <AppShell
          metrics={metrics}
          pageLabel="Automation Studio"
          pageTitle="Workflow versionado"
          noPageScroll
          hidePageHeader
          hideSidebarBrandMark
        >
          <WorkspaceFrame className="automation-studio" variant="editor" scroll="none">
            <EmptyState className="automation-studio__empty-panel" size="compact">{message}</EmptyState>
          </WorkspaceFrame>
        </AppShell>
      );
    }

    return <LoadingState text="Carregando Automation Studio" animation="automation" />;
  }

  const topNavigation = (
    <WorkspaceTopNavigation<StudioTab>
      value={activeTab}
      items={studioTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
      onChange={setActiveTab}
      ariaLabel="Automacoes"
      className="automations-top-nav"
      actions={activeTab === "flows" && workflowSelection.selectedWorkflow ? (
        <AutomationPublishControls
          workflow={workflowSelection.selectedWorkflow}
          selectedVersion={versionSelection.selectedVersion}
          currentVersion={versionSelection.currentVersion}
          busy={workflowActions.busy}
          onStatusChange={workflowActions.handleStatusChange}
          onCloneVersion={workflowActions.handleCloneVersion}
          onRun={workflowActions.handleRun}
          onSaveWorkflow={workflowActions.handleSaveWorkflow}
          onPublish={workflowActions.handlePublish}
        />
      ) : undefined}
    />
  );

  return (
    <AppShell
      metrics={metrics}
      pageLabel="Automation Studio"
      pageTitle="Workflow versionado"
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="automation-studio" variant="editor" scroll="none">
        {activeTab === "flows" ? (
          <AutomationFlowsView
            capabilities={capabilities}
            workflows={workflows}
            workflowsLoading={workflowsQuery.isLoading}
            workflowsError={workflowsQuery.error}
            selectedWorkflow={workflowSelection.selectedWorkflow}
            selectedWorkflowId={workflowSelection.selectedWorkflowId}
            selectedNode={canvasEditor.selectedNode}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            workflowPreview={canvasEditor.workflowPreview}
            validationIssues={canvasEditor.validationIssues}
            validationIssueCount={canvasEditor.validationIssueCount}
            canvasNodes={canvasEditor.canvasNodes}
            canvasEdges={canvasEditor.canvasEdges}
            automationNodeTypes={canvasEditor.automationNodeTypes}
            nodeMeta={canvasEditor.nodeMeta}
            boardColumns={boardColumns}
            workflowStates={workflowStates}
            customFields={customFields}
            itemTypes={itemTypes}
            busy={workflowActions.busy}
            fitViewKey={canvasEditor.fitViewKey}
            setWorkflowName={setWorkflowName}
            setWorkflowDescription={setWorkflowDescription}
            onCreateWorkflow={workflowActions.handleCreateWorkflow}
            onCreateRecipeWorkflow={workflowActions.handleCreateRecipeWorkflow}
            onSelectWorkflow={workflowSelection.setSelectedWorkflowId}
            onAutoLayout={canvasEditor.handleAutoLayout}
            onNodesChange={canvasEditor.onNodesChange}
            onEdgesChange={canvasEditor.onEdgesChange}
            onEdgesAdd={canvasEditor.setCanvasEdges}
            onNodesAdd={canvasEditor.handleNodesAdd}
            onNodeSelect={canvasEditor.setSelectedNodeId}
            onAddNodeFromPalette={canvasEditor.handleAddNodeFromPalette}
            onNodeConfigChange={canvasEditor.handleSelectedNodeConfigChange}
            onNodeLabelChange={canvasEditor.handleSelectedNodeLabelChange}
            validateConnection={canvasEditor.validateConnection}
            onInvalidConnection={canvasEditor.handleInvalidConnection}
          />
        ) : null}

        {activeTab === "runs" ? (
          <AutomationRunsPanel
            runs={operations.runs}
            selectedRun={operations.selectedRun}
            selectedRunLoading={operations.selectedRunLoading}
            loading={operations.runsLoading}
            error={operations.runsError}
            onRefresh={operations.refreshRuns}
            onLoadRunDetail={operations.setSelectedRunId}
            onCancelRun={operations.handleCancelRun}
          />
        ) : null}

        {activeTab === "approvals" ? (
          <AutomationApprovalsPanel
            approvals={operations.approvals}
            loading={operations.approvalsLoading}
            error={operations.approvalsError}
            onRefresh={operations.refreshApprovals}
          />
        ) : null}

        {activeTab === "inbox" ? (
          <AutomationInboxPanel
            conversations={operations.conversations}
            selectedConversation={operations.selectedConversation}
            selectedConversationLoading={operations.selectedConversationLoading}
            replyText={operations.replyText}
            loading={operations.inboxLoading}
            error={operations.inboxError}
            onRefresh={operations.refreshInbox}
            onOpenConversation={operations.setSelectedConversationId}
            onReplyTextChange={operations.setReplyText}
            onReply={operations.handleReply}
          />
        ) : null}

        {activeTab === "templates" ? (
          <AutomationTemplatesPanel
            templates={operations.templates}
            loading={operations.templatesLoading}
            error={operations.templatesError}
            onRefresh={operations.refreshTemplates}
          />
        ) : null}

        {activeTab === "contacts" ? (
          <AutomationContactsPanel
            conversations={operations.conversations}
            loading={operations.inboxLoading}
            error={operations.inboxError}
            onRefresh={operations.refreshInbox}
          />
        ) : null}

        {activeTab === "settings" ? (
          <AutomationSettingsPanel
            consents={operations.consents}
            loading={operations.consentsLoading}
            error={operations.consentsError}
            onRefresh={operations.refreshConsents}
            onOptOutFirstConsent={operations.handleOptOutFirstConsent}
          />
        ) : null}
      </WorkspaceFrame>
    </AppShell>
  );
}
