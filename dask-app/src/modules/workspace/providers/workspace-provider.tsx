import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { beginGlobalLoading } from "@/shared/lib/loading/global-loading";
import { workspaceService } from "@/modules/workspace/api";
import type {
  AiAgentSummary,
  AiObservability,
  AiRunSummary,
  ApiBoardColumn,
  ApiCustomField,
  ApiItemType,
  ApiWorkflowState,
  AutomationView,
  AutomationExecution,
  AutomationRule,
  CreateAiAgentInput,
  RunDocumentationAssistantInput,
  RunDocumentationAssistantResult,
  CreateAutomationRuleInput,
  CreateBoardColumnInput,
  CreateCustomFieldInput,
  CreateItemTypeInput,
  CreateTaskInput,
  TaskScheduleInput,
  UpdateTaskInput,
  UpdateBoardColumnInput,
  UpdateCustomFieldInput,
  UpdateItemTypeInput,
  WorkspaceAutomation,
  WorkspaceDocument,
  WorkItemLinkedDocument,
  WorkspacePreferences,
  WorkspaceSnapshot,
  WorkspaceTemplateKey
} from "@/modules/workspace/model";

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot | null;
  isLoading: boolean;
  createTask: (input: CreateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, nextStatus: TaskStatusId) => Promise<void>;
  moveTaskToColumn: (taskId: string, columnId: string, stateId?: string, position?: number) => Promise<void>;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => Promise<void>;
  updateTaskTitle: (taskId: string, title: string) => Promise<void>;
  updateTaskDescription: (taskId: string, description: string) => Promise<void>;
  updateTaskCustomField: (taskId: string, fieldId: string, value: TaskCustomFieldValue) => Promise<void>;
  updateTaskSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  setAutomationStatus: (automationId: string, status: WorkspaceAutomation["status"]) => Promise<void>;
  updatePreferences: (patch: Partial<WorkspacePreferences>) => Promise<void>;
  resetWorkspaceTemplate: (templateKey?: WorkspaceTemplateKey) => Promise<void>;
  setCardFieldVisibility: (fieldId: string, visible: boolean) => Promise<void>;
  setTypeFieldVisibility: (typeId: string, fieldId: string, visible: boolean) => Promise<void>;
  setTypeDetailFieldVisibility: (typeId: string, fieldId: string, visible: boolean) => Promise<void>;

  fetchBoardColumns: () => Promise<ApiBoardColumn[]>;
  fetchWorkflowStates: () => Promise<ApiWorkflowState[]>;
  fetchItemTypes: () => Promise<ApiItemType[]>;
  fetchCustomFields: () => Promise<ApiCustomField[]>;

  createBoardColumn: (input: CreateBoardColumnInput) => Promise<void>;
  updateBoardColumn: (columnId: string, input: UpdateBoardColumnInput) => Promise<void>;
  deleteBoardColumn: (columnId: string) => Promise<void>;

  createItemType: (input: CreateItemTypeInput) => Promise<void>;
  updateItemType: (typeId: string, input: UpdateItemTypeInput) => Promise<void>;
  deleteItemType: (typeId: string) => Promise<void>;

  createCustomField: (input: CreateCustomFieldInput) => Promise<void>;
  updateCustomField: (fieldId: string, input: UpdateCustomFieldInput) => Promise<void>;
  deleteCustomField: (fieldId: string) => Promise<void>;
  listAutomationRules: (options?: { includeDisabled?: boolean }) => Promise<AutomationRule[]>;
  listAutomationExecutions: (options?: { limit?: number }) => Promise<AutomationExecution[]>;
  listAutomationViews: () => Promise<AutomationView[]>;
  runAutomationRule: (ruleId: string, context?: Record<string, unknown>) => Promise<void>;
  createAutomationRule: (input: CreateAutomationRuleInput) => Promise<AutomationRule>;
  updateAutomationRule: (
    ruleId: string,
    input: Partial<CreateAutomationRuleInput> & { enabled?: boolean }
  ) => Promise<AutomationRule>;
  deleteAutomationRule: (ruleId: string) => Promise<void>;
  listAiAgents: () => Promise<AiAgentSummary[]>;
  listAiRuns: (input?: { itemId?: string; limit?: number }) => Promise<AiRunSummary[]>;
  getAiObservability: () => Promise<AiObservability>;
  createAiAgent: (input: CreateAiAgentInput) => Promise<{ id: string }>;
  updateAiAgent: (
    agentId: string,
    patch: Partial<CreateAiAgentInput> & { description?: string | null }
  ) => Promise<{ id: string }>;
  runAiAgentOnItem: (
    itemId: string,
    agentId: string,
    input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  runAiRiskAnalysis: (
    itemId: string,
    input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  runDocumentationAssistant: (
    input: RunDocumentationAssistantInput
  ) => Promise<RunDocumentationAssistantResult>;
  listWorkspaceDocuments: () => Promise<WorkspaceDocument[]>;
  createWorkspaceDocument: (input: { title: string; content?: string; position?: number }) => Promise<WorkspaceDocument>;
  updateWorkspaceDocument: (
    documentId: string,
    input: { title?: string; content?: string; position?: number }
  ) => Promise<WorkspaceDocument>;
  deleteWorkspaceDocument: (documentId: string) => Promise<void>;
  listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug) {
      setIsLoading(false);
      setSnapshot(null);
      return;
    }

    let mounted = true;
    const stopGlobalLoading = beginGlobalLoading({
      source: "workspace",
      label: "Montando o contexto do workspace"
    });

    setIsLoading(true);
    workspaceService
      .getSnapshot(workspaceSlug)
      .then(nextSnapshot => {
        if (mounted) {
          setSnapshot(nextSnapshot);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoading(false);
        }
      })
      .finally(() => {
        stopGlobalLoading();
      });

    return () => {
      mounted = false;
      stopGlobalLoading();
    };
  }, [workspaceSlug]);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.createTask(workspaceSlug, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.deleteTask(workspaceSlug, taskId);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const moveTask = useCallback(async (taskId: string, nextStatus: TaskStatusId) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.moveTask(workspaceSlug, taskId, nextStatus);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const moveTaskToColumn = useCallback(async (taskId: string, columnId: string, stateId?: string, position?: number) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.moveTaskToColumn(workspaceSlug, taskId, columnId, stateId, position);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateTaskPriority = useCallback(async (taskId: string, priority: TaskPriority) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.updateTaskPriority(workspaceSlug, taskId, priority);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateTaskTitle = useCallback(async (taskId: string, title: string) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.updateTaskTitle(workspaceSlug, taskId, title);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateTaskDescription = useCallback(async (taskId: string, description: string) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.updateTaskDescription(workspaceSlug, taskId, description);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateTaskCustomField = useCallback(
    async (taskId: string, fieldId: string, value: TaskCustomFieldValue) => {
      if (!workspaceSlug) {
        return;
      }

      const nextSnapshot = await workspaceService.updateTaskCustomField(workspaceSlug, taskId, fieldId, value);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const updateTaskSchedule = useCallback(
    async (taskId: string, input: TaskScheduleInput) => {
      if (!workspaceSlug) {
        return;
      }

      const nextSnapshot = await workspaceService.updateTaskSchedule(workspaceSlug, taskId, input);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput) => {
      if (!workspaceSlug) {
        return;
      }

      const nextSnapshot = await workspaceService.updateTask(workspaceSlug, taskId, input);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const toggleChecklistItem = useCallback(async (taskId: string, itemId: string) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.toggleChecklistItem(workspaceSlug, taskId, itemId);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const setAutomationStatus = useCallback(
    async (automationId: string, status: WorkspaceAutomation["status"]) => {
      if (!workspaceSlug) {
        return;
      }

      const nextSnapshot = await workspaceService.setAutomationStatus(workspaceSlug, automationId, status);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const updatePreferences = useCallback(async (patch: Partial<WorkspacePreferences>) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.updatePreferences(workspaceSlug, patch);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const resetWorkspaceTemplate = useCallback(async (templateKey?: WorkspaceTemplateKey) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.resetWorkspaceTemplate(workspaceSlug, templateKey);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const setCardFieldVisibility = useCallback(async (fieldId: string, visible: boolean) => {
    if (!workspaceSlug) {
      return;
    }

    const nextSnapshot = await workspaceService.setCardFieldVisibility(workspaceSlug, fieldId, visible);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const setTypeFieldVisibility = useCallback(
    async (typeId: string, fieldId: string, visible: boolean) => {
      if (!workspaceSlug) return;
      const nextSnapshot = await workspaceService.setTypeFieldVisibility(workspaceSlug, typeId, fieldId, visible);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const setTypeDetailFieldVisibility = useCallback(
    async (typeId: string, fieldId: string, visible: boolean) => {
      if (!workspaceSlug) return;
      const nextSnapshot = await workspaceService.setTypeDetailFieldVisibility(workspaceSlug, typeId, fieldId, visible);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

  const fetchBoardColumns = useCallback(async (): Promise<ApiBoardColumn[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.fetchBoardColumns(workspaceSlug);
  }, [workspaceSlug]);

  const fetchWorkflowStates = useCallback(async (): Promise<ApiWorkflowState[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.fetchWorkflowStates(workspaceSlug);
  }, [workspaceSlug]);

  const fetchItemTypes = useCallback(async (): Promise<ApiItemType[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.fetchItemTypes(workspaceSlug);
  }, [workspaceSlug]);

  const fetchCustomFields = useCallback(async (): Promise<ApiCustomField[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.fetchCustomFields(workspaceSlug);
  }, [workspaceSlug]);

  const createBoardColumn = useCallback(async (input: CreateBoardColumnInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.createBoardColumn(workspaceSlug, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateBoardColumn = useCallback(async (columnId: string, input: UpdateBoardColumnInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.updateBoardColumn(workspaceSlug, columnId, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const deleteBoardColumn = useCallback(async (columnId: string) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.deleteBoardColumn(workspaceSlug, columnId);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const createItemType = useCallback(async (input: CreateItemTypeInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.createItemType(workspaceSlug, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateItemType = useCallback(async (typeId: string, input: UpdateItemTypeInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.updateItemType(workspaceSlug, typeId, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const deleteItemType = useCallback(async (typeId: string) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.deleteItemType(workspaceSlug, typeId);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const createCustomField = useCallback(async (input: CreateCustomFieldInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.createCustomField(workspaceSlug, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const updateCustomField = useCallback(async (fieldId: string, input: UpdateCustomFieldInput) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.updateCustomField(workspaceSlug, fieldId, input);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const deleteCustomField = useCallback(async (fieldId: string) => {
    if (!workspaceSlug) return;
    const nextSnapshot = await workspaceService.deleteCustomField(workspaceSlug, fieldId);
    setSnapshot(nextSnapshot);
  }, [workspaceSlug]);

  const listAutomationRules = useCallback(
    async (options?: { includeDisabled?: boolean }): Promise<AutomationRule[]> => {
      if (!workspaceSlug) return [];
      return workspaceService.listAutomationRules(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const listAutomationExecutions = useCallback(
    async (options?: { limit?: number }): Promise<AutomationExecution[]> => {
      if (!workspaceSlug) return [];
      return workspaceService.listAutomationExecutions(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const listAutomationViews = useCallback(async (): Promise<AutomationView[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.listAutomationViews(workspaceSlug);
  }, [workspaceSlug]);

  const runAutomationRule = useCallback(
    async (ruleId: string, context?: Record<string, unknown>): Promise<void> => {
      if (!workspaceSlug) return;
      return workspaceService.runAutomationRule(workspaceSlug, ruleId, context);
    },
    [workspaceSlug]
  );

  const createAutomationRule = useCallback(
    async (input: CreateAutomationRuleInput): Promise<AutomationRule> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.createAutomationRule(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateAutomationRule = useCallback(
    async (
      ruleId: string,
      input: Partial<CreateAutomationRuleInput> & { enabled?: boolean }
    ): Promise<AutomationRule> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.updateAutomationRule(workspaceSlug, ruleId, input);
    },
    [workspaceSlug]
  );

  const deleteAutomationRule = useCallback(
    async (ruleId: string): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.deleteAutomationRule(workspaceSlug, ruleId);
    },
    [workspaceSlug]
  );

  const listAiAgents = useCallback(async (): Promise<AiAgentSummary[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.listAiAgents(workspaceSlug);
  }, [workspaceSlug]);

  const listAiRuns = useCallback(
    async (input?: { itemId?: string; limit?: number }): Promise<AiRunSummary[]> => {
      if (!workspaceSlug) return [];
      return workspaceService.listAiRuns(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const getAiObservability = useCallback(async (): Promise<AiObservability> => {
    if (!workspaceSlug) {
      return {
        totals: {
          runs24h: 0,
          failed24h: 0,
          failureRate24h: 0,
          avgLatencyMs24h: 0,
          tokens24h: 0,
          estimatedCostUsd24h: 0
        },
        byProvider: []
      };
    }
    return workspaceService.getAiObservability(workspaceSlug);
  }, [workspaceSlug]);

  const createAiAgent = useCallback(async (input: CreateAiAgentInput): Promise<{ id: string }> => {
    if (!workspaceSlug) {
      return { id: "" };
    }
    return workspaceService.createAiAgent(workspaceSlug, input);
  }, [workspaceSlug]);

  const updateAiAgent = useCallback(
    async (
      agentId: string,
      patch: Partial<CreateAiAgentInput> & { description?: string | null }
    ): Promise<{ id: string }> => {
      if (!workspaceSlug) {
        return { id: "" };
      }
      return workspaceService.updateAiAgent(workspaceSlug, agentId, patch);
    },
    [workspaceSlug]
  );

  const runAiAgentOnItem = useCallback(
    async (
      itemId: string,
      agentId: string,
      input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
    ): Promise<{ runId: string; content: string }> => {
      if (!workspaceSlug) {
        return { runId: "", content: "" };
      }
      return workspaceService.runAiAgentOnItem(workspaceSlug, itemId, agentId, input);
    },
    [workspaceSlug]
  );

  const runAiRiskAnalysis = useCallback(
    async (
      itemId: string,
      input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
    ): Promise<{ runId: string; content: string }> => {
      if (!workspaceSlug) {
        return { runId: "", content: "" };
      }
      return workspaceService.runAiRiskAnalysis(workspaceSlug, itemId, input);
    },
    [workspaceSlug]
  );

  const runDocumentationAssistant = useCallback(
    async (input: RunDocumentationAssistantInput): Promise<RunDocumentationAssistantResult> => {
      if (!workspaceSlug) {
        return { runId: "", content: "", action: "chat", updatedDocument: null };
      }
      return workspaceService.runDocumentationAssistant(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const listWorkspaceDocuments = useCallback(async (): Promise<WorkspaceDocument[]> => {
    if (!workspaceSlug) {
      return [];
    }
    return workspaceService.listWorkspaceDocuments(workspaceSlug);
  }, [workspaceSlug]);

  const createWorkspaceDocument = useCallback(
    async (input: { title: string; content?: string; position?: number }): Promise<WorkspaceDocument> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.createWorkspaceDocument(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateWorkspaceDocument = useCallback(
    async (documentId: string, input: { title?: string; content?: string; position?: number }): Promise<WorkspaceDocument> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.updateWorkspaceDocument(workspaceSlug, documentId, input);
    },
    [workspaceSlug]
  );

  const deleteWorkspaceDocument = useCallback(
    async (documentId: string): Promise<void> => {
      if (!workspaceSlug) {
        return;
      }
      await workspaceService.deleteWorkspaceDocument(workspaceSlug, documentId);
    },
    [workspaceSlug]
  );

  const listWorkItemLinkedDocuments = useCallback(
    async (itemId: string): Promise<WorkItemLinkedDocument[]> => {
      if (!workspaceSlug) {
        return [];
      }
      return workspaceService.listWorkItemLinkedDocuments(workspaceSlug, itemId);
    },
    [workspaceSlug]
  );

  const linkDocumentToWorkItem = useCallback(
    async (itemId: string, documentId: string): Promise<WorkItemLinkedDocument[]> => {
      if (!workspaceSlug) {
        return [];
      }
      return workspaceService.linkDocumentToWorkItem(workspaceSlug, itemId, documentId);
    },
    [workspaceSlug]
  );

  const unlinkDocumentFromWorkItem = useCallback(
    async (itemId: string, documentId: string): Promise<void> => {
      if (!workspaceSlug) {
        return;
      }
      await workspaceService.unlinkDocumentFromWorkItem(workspaceSlug, itemId, documentId);
    },
    [workspaceSlug]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      snapshot,
      isLoading,
      createTask,
      deleteTask,
      moveTask,
      moveTaskToColumn,
      updateTaskPriority,
      updateTaskTitle,
      updateTaskDescription,
      updateTaskCustomField,
      updateTaskSchedule,
      updateTask,
      toggleChecklistItem,
      setAutomationStatus,
      updatePreferences,
      resetWorkspaceTemplate,
      setCardFieldVisibility,
      setTypeFieldVisibility,
      setTypeDetailFieldVisibility,
      fetchBoardColumns,
      fetchWorkflowStates,
      fetchItemTypes,
      fetchCustomFields,
      createBoardColumn,
      updateBoardColumn,
      deleteBoardColumn,
      createItemType,
      updateItemType,
      deleteItemType,
      createCustomField,
      updateCustomField,
      deleteCustomField,
      listAutomationRules,
      listAutomationExecutions,
      listAutomationViews,
      runAutomationRule,
      createAutomationRule,
      updateAutomationRule,
      deleteAutomationRule,
      listAiAgents,
      listAiRuns,
      getAiObservability,
      createAiAgent,
      updateAiAgent,
      runAiAgentOnItem,
      runAiRiskAnalysis,
      runDocumentationAssistant,
      listWorkspaceDocuments,
      createWorkspaceDocument,
      updateWorkspaceDocument,
      deleteWorkspaceDocument,
      listWorkItemLinkedDocuments,
      linkDocumentToWorkItem,
      unlinkDocumentFromWorkItem
    }),
    [
      snapshot,
      isLoading,
      createTask,
      deleteTask,
      moveTask,
      moveTaskToColumn,
      updateTaskPriority,
      updateTaskTitle,
      updateTaskDescription,
      updateTaskCustomField,
      updateTaskSchedule,
      updateTask,
      toggleChecklistItem,
      setAutomationStatus,
      updatePreferences,
      resetWorkspaceTemplate,
      setCardFieldVisibility,
      setTypeFieldVisibility,
      setTypeDetailFieldVisibility,
      fetchBoardColumns,
      fetchWorkflowStates,
      fetchItemTypes,
      fetchCustomFields,
      createBoardColumn,
      updateBoardColumn,
      deleteBoardColumn,
      createItemType,
      updateItemType,
      deleteItemType,
      createCustomField,
      updateCustomField,
      deleteCustomField,
      listAutomationRules,
      listAutomationExecutions,
      listAutomationViews,
      runAutomationRule,
      createAutomationRule,
      updateAutomationRule,
      deleteAutomationRule,
      listAiAgents,
      listAiRuns,
      getAiObservability,
      createAiAgent,
      updateAiAgent,
      runAiAgentOnItem,
      runAiRiskAnalysis,
      runDocumentationAssistant,
      listWorkspaceDocuments,
      createWorkspaceDocument,
      updateWorkspaceDocument,
      deleteWorkspaceDocument,
      listWorkItemLinkedDocuments,
      linkDocumentToWorkItem,
      unlinkDocumentFromWorkItem
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
