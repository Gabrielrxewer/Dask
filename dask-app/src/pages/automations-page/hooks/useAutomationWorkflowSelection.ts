import { useEffect, useMemo, useState } from "react";
import type { AutomationWorkflow, AutomationWorkflowVersion } from "@/modules/workspace/model";

export function useAutomationWorkflowSelection(input: {
  workflows: AutomationWorkflow[];
}) {
  const { workflows } = input;
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows]
  );

  useEffect(() => {
    setSelectedWorkflowId((current) => {
      if (current && workflows.some((workflow) => workflow.id === current)) return current;
      return workflows[0]?.id ?? null;
    });
  }, [workflows]);

  return {
    selectedWorkflow,
    selectedWorkflowId,
    setSelectedWorkflowId
  };
}

export function useAutomationVersionSelection(input: {
  versions: AutomationWorkflowVersion[];
  selectedWorkflow: AutomationWorkflow | null;
}) {
  const { versions, selectedWorkflow } = input;
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions]
  );
  const currentVersion = useMemo(
    () => versions.find((version) => version.id === selectedWorkflow?.currentVersionId) ?? null,
    [selectedWorkflow?.currentVersionId, versions]
  );

  useEffect(() => {
    if (!selectedWorkflow) {
      setSelectedVersionId(null);
      return;
    }

    const preferred = versions.find((version) => version.status === "draft")
      ?? versions.find((version) => version.id === selectedWorkflow?.currentVersionId)
      ?? versions[0]
      ?? null;

    setSelectedVersionId((current) => {
      if (current && versions.some((version) => version.id === current)) return current;
      return preferred?.id ?? null;
    });
  }, [selectedWorkflow, selectedWorkflow?.currentVersionId, versions]);

  return {
    selectedVersion,
    selectedVersionId,
    currentVersion,
    hasDraft: versions.some((version) => version.status === "draft"),
    setSelectedVersionId
  };
}
