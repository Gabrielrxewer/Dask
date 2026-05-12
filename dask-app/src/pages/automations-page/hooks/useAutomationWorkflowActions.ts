import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Edge } from "@xyflow/react";
import type {
  AutomationCapabilities,
  AutomationWorkflow,
  AutomationWorkflowStatus,
  AutomationWorkflowVersion
} from "@/modules/workspace/model";
import {
  useCloneAutomationVersionMutation,
  useCreateAutomationDraftVersionMutation,
  useCreateAutomationWorkflowMutation,
  usePublishAutomationVersionMutation,
  useRunAutomationWorkflowMutation,
  useSaveAutomationDraftMutation,
  useSetAutomationWorkflowStatusMutation,
  useUpdateAutomationWorkflowMutation
} from "@/modules/automation/query";
import { toast } from "@/shared/ui";
import { canvasToGraph } from "@/pages/automations-page/model/automation-graph-adapter";
import type {
  AutomationCanvasNode,
  AutomationRecipe,
  StudioTab
} from "@/pages/automations-page/model/automation-page.types";

export function useAutomationWorkflowActions(input: {
  workspaceSlug: string;
  capabilities: AutomationCapabilities | null;
  workflowsCount: number;
  selectedWorkflow: AutomationWorkflow | null;
  selectedVersion: AutomationWorkflowVersion | null;
  workflowName: string;
  workflowDescription: string;
  canvasNodes: AutomationCanvasNode[];
  canvasEdges: Edge[];
  firstValidationError: string | null;
  setSelectedWorkflowId: Dispatch<SetStateAction<string | null>>;
  setSelectedVersionId: Dispatch<SetStateAction<string | null>>;
  setActiveTab: Dispatch<SetStateAction<StudioTab>>;
  setFeedback: (feedback: string | null) => void;
}) {
  const {
    workspaceSlug,
    capabilities,
    workflowsCount,
    selectedWorkflow,
    selectedVersion,
    workflowName,
    workflowDescription,
    canvasNodes,
    canvasEdges,
    firstValidationError,
    setSelectedWorkflowId,
    setSelectedVersionId,
    setActiveTab,
    setFeedback
  } = input;

  const createWorkflowMutation = useCreateAutomationWorkflowMutation(workspaceSlug);
  const createDraftMutation = useCreateAutomationDraftVersionMutation(workspaceSlug);
  const updateWorkflowMutation = useUpdateAutomationWorkflowMutation(workspaceSlug);
  const saveDraftMutation = useSaveAutomationDraftMutation(workspaceSlug);
  const publishVersionMutation = usePublishAutomationVersionMutation(workspaceSlug);
  const cloneVersionMutation = useCloneAutomationVersionMutation(workspaceSlug);
  const statusMutation = useSetAutomationWorkflowStatusMutation(workspaceSlug);
  const runMutation = useRunAutomationWorkflowMutation(workspaceSlug);

  const busy = createWorkflowMutation.isPending
    || createDraftMutation.isPending
    || updateWorkflowMutation.isPending
    || saveDraftMutation.isPending
    || publishVersionMutation.isPending
    || cloneVersionMutation.isPending
    || statusMutation.isPending
    || runMutation.isPending;

  const handleCreateWorkflow = useCallback(async () => {
    if (!capabilities) return;
    setFeedback(null);
    const workflow = await createWorkflowMutation.mutateAsync({
      name: `Novo fluxo ${workflowsCount + 1}`,
      status: "draft"
    });
    await createDraftMutation.mutateAsync({
      workflowId: workflow.id,
      versionInput: {
        graph: capabilities.defaultGraph,
        definition: { graph: capabilities.defaultGraph }
      }
    });
    setSelectedWorkflowId(workflow.id);
    setFeedback("Fluxo criado.");
  }, [
    capabilities,
    createDraftMutation,
    createWorkflowMutation,
    setFeedback,
    setSelectedWorkflowId,
    workflowsCount
  ]);

  const handleCreateRecipeWorkflow = useCallback(async (recipe: AutomationRecipe) => {
    setFeedback(null);
    const workflow = await createWorkflowMutation.mutateAsync({
      name: recipe.name,
      description: recipe.description,
      status: "draft"
    });
    await createDraftMutation.mutateAsync({
      workflowId: workflow.id,
      versionInput: {
        graph: recipe.graph,
        definition: { graph: recipe.graph, recipeId: recipe.id }
      }
    });
    setSelectedWorkflowId(workflow.id);
    setFeedback("Receita criada como workflow editavel.");
  }, [createDraftMutation, createWorkflowMutation, setFeedback, setSelectedWorkflowId]);

  const handleSaveWorkflow = useCallback(async (): Promise<boolean> => {
    if (!selectedWorkflow || !selectedVersion || selectedVersion.status !== "draft") return false;
    if (firstValidationError) {
      setFeedback(`Corrija antes de salvar: ${firstValidationError}`);
      toast.warning("Payload invalido", { description: firstValidationError });
      return false;
    }

    setFeedback(null);
    const graph = canvasToGraph(canvasNodes, canvasEdges);
    await Promise.all([
      updateWorkflowMutation.mutateAsync({
        workflowId: selectedWorkflow.id,
        patch: {
          name: workflowName,
          description: workflowDescription || null
        }
      }),
      saveDraftMutation.mutateAsync({
        workflowId: selectedWorkflow.id,
        versionId: selectedVersion.id,
        patch: {
          graph,
          definition: { graph }
        }
      })
    ]);
    setFeedback("Draft salvo.");
    return true;
  }, [
    canvasEdges,
    canvasNodes,
    firstValidationError,
    saveDraftMutation,
    selectedVersion,
    selectedWorkflow,
    setFeedback,
    updateWorkflowMutation,
    workflowDescription,
    workflowName
  ]);

  const handlePublish = useCallback(async () => {
    if (!selectedWorkflow || !selectedVersion || selectedVersion.status !== "draft") return;
    if (firstValidationError) {
      setFeedback(`Corrija antes de publicar: ${firstValidationError}`);
      toast.warning("Payload invalido", { description: firstValidationError });
      return;
    }
    const saved = await handleSaveWorkflow();
    if (!saved) return;
    await publishVersionMutation.mutateAsync({
      workflowId: selectedWorkflow.id,
      versionId: selectedVersion.id,
      activateWorkflow: true
    });
    setFeedback("Versao publicada.");
  }, [
    firstValidationError,
    handleSaveWorkflow,
    publishVersionMutation,
    selectedVersion,
    selectedWorkflow,
    setFeedback
  ]);

  const handleCloneVersion = useCallback(async () => {
    if (!selectedWorkflow || !selectedVersion) return;
    const draft = await cloneVersionMutation.mutateAsync({
      workflowId: selectedWorkflow.id,
      versionId: selectedVersion.id
    });
    setSelectedVersionId(draft.id);
    setFeedback("Draft criado a partir da versao selecionada.");
  }, [cloneVersionMutation, selectedVersion, selectedWorkflow, setFeedback, setSelectedVersionId]);

  const handleStatusChange = useCallback(async (status: Extract<AutomationWorkflowStatus, "active" | "paused" | "archived">) => {
    if (!selectedWorkflow) return;
    await statusMutation.mutateAsync({ workflowId: selectedWorkflow.id, status });
    setFeedback("Status atualizado.");
  }, [selectedWorkflow, setFeedback, statusMutation]);

  const handleRun = useCallback(async () => {
    if (!selectedWorkflow) return;
    const result = await runMutation.mutateAsync({
      workflowId: selectedWorkflow.id,
      context: { source: "automation_studio_test" }
    });
    setFeedback(`Run criada: ${result.runId}`);
    setActiveTab("runs");
  }, [runMutation, selectedWorkflow, setActiveTab, setFeedback]);

  return {
    busy,
    handleCreateWorkflow,
    handleCreateRecipeWorkflow,
    handleSaveWorkflow,
    handlePublish,
    handleCloneVersion,
    handleStatusChange,
    handleRun
  };
}
