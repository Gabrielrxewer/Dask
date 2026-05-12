import { useCallback, useMemo, useState } from "react";
import {
  useAutomationApprovals,
  useAutomationConsents,
  useAutomationConversationDetail,
  useAutomationInbox,
  useAutomationRunDetail,
  useAutomationRuns,
  useAutomationTemplates,
  useCancelAutomationRunMutation,
  useReplyAutomationConversationMutation,
  useUpsertWhatsAppConsentMutation
} from "@/modules/automation/query";
import type { StudioTab } from "@/pages/automations-page/model/automation-page.types";

export function useAutomationOperations(input: {
  workspaceSlug: string;
  activeTab: StudioTab;
  selectedWorkflowId: string | null;
}) {
  const { workspaceSlug, activeTab, selectedWorkflowId } = input;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

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
  const inboxQuery = useAutomationInbox(
    workspaceSlug,
    { limit: 100 },
    { enabled: activeTab === "inbox" || activeTab === "contacts" }
  );
  const conversationQuery = useAutomationConversationDetail(
    workspaceSlug,
    selectedConversationId,
    { enabled: activeTab === "inbox" }
  );
  const templatesQuery = useAutomationTemplates(
    workspaceSlug,
    { limit: 100 },
    { enabled: activeTab === "templates" }
  );
  const consentsQuery = useAutomationConsents(
    workspaceSlug,
    { limit: 100 },
    { enabled: activeTab === "settings" }
  );

  const cancelRunMutation = useCancelAutomationRunMutation(workspaceSlug);
  const replyMutation = useReplyAutomationConversationMutation(workspaceSlug);
  const upsertConsentMutation = useUpsertWhatsAppConsentMutation(workspaceSlug);

  const selectedConversation = conversationQuery.data ?? null;
  const conversations = inboxQuery.data?.items ?? [];
  const consents = consentsQuery.data?.items ?? [];

  const handleCancelRun = useCallback(async (runId: string) => {
    await cancelRunMutation.mutateAsync({
      runId,
      reason: "Cancelado pelo Automation Studio"
    });
  }, [cancelRunMutation]);

  const handleReply = useCallback(async () => {
    if (!selectedConversation || !replyText.trim()) return;
    await replyMutation.mutateAsync({
      conversationId: selectedConversation.conversation.id,
      channel: selectedConversation.conversation.channel === "email" ? "email" : "whatsapp",
      text: replyText
    });
    setReplyText("");
  }, [replyMutation, replyText, selectedConversation]);

  const handleOptOutFirstConsent = useCallback(async () => {
    const first = consents[0];
    if (!first) return;
    await upsertConsentMutation.mutateAsync({
      address: first.address,
      status: "opted_out",
      source: "automation_studio"
    });
  }, [consents, upsertConsentMutation]);

  return useMemo(() => ({
    runs: runsQuery.data?.items ?? [],
    runsLoading: runsQuery.isLoading,
    runsError: runsQuery.error,
    selectedRun: runDetailQuery.data ?? null,
    selectedRunLoading: runDetailQuery.isLoading,
    approvals: approvalsQuery.data?.items ?? [],
    approvalsLoading: approvalsQuery.isLoading,
    approvalsError: approvalsQuery.error,
    conversations,
    inboxLoading: inboxQuery.isLoading,
    inboxError: inboxQuery.error,
    selectedConversation,
    selectedConversationLoading: conversationQuery.isLoading,
    replyText,
    templates: templatesQuery.data?.items ?? [],
    templatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,
    consents,
    consentsLoading: consentsQuery.isLoading,
    consentsError: consentsQuery.error,
    setSelectedRunId,
    setSelectedConversationId,
    setReplyText,
    refreshRuns: runsQuery.refetch,
    refreshApprovals: approvalsQuery.refetch,
    refreshInbox: inboxQuery.refetch,
    refreshTemplates: templatesQuery.refetch,
    refreshConsents: consentsQuery.refetch,
    handleCancelRun,
    handleReply,
    handleOptOutFirstConsent
  }), [
    approvalsQuery.data?.items,
    approvalsQuery.error,
    approvalsQuery.isLoading,
    approvalsQuery.refetch,
    consents,
    consentsQuery.error,
    consentsQuery.isLoading,
    consentsQuery.refetch,
    conversationQuery.isLoading,
    conversations,
    handleCancelRun,
    handleOptOutFirstConsent,
    handleReply,
    inboxQuery.error,
    inboxQuery.isLoading,
    inboxQuery.refetch,
    replyText,
    runDetailQuery.data,
    runDetailQuery.isLoading,
    runsQuery.data?.items,
    runsQuery.error,
    runsQuery.isLoading,
    runsQuery.refetch,
    selectedConversation,
    templatesQuery.data?.items,
    templatesQuery.error,
    templatesQuery.isLoading,
    templatesQuery.refetch
  ]);
}
