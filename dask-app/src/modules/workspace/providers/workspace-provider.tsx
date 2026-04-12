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

function useWorkspaceSnapshotAction<Args extends unknown[]>(
  mutation: (...args: Args) => Promise<WorkspaceSnapshot>,
  setSnapshot: (snapshot: WorkspaceSnapshot) => void
) {
  return useCallback(
    async (...args: Args): Promise<void> => {
      const nextSnapshot = await mutation(...args);
      setSnapshot(nextSnapshot);
    },
    [mutation, setSnapshot]
  );
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadSnapshot = async () => {
      try {
        const nextSnapshot = await workspaceService.getSnapshot();
        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      isActive = false;
    };
  }, []);

  const createTask = useWorkspaceSnapshotAction<[CreateTaskInput]>(workspaceService.createTask, setSnapshot);
  const moveTask = useWorkspaceSnapshotAction<[string, TaskStatusId]>(workspaceService.moveTask, setSnapshot);
  const updateTaskPriority = useWorkspaceSnapshotAction<[string, TaskPriority]>(
    workspaceService.updateTaskPriority,
    setSnapshot
  );
  const updateTaskCustomField = useWorkspaceSnapshotAction<[string, string, TaskCustomFieldValue]>(
    workspaceService.updateTaskCustomField,
    setSnapshot
  );
  const toggleChecklistItem = useWorkspaceSnapshotAction<[string, string]>(
    workspaceService.toggleChecklistItem,
    setSnapshot
  );
  const setAutomationStatus = useWorkspaceSnapshotAction<[string, WorkspaceAutomation["status"]]>(
    workspaceService.setAutomationStatus,
    setSnapshot
  );
  const updatePreferences = useWorkspaceSnapshotAction<[Partial<WorkspacePreferences>]>(
    workspaceService.updatePreferences,
    setSnapshot
  );
  const setCardFieldVisibility = useWorkspaceSnapshotAction<[string, boolean]>(
    workspaceService.setCardFieldVisibility,
    setSnapshot
  );

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
