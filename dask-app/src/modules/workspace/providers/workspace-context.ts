import { createContext, useContext } from "react";
import type { WorkspaceSnapshot } from "@/modules/workspace/model";

export interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot | null;
  isLoading: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
