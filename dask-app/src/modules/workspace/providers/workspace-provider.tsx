import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type {
  AiCapabilities,
  AiAgentSummary,
  AiObservability,
  AiRunSummary,
  ApiBoardColumn,
  ApiCustomField,
  ApiItemType,
  ApiWorkflowState,
  BoardTemplateSummary,
  AutomationView,
  AutomationApprovalDetail,
  AutomationApprovalRecord,
  AutomationApprovalSummary,
  AutomationRunDetail,
  AutomationRunListItem,
  AutomationSideEffectSummary,
  AutomationWorkflow,
  AutomationWorkflowStatus,
  AutomationWorkflowVersion,
  AutomationWorkflowVersionStatus,
  AutomationCapabilities,
  CommunicationConversationDetail,
  CommunicationConversationSummary,
  CommunicationMessageSummary,
  CreateAiAgentInput,
  CreateWhatsAppTemplateInput,
  CommunicationTemplate,
  CommunicationTemplateVersion,
  RunDocumentationAssistantInput,
  RunDocumentationAssistantResult,
  DocumentLinkedEntityType,
  DocumentKind,
  Customer,
  CustomerStatus,
  CreateCustomerInput,
  CreateAutomationWorkflowInput,
  ListCommunicationInboxOptions,
  ListAutomationApprovalsOptions,
  ReviewAutomationApprovalInput,
  RunAutomationWorkflowInput,
  RunAutomationWorkflowResult,
  SaveAutomationWorkflowVersionInput,
  CreateBoardColumnInput,
  CreateCustomFieldInput,
  CreateItemTypeInput,
  CreateTaskInput,
  TaskScheduleInput,
  UpdateAutomationWorkflowInput,
  UpdateTaskInput,
  UpdateBoardColumnInput,
  UpdateCommunicationTemplateVersionInput,
  UpdateCustomFieldInput,
  UpdateItemTypeInput,
  WorkItemFieldBindingInput,
  WorkspaceAutomation,
  WorkspaceDocument,
  WorkspaceDocumentFolder,
  WorkspaceDocumentMetadata,
  WorkItemLinkedDocument,
  WhatsAppConsent,
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
  listBoardTemplates: () => Promise<BoardTemplateSummary[]>;
  createBoardTemplate: (input: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }) => Promise<BoardTemplateSummary>;
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
  replaceItemTypeFieldBindings: (typeId: string, bindings: WorkItemFieldBindingInput[]) => Promise<void>;

  createCustomField: (input: CreateCustomFieldInput) => Promise<void>;
  updateCustomField: (fieldId: string, input: UpdateCustomFieldInput) => Promise<void>;
  deleteCustomField: (fieldId: string) => Promise<void>;
  getAutomationCapabilities: () => Promise<AutomationCapabilities>;
  listAutomationWorkflows: (options?: { status?: AutomationWorkflowStatus; limit?: number }) => Promise<{ items: AutomationWorkflow[] }>;
  createAutomationWorkflow: (input: CreateAutomationWorkflowInput) => Promise<AutomationWorkflow>;
  getAutomationWorkflow: (workflowId: string) => Promise<AutomationWorkflow>;
  updateAutomationWorkflow: (workflowId: string, input: UpdateAutomationWorkflowInput) => Promise<AutomationWorkflow>;
  activateAutomationWorkflow: (workflowId: string) => Promise<AutomationWorkflow>;
  pauseAutomationWorkflow: (workflowId: string) => Promise<AutomationWorkflow>;
  archiveAutomationWorkflow: (workflowId: string) => Promise<AutomationWorkflow>;
  listAutomationWorkflowVersions: (
    workflowId: string,
    options?: { status?: AutomationWorkflowVersionStatus; limit?: number }
  ) => Promise<{ items: AutomationWorkflowVersion[] }>;
  createAutomationWorkflowDraftVersion: (
    workflowId: string,
    input?: SaveAutomationWorkflowVersionInput
  ) => Promise<AutomationWorkflowVersion>;
  getAutomationWorkflowVersion: (workflowId: string, versionId: string) => Promise<AutomationWorkflowVersion>;
  updateAutomationWorkflowVersion: (
    workflowId: string,
    versionId: string,
    input: SaveAutomationWorkflowVersionInput
  ) => Promise<AutomationWorkflowVersion>;
  publishAutomationWorkflowVersion: (
    workflowId: string,
    versionId: string,
    input?: { activateWorkflow?: boolean }
  ) => Promise<AutomationWorkflowVersion>;
  cloneAutomationWorkflowVersion: (workflowId: string, versionId: string) => Promise<AutomationWorkflowVersion>;
  runAutomationWorkflow: (workflowId: string, input?: RunAutomationWorkflowInput) => Promise<RunAutomationWorkflowResult>;
  listAutomationRuns: (options?: {
    workflowId?: string;
    status?: string;
    triggerType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
  }) => Promise<{ items: AutomationRunListItem[] }>;
  getAutomationRunDetail: (runId: string) => Promise<AutomationRunDetail>;
  cancelAutomationRun: (runId: string, reason?: string) => Promise<AutomationRunDetail>;
  listAutomationApprovals: (options?: ListAutomationApprovalsOptions) => Promise<{ items: AutomationApprovalSummary[] }>;
  listCommunicationInbox: (options?: ListCommunicationInboxOptions) => Promise<{ items: CommunicationConversationSummary[] }>;
  getCommunicationConversation: (conversationId: string) => Promise<CommunicationConversationDetail>;
  markCommunicationConversationRead: (conversationId: string) => Promise<void>;
  resolveCommunicationConversation: (conversationId: string) => Promise<void>;
  archiveCommunicationConversation: (conversationId: string) => Promise<void>;
  assignCommunicationConversation: (conversationId: string, assignedToId?: string | null) => Promise<void>;
  linkCommunicationConversationWorkItem: (conversationId: string, workItemId?: string | null) => Promise<void>;
  replyCommunicationConversation: (
    conversationId: string,
    input: { channel: "email" | "whatsapp"; text: string; sendMode: "manual" }
  ) => Promise<{ sideEffect: AutomationSideEffectSummary; message: CommunicationMessageSummary }>;
  getAutomationApproval: (approvalId: string) => Promise<AutomationApprovalDetail>;
  approveAutomationApproval: (approvalId: string, input: ReviewAutomationApprovalInput) => Promise<AutomationApprovalRecord>;
  rejectAutomationApproval: (approvalId: string, input: ReviewAutomationApprovalInput) => Promise<AutomationApprovalRecord>;
  cancelAutomationApproval: (approvalId: string, reason?: string) => Promise<AutomationApprovalRecord>;
  listCommunicationTemplates: (options?: { channel?: string; status?: string; limit?: number }) => Promise<{ items: CommunicationTemplate[] }>;
  createWhatsAppTemplate: (input: CreateWhatsAppTemplateInput) => Promise<CommunicationTemplate>;
  updateCommunicationTemplateVersion: (versionId: string, input: UpdateCommunicationTemplateVersionInput) => Promise<CommunicationTemplateVersion>;
  publishCommunicationTemplateVersion: (versionId: string) => Promise<CommunicationTemplateVersion>;
  markWhatsAppTemplateApprovalStatus: (
    versionId: string,
    input: { approvalStatus: "pending_review" | "approved" | "rejected" | "paused" | "disabled"; providerTemplateName?: string | null; providerTemplateId?: string | null }
  ) => Promise<CommunicationTemplateVersion>;
  listWhatsAppConsents: (options?: { status?: string; limit?: number }) => Promise<{ items: WhatsAppConsent[] }>;
  upsertWhatsAppConsent: (input: {
    address: string;
    status: "unknown" | "opted_in" | "opted_out" | "suppressed" | "bounced" | "complained" | "invalid";
    source?: string | null;
    reason?: string | null;
  }) => Promise<WhatsAppConsent>;
  simulateWhatsAppMockEvent: (
    sideEffectId: string,
    input: { eventType: "delivered" | "read" | "failed" | "replied"; messageText?: string }
  ) => Promise<AutomationSideEffectSummary>;
  listAutomationViews: () => Promise<AutomationView[]>;
  getAiCapabilities: () => Promise<AiCapabilities>;
  listAiAgents: () => Promise<AiAgentSummary[]>;
  listAiRuns: (input?: { itemId?: string; limit?: number }) => Promise<AiRunSummary[]>;
  getAiObservability: () => Promise<AiObservability>;
  createAiAgent: (input: CreateAiAgentInput) => Promise<{ id: string }>;
  updateAiAgent: (
    agentId: string,
    patch: Omit<Partial<CreateAiAgentInput>, "description"> & { description?: string | null }
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
  listWorkspaceDocumentFolders: () => Promise<WorkspaceDocumentFolder[]>;
  createWorkspaceDocumentFolder: (input: {
    name: string;
    parentId?: string | null;
    position?: number;
  }) => Promise<WorkspaceDocumentFolder>;
  updateWorkspaceDocumentFolder: (
    folderId: string,
    input: {
      name?: string;
      parentId?: string | null;
      position?: number;
    }
  ) => Promise<WorkspaceDocumentFolder>;
  deleteWorkspaceDocumentFolder: (folderId: string) => Promise<void>;
  listCustomers: (input?: { search?: string; status?: CustomerStatus }) => Promise<Customer[]>;
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  updateCustomer: (customerId: string, input: Partial<CreateCustomerInput>) => Promise<Customer>;
  createWorkspaceDocument: (input: {
    title: string;
    content?: string;
    kind?: DocumentKind;
    linkedEntityType?: DocumentLinkedEntityType;
    linkedEntityId?: string;
    tags?: string[];
    metadata?: WorkspaceDocumentMetadata;
    position?: number;
  }) => Promise<WorkspaceDocument>;
  updateWorkspaceDocument: (
    documentId: string,
    input: {
      title?: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType | null;
      linkedEntityId?: string | null;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
    }
  ) => Promise<WorkspaceDocument>;
  sendWorkspaceDocument: (documentId: string, input: { email?: string; emails?: string[] }) => Promise<WorkspaceDocument>;
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
      });

    return () => {
      mounted = false;
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

  const listBoardTemplates = useCallback(async (): Promise<BoardTemplateSummary[]> => {
    if (!workspaceSlug) {
      return [];
    }

    return workspaceService.listBoardTemplates(workspaceSlug);
  }, [workspaceSlug]);

  const createBoardTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      rules?: Record<string, unknown>;
    }): Promise<BoardTemplateSummary> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }

      return workspaceService.createBoardTemplate(workspaceSlug, input);
    },
    [workspaceSlug]
  );

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

  const replaceItemTypeFieldBindings = useCallback(
    async (typeId: string, bindings: WorkItemFieldBindingInput[]) => {
      if (!workspaceSlug) return;
      const nextSnapshot = await workspaceService.replaceItemTypeFieldBindings(workspaceSlug, typeId, bindings);
      setSnapshot(nextSnapshot);
    },
    [workspaceSlug]
  );

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

  const listAutomationWorkflows = useCallback(
    async (options?: { status?: AutomationWorkflowStatus; limit?: number }): Promise<{ items: AutomationWorkflow[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listAutomationWorkflows(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const createAutomationWorkflow = useCallback(
    async (input: CreateAutomationWorkflowInput): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.createAutomationWorkflow(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const getAutomationWorkflow = useCallback(
    async (workflowId: string): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.getAutomationWorkflow(workspaceSlug, workflowId);
    },
    [workspaceSlug]
  );

  const updateAutomationWorkflow = useCallback(
    async (workflowId: string, input: UpdateAutomationWorkflowInput): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.updateAutomationWorkflow(workspaceSlug, workflowId, input);
    },
    [workspaceSlug]
  );

  const activateAutomationWorkflow = useCallback(
    async (workflowId: string): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.activateAutomationWorkflow(workspaceSlug, workflowId);
    },
    [workspaceSlug]
  );

  const pauseAutomationWorkflow = useCallback(
    async (workflowId: string): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.pauseAutomationWorkflow(workspaceSlug, workflowId);
    },
    [workspaceSlug]
  );

  const archiveAutomationWorkflow = useCallback(
    async (workflowId: string): Promise<AutomationWorkflow> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.archiveAutomationWorkflow(workspaceSlug, workflowId);
    },
    [workspaceSlug]
  );

  const listAutomationWorkflowVersions = useCallback(
    async (
      workflowId: string,
      options?: { status?: AutomationWorkflowVersionStatus; limit?: number }
    ): Promise<{ items: AutomationWorkflowVersion[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listAutomationWorkflowVersions(workspaceSlug, workflowId, options);
    },
    [workspaceSlug]
  );

  const createAutomationWorkflowDraftVersion = useCallback(
    async (workflowId: string, input?: SaveAutomationWorkflowVersionInput): Promise<AutomationWorkflowVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.createAutomationWorkflowDraftVersion(workspaceSlug, workflowId, input);
    },
    [workspaceSlug]
  );

  const getAutomationWorkflowVersion = useCallback(
    async (workflowId: string, versionId: string): Promise<AutomationWorkflowVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.getAutomationWorkflowVersion(workspaceSlug, workflowId, versionId);
    },
    [workspaceSlug]
  );

  const updateAutomationWorkflowVersion = useCallback(
    async (
      workflowId: string,
      versionId: string,
      input: SaveAutomationWorkflowVersionInput
    ): Promise<AutomationWorkflowVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.updateAutomationWorkflowVersion(workspaceSlug, workflowId, versionId, input);
    },
    [workspaceSlug]
  );

  const publishAutomationWorkflowVersion = useCallback(
    async (
      workflowId: string,
      versionId: string,
      input?: { activateWorkflow?: boolean }
    ): Promise<AutomationWorkflowVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.publishAutomationWorkflowVersion(workspaceSlug, workflowId, versionId, input);
    },
    [workspaceSlug]
  );

  const cloneAutomationWorkflowVersion = useCallback(
    async (workflowId: string, versionId: string): Promise<AutomationWorkflowVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.cloneAutomationWorkflowVersion(workspaceSlug, workflowId, versionId);
    },
    [workspaceSlug]
  );

  const runAutomationWorkflow = useCallback(
    async (workflowId: string, input?: RunAutomationWorkflowInput): Promise<RunAutomationWorkflowResult> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.runAutomationWorkflow(workspaceSlug, workflowId, input);
    },
    [workspaceSlug]
  );

  const listAutomationRuns = useCallback(
    async (options?: {
      workflowId?: string;
      status?: string;
      triggerType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
    }): Promise<{ items: AutomationRunListItem[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listAutomationRuns(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const getAutomationRunDetail = useCallback(
    async (runId: string): Promise<AutomationRunDetail> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.getAutomationRunDetail(workspaceSlug, runId);
    },
    [workspaceSlug]
  );

  const cancelAutomationRun = useCallback(
    async (runId: string, reason?: string): Promise<AutomationRunDetail> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.cancelAutomationRun(workspaceSlug, runId, reason);
    },
    [workspaceSlug]
  );

  const listAutomationApprovals = useCallback(
    async (options?: ListAutomationApprovalsOptions): Promise<{ items: AutomationApprovalSummary[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listAutomationApprovals(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const listCommunicationInbox = useCallback(
    async (options?: ListCommunicationInboxOptions): Promise<{ items: CommunicationConversationSummary[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listCommunicationInbox(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const getCommunicationConversation = useCallback(
    async (conversationId: string): Promise<CommunicationConversationDetail> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.getCommunicationConversation(workspaceSlug, conversationId);
    },
    [workspaceSlug]
  );

  const markCommunicationConversationRead = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.markCommunicationConversationRead(workspaceSlug, conversationId);
    },
    [workspaceSlug]
  );

  const resolveCommunicationConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.resolveCommunicationConversation(workspaceSlug, conversationId);
    },
    [workspaceSlug]
  );

  const archiveCommunicationConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.archiveCommunicationConversation(workspaceSlug, conversationId);
    },
    [workspaceSlug]
  );

  const assignCommunicationConversation = useCallback(
    async (conversationId: string, assignedToId?: string | null): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.assignCommunicationConversation(workspaceSlug, conversationId, assignedToId);
    },
    [workspaceSlug]
  );

  const linkCommunicationConversationWorkItem = useCallback(
    async (conversationId: string, workItemId?: string | null): Promise<void> => {
      if (!workspaceSlug) return;
      await workspaceService.linkCommunicationConversationWorkItem(workspaceSlug, conversationId, workItemId);
    },
    [workspaceSlug]
  );

  const replyCommunicationConversation = useCallback(
    async (
      conversationId: string,
      input: { channel: "email" | "whatsapp"; text: string; sendMode: "manual" }
    ): Promise<{ sideEffect: AutomationSideEffectSummary; message: CommunicationMessageSummary }> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.replyCommunicationConversation(workspaceSlug, conversationId, input);
    },
    [workspaceSlug]
  );

  const getAutomationApproval = useCallback(
    async (approvalId: string): Promise<AutomationApprovalDetail> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.getAutomationApproval(workspaceSlug, approvalId);
    },
    [workspaceSlug]
  );

  const approveAutomationApproval = useCallback(
    async (approvalId: string, input: ReviewAutomationApprovalInput): Promise<AutomationApprovalRecord> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.approveAutomationApproval(workspaceSlug, approvalId, input);
    },
    [workspaceSlug]
  );

  const rejectAutomationApproval = useCallback(
    async (approvalId: string, input: ReviewAutomationApprovalInput): Promise<AutomationApprovalRecord> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.rejectAutomationApproval(workspaceSlug, approvalId, input);
    },
    [workspaceSlug]
  );

  const cancelAutomationApproval = useCallback(
    async (approvalId: string, reason?: string): Promise<AutomationApprovalRecord> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.cancelAutomationApproval(workspaceSlug, approvalId, reason);
    },
    [workspaceSlug]
  );

  const listCommunicationTemplates = useCallback(
    async (options?: { channel?: string; status?: string; limit?: number }): Promise<{ items: CommunicationTemplate[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listCommunicationTemplates(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const createWhatsAppTemplate = useCallback(
    async (input: CreateWhatsAppTemplateInput): Promise<CommunicationTemplate> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.createWhatsAppTemplate(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateCommunicationTemplateVersion = useCallback(
    async (versionId: string, input: UpdateCommunicationTemplateVersionInput): Promise<CommunicationTemplateVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.updateCommunicationTemplateVersion(workspaceSlug, versionId, input);
    },
    [workspaceSlug]
  );

  const publishCommunicationTemplateVersion = useCallback(
    async (versionId: string): Promise<CommunicationTemplateVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.publishCommunicationTemplateVersion(workspaceSlug, versionId);
    },
    [workspaceSlug]
  );

  const markWhatsAppTemplateApprovalStatus = useCallback(
    async (
      versionId: string,
      input: { approvalStatus: "pending_review" | "approved" | "rejected" | "paused" | "disabled"; providerTemplateName?: string | null; providerTemplateId?: string | null }
    ): Promise<CommunicationTemplateVersion> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.markWhatsAppTemplateApprovalStatus(workspaceSlug, versionId, input);
    },
    [workspaceSlug]
  );

  const listWhatsAppConsents = useCallback(
    async (options?: { status?: string; limit?: number }): Promise<{ items: WhatsAppConsent[] }> => {
      if (!workspaceSlug) return { items: [] };
      return workspaceService.listWhatsAppConsents(workspaceSlug, options);
    },
    [workspaceSlug]
  );

  const upsertWhatsAppConsent = useCallback(
    async (input: {
      address: string;
      status: "unknown" | "opted_in" | "opted_out" | "suppressed" | "bounced" | "complained" | "invalid";
      source?: string | null;
      reason?: string | null;
    }): Promise<WhatsAppConsent> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.upsertWhatsAppConsent(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const simulateWhatsAppMockEvent = useCallback(
    async (
      sideEffectId: string,
      input: { eventType: "delivered" | "read" | "failed" | "replied"; messageText?: string }
    ): Promise<AutomationSideEffectSummary> => {
      if (!workspaceSlug) throw new Error("No workspace");
      return workspaceService.simulateWhatsAppMockEvent(workspaceSlug, sideEffectId, input);
    },
    [workspaceSlug]
  );

  const listAutomationViews = useCallback(async (): Promise<AutomationView[]> => {
    if (!workspaceSlug) return [];
    return workspaceService.listAutomationViews(workspaceSlug);
  }, [workspaceSlug]);

  const getAutomationCapabilities = useCallback(async (): Promise<AutomationCapabilities> => {
    if (!workspaceSlug) {
      throw new Error("No workspace");
    }
    return workspaceService.getAutomationCapabilities(workspaceSlug);
  }, [workspaceSlug]);

  const getAiCapabilities = useCallback(async (): Promise<AiCapabilities> => {
    if (!workspaceSlug) {
      throw new Error("No workspace");
    }
    return workspaceService.getAiCapabilities(workspaceSlug);
  }, [workspaceSlug]);

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
      patch: Omit<Partial<CreateAiAgentInput>, "description"> & { description?: string | null }
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

  const listWorkspaceDocumentFolders = useCallback(async (): Promise<WorkspaceDocumentFolder[]> => {
    if (!workspaceSlug) {
      return [];
    }
    return workspaceService.listWorkspaceDocumentFolders(workspaceSlug);
  }, [workspaceSlug]);

  const createWorkspaceDocumentFolder = useCallback(
    async (input: {
      name: string;
      parentId?: string | null;
      position?: number;
    }): Promise<WorkspaceDocumentFolder> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.createWorkspaceDocumentFolder(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateWorkspaceDocumentFolder = useCallback(
    async (
      folderId: string,
      input: {
        name?: string;
        parentId?: string | null;
        position?: number;
      }
    ): Promise<WorkspaceDocumentFolder> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.updateWorkspaceDocumentFolder(workspaceSlug, folderId, input);
    },
    [workspaceSlug]
  );

  const deleteWorkspaceDocumentFolder = useCallback(
    async (folderId: string): Promise<void> => {
      if (!workspaceSlug) {
        return;
      }
      await workspaceService.deleteWorkspaceDocumentFolder(workspaceSlug, folderId);
    },
    [workspaceSlug]
  );

  const listCustomers = useCallback(
    async (input?: { search?: string; status?: CustomerStatus }): Promise<Customer[]> => {
      if (!workspaceSlug) {
        return [];
      }
      return workspaceService.listCustomers(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const createCustomer = useCallback(
    async (input: CreateCustomerInput): Promise<Customer> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.createCustomer(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateCustomer = useCallback(
    async (customerId: string, input: Partial<CreateCustomerInput>): Promise<Customer> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.updateCustomer(workspaceSlug, customerId, input);
    },
    [workspaceSlug]
  );

  const createWorkspaceDocument = useCallback(
    async (input: {
      title: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType;
      linkedEntityId?: string;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
    }): Promise<WorkspaceDocument> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.createWorkspaceDocument(workspaceSlug, input);
    },
    [workspaceSlug]
  );

  const updateWorkspaceDocument = useCallback(
    async (documentId: string, input: {
      title?: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType | null;
      linkedEntityId?: string | null;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
    }): Promise<WorkspaceDocument> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.updateWorkspaceDocument(workspaceSlug, documentId, input);
    },
    [workspaceSlug]
  );

  const sendWorkspaceDocument = useCallback(
    async (documentId: string, input: { email?: string; emails?: string[] }): Promise<WorkspaceDocument> => {
      if (!workspaceSlug) {
        throw new Error("No workspace");
      }
      return workspaceService.sendWorkspaceDocument(workspaceSlug, documentId, input);
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
      listBoardTemplates,
      createBoardTemplate,
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
      replaceItemTypeFieldBindings,
      createCustomField,
      updateCustomField,
      deleteCustomField,
      listAutomationWorkflows,
      createAutomationWorkflow,
      getAutomationWorkflow,
      updateAutomationWorkflow,
      activateAutomationWorkflow,
      pauseAutomationWorkflow,
      archiveAutomationWorkflow,
      listAutomationWorkflowVersions,
      createAutomationWorkflowDraftVersion,
      getAutomationWorkflowVersion,
      updateAutomationWorkflowVersion,
      publishAutomationWorkflowVersion,
      cloneAutomationWorkflowVersion,
      runAutomationWorkflow,
      listAutomationRuns,
      getAutomationRunDetail,
      cancelAutomationRun,
      listAutomationApprovals,
      listCommunicationInbox,
      getCommunicationConversation,
      markCommunicationConversationRead,
      resolveCommunicationConversation,
      archiveCommunicationConversation,
      assignCommunicationConversation,
      linkCommunicationConversationWorkItem,
      replyCommunicationConversation,
      getAutomationApproval,
      approveAutomationApproval,
      rejectAutomationApproval,
      cancelAutomationApproval,
      listCommunicationTemplates,
      createWhatsAppTemplate,
      updateCommunicationTemplateVersion,
      publishCommunicationTemplateVersion,
      markWhatsAppTemplateApprovalStatus,
      listWhatsAppConsents,
      upsertWhatsAppConsent,
      simulateWhatsAppMockEvent,
      listAutomationViews,
      getAutomationCapabilities,
      getAiCapabilities,
      listAiAgents,
      listAiRuns,
      getAiObservability,
      createAiAgent,
      updateAiAgent,
      runAiAgentOnItem,
      runAiRiskAnalysis,
      runDocumentationAssistant,
      listWorkspaceDocuments,
      listWorkspaceDocumentFolders,
      createWorkspaceDocumentFolder,
      updateWorkspaceDocumentFolder,
      deleteWorkspaceDocumentFolder,
      listCustomers,
      createCustomer,
      updateCustomer,
      createWorkspaceDocument,
      updateWorkspaceDocument,
      sendWorkspaceDocument,
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
      listBoardTemplates,
      createBoardTemplate,
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
      replaceItemTypeFieldBindings,
      createCustomField,
      updateCustomField,
      deleteCustomField,
      listAutomationWorkflows,
      createAutomationWorkflow,
      getAutomationWorkflow,
      updateAutomationWorkflow,
      activateAutomationWorkflow,
      pauseAutomationWorkflow,
      archiveAutomationWorkflow,
      listAutomationWorkflowVersions,
      createAutomationWorkflowDraftVersion,
      getAutomationWorkflowVersion,
      updateAutomationWorkflowVersion,
      publishAutomationWorkflowVersion,
      cloneAutomationWorkflowVersion,
      runAutomationWorkflow,
      listAutomationRuns,
      getAutomationRunDetail,
      cancelAutomationRun,
      listAutomationApprovals,
      listCommunicationInbox,
      getCommunicationConversation,
      markCommunicationConversationRead,
      resolveCommunicationConversation,
      archiveCommunicationConversation,
      assignCommunicationConversation,
      linkCommunicationConversationWorkItem,
      replyCommunicationConversation,
      getAutomationApproval,
      approveAutomationApproval,
      rejectAutomationApproval,
      cancelAutomationApproval,
      listCommunicationTemplates,
      createWhatsAppTemplate,
      updateCommunicationTemplateVersion,
      publishCommunicationTemplateVersion,
      markWhatsAppTemplateApprovalStatus,
      listWhatsAppConsents,
      upsertWhatsAppConsent,
      simulateWhatsAppMockEvent,
      listAutomationViews,
      getAutomationCapabilities,
      getAiCapabilities,
      listAiAgents,
      listAiRuns,
      getAiObservability,
      createAiAgent,
      updateAiAgent,
      runAiAgentOnItem,
      runAiRiskAnalysis,
      runDocumentationAssistant,
      listWorkspaceDocuments,
      listWorkspaceDocumentFolders,
      createWorkspaceDocumentFolder,
      updateWorkspaceDocumentFolder,
      deleteWorkspaceDocumentFolder,
      listCustomers,
      createCustomer,
      updateCustomer,
      createWorkspaceDocument,
      updateWorkspaceDocument,
      sendWorkspaceDocument,
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
