import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { CreateTaskInput, WorkspaceAutomation, WorkspacePreferences, WorkspaceSnapshot } from "@/modules/workspace/model";

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot | null;
  isLoading: boolean;
  createTask: (input: CreateTaskInput) => Promise<void>;
  moveTask: (taskId: string, nextStatus: TaskStatusId) => Promise<void>;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => Promise<void>;
  updateTaskCustomField: (taskId: string, fieldId: string, value: TaskCustomFieldValue) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  setAutomationStatus: (automationId: string, status: WorkspaceAutomation["status"]) => Promise<void>;
  updatePreferences: (patch: Partial<WorkspacePreferences>) => Promise<void>;
  setCardFieldVisibility: (fieldId: string, visible: boolean) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    workspaceService
      .getSnapshot()
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
  }, []);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    const nextSnapshot = await workspaceService.createTask(input);
    setSnapshot(nextSnapshot);
  }, []);

  const moveTask = useCallback(async (taskId: string, nextStatus: TaskStatusId) => {
    const nextSnapshot = await workspaceService.moveTask(taskId, nextStatus);
    setSnapshot(nextSnapshot);
  }, []);

  const updateTaskPriority = useCallback(async (taskId: string, priority: TaskPriority) => {
    const nextSnapshot = await workspaceService.updateTaskPriority(taskId, priority);
    setSnapshot(nextSnapshot);
  }, []);

  const updateTaskCustomField = useCallback(
    async (taskId: string, fieldId: string, value: TaskCustomFieldValue) => {
      const nextSnapshot = await workspaceService.updateTaskCustomField(taskId, fieldId, value);
      setSnapshot(nextSnapshot);
    },
    []
  );

  const toggleChecklistItem = useCallback(async (taskId: string, itemId: string) => {
    const nextSnapshot = await workspaceService.toggleChecklistItem(taskId, itemId);
    setSnapshot(nextSnapshot);
  }, []);

  const setAutomationStatus = useCallback(
    async (automationId: string, status: WorkspaceAutomation["status"]) => {
      const nextSnapshot = await workspaceService.setAutomationStatus(automationId, status);
      setSnapshot(nextSnapshot);
    },
    []
  );

  const updatePreferences = useCallback(async (patch: Partial<WorkspacePreferences>) => {
    const nextSnapshot = await workspaceService.updatePreferences(patch);
    setSnapshot(nextSnapshot);
  }, []);

  const setCardFieldVisibility = useCallback(async (fieldId: string, visible: boolean) => {
    const nextSnapshot = await workspaceService.setCardFieldVisibility(fieldId, visible);
    setSnapshot(nextSnapshot);
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      snapshot,
      isLoading,
      createTask,
      moveTask,
      updateTaskPriority,
      updateTaskCustomField,
      toggleChecklistItem,
      setAutomationStatus,
      updatePreferences,
      setCardFieldVisibility
    }),
    [
      snapshot,
      isLoading,
      createTask,
      moveTask,
      updateTaskPriority,
      updateTaskCustomField,
      toggleChecklistItem,
      setAutomationStatus,
      updatePreferences,
      setCardFieldVisibility
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
