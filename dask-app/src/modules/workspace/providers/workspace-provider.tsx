import { useMemo, type ReactNode } from "react";
import { WorkspaceContext, type WorkspaceContextValue } from "@/modules/workspace/providers/workspace-context";
import { useCurrentWorkspace } from "@/modules/workspace/providers/workspace-selectors";

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const currentWorkspace = useCurrentWorkspace();

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      snapshot: currentWorkspace.snapshot,
      isLoading: currentWorkspace.isSnapshotLoading
    }),
    [currentWorkspace.isSnapshotLoading, currentWorkspace.snapshot]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
