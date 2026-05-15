import { useCallback, useMemo, useState } from "react";
import {
  useAutomationApprovals,
  useAutomationRunDetail,
  useAutomationRuns,
  useAutomationTemplates,
  useCancelAutomationRunMutation
} from "@/modules/automation/query";
import type { StudioTab } from "@/pages/automations-page/model/automation-page.types";

export function useAutomationOperations(input: {
  workspaceSlug: string;
  activeTab: StudioTab;
  selectedWorkflowId: string | null;
}) {
  const { workspaceSlug, activeTab, selectedWorkflowId } = input;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQuery = useAutomationRuns(
    workspaceSlug,
    { workflowId: selectedWorkflowId ?? undefined, limit: 100 },
    { enabled: activeTab === "runs" }
  );
  const runDetailQuery = useAutomationRunDetail(
    workspaceSlug,
    selectedRunId,
    { enabled: activeTab === "runs" }
  );
  const approvalsQuery = useAutomationApprovals(
    workspaceSlug,
    { limit: 100 },
    { enabled: activeTab === "approvals" }
  );
  const templatesQuery = useAutomationTemplates(
    workspaceSlug,
    { limit: 100 },
    { enabled: activeTab === "templates" }
  );

  const cancelRunMutation = useCancelAutomationRunMutation(workspaceSlug);

  const handleCancelRun = useCallback(async (runId: string) => {
    await cancelRunMutation.mutateAsync({
      runId,
      reason: "Cancelado pelo Automation Studio"
    });
  }, [cancelRunMutation]);

  return useMemo(() => ({
    runs: runsQuery.data?.items ?? [],
    runsLoading: runsQuery.isLoading,
    runsError: runsQuery.error,
    selectedRun: runDetailQuery.data ?? null,
    selectedRunLoading: runDetailQuery.isLoading,
    approvals: approvalsQuery.data?.items ?? [],
    approvalsLoading: approvalsQuery.isLoading,
    approvalsError: approvalsQuery.error,
    templates: templatesQuery.data?.items ?? [],
    templatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,
    setSelectedRunId,
    refreshRuns: runsQuery.refetch,
    refreshApprovals: approvalsQuery.refetch,
    refreshTemplates: templatesQuery.refetch,
    handleCancelRun
  }), [
    approvalsQuery.data?.items,
    approvalsQuery.error,
    approvalsQuery.isLoading,
    approvalsQuery.refetch,
    handleCancelRun,
    runDetailQuery.data,
    runDetailQuery.isLoading,
    runsQuery.data?.items,
    runsQuery.error,
    runsQuery.isLoading,
    runsQuery.refetch,
    templatesQuery.data?.items,
    templatesQuery.error,
    templatesQuery.isLoading,
    templatesQuery.refetch
  ]);
}
