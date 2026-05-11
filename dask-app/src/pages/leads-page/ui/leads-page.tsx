import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { buildWorkspaceBoardPath, buildWorkspaceDocumentationPath, buildWorkspaceLeadFlowPath } from "@/app/router";
import { buildBoardMetrics, type BoardLeadOperationalMetadata, type Task } from "@/entities/task";
import {
  getCustomerDisplayName,
  useWorkspace,
  type Customer,
  type CreateCustomerInput,
  type WorkItemTypeTransformationSummary
} from "@/modules/workspace";
import {
  flattenCustomerPages,
  flattenWorkItemPages,
  leadsQueryKeys,
  useConvertLeadToCustomerMutation,
  useCreateCustomerMutation,
  useCreateLeadMutation,
  useCreateSignalMutation,
  useCustomersQuery,
  useLeadTransformationsQuery,
  useLeadsQuery,
  useSignalsQuery,
  useTransformWorkItemTypeMutation,
  useUpdateLeadMutation
} from "@/modules/leads";
import {
  useBillingCatalogQuery,
  useCreateCheckoutSessionMutation,
  billingQueryKeys,
  type ConnectCatalogItem
} from "@/modules/billing";
import { documentationQueryKeys, useDocumentsQuery } from "@/modules/documentation";
import { AppDialog, Button, InlineAlert, LoadingState, toast, WorkspaceFrame } from "@/shared/ui";
import { customerFormSchema } from "@/modules/leads/model";
import { AppShell } from "@/widgets/app-shell";
import { BillingJustificationDialog } from "./billing-justification-dialog";
import { CustomerDetailModal } from "./customer-detail-modal";
import { CustomerForm } from "./customer-form";
import { CustomersListSection } from "./customers-list-section";
import { LeadFormModal } from "./lead-form-modal";
import { LeadsListSection } from "./leads-list-section";
import {
  buildTransformationDefaultValues,
  getFieldsRequiringTransformationInput,
  WorkItemTypeTransformationDialog
} from "./work-item-type-transformation-dialog";
import {
  buildCustomFieldValuesBySlug,
  buildCustomerInputFromLead,
  buildFilteredLeadMetrics,
  buildFunnelData,
  buildPendingItems,
  buildPipelineMetrics,
  buildSourceBreakdown,
  buildStatusDistribution,
  emptyCustomerForm,
  emptyLeadForm,
  findPossibleDuplicates,
  formatCustomerAddress,
  getNumberField,
  getTextField,
  type LeadFormState,
  type LeadsTab,
  type ModalMode
} from "./leads-page.model";
import { LeadsOverviewSection } from "./leads-overview-section";
import { LeadsTopNavigation } from "./leads-top-navigation";
import { LinkCustomerModal } from "./link-customer-modal";
import "./leads-page.css";

export function LeadsPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const queryClient = useQueryClient();
  const {
    snapshot,
    isLoading
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<LeadsTab>("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(() => emptyLeadForm());
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>(() => emptyCustomerForm());
  const [linkCustomerId, setLinkCustomerId] = useState("");

  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const leadMetadata: BoardLeadOperationalMetadata | null = snapshot?.boardConfig.operationalMetadata?.leads ?? null;
  const commercialTypeId = leadMetadata?.defaultItemTypeId ?? "";
  const signalTypeId = leadMetadata?.prospecting?.itemTypeIds?.[0] ?? "";
  const initialStatusId = leadMetadata?.initialStatusId ?? "";
  const signalInitialStatusId = leadMetadata?.prospecting?.initialStatusId || initialStatusId;
  const deferredSearch = useDeferredValue(search);
  const documentsQuery = useDocumentsQuery(workspaceSlug || null, { limit: 200, sort: "updated_desc" });
  const leadsQuery = useLeadsQuery(workspaceSlug || null, commercialTypeId || null, {
    search: tab === "leads" ? deferredSearch : "",
    limit: 50,
    sort: "updated_desc"
  });
  const signalsQuery = useSignalsQuery(workspaceSlug || null, signalTypeId || null, {
    search: tab === "leads" ? deferredSearch : "",
    limit: 30,
    sort: "updated_desc"
  });
  const customersQuery = useCustomersQuery(workspaceSlug || null, {
    search: tab === "customers" ? deferredSearch : "",
    limit: 80
  });
  const transformationsQuery = useLeadTransformationsQuery(workspaceSlug || null);
  const createLeadMutation = useCreateLeadMutation(workspaceSlug || null, { silent: true });
  const createSignalMutation = useCreateSignalMutation(workspaceSlug || null, { silent: true });
  const updateLeadMutation = useUpdateLeadMutation(workspaceSlug || null, { silent: true });
  const createCustomerMutation = useCreateCustomerMutation(workspaceSlug || null, { silent: true });
  const transformWorkItemTypeMutation = useTransformWorkItemTypeMutation(workspaceSlug || null, { silent: true });
  const convertLeadToCustomerMutation = useConvertLeadToCustomerMutation(workspaceSlug || null, { silent: true });
  const catalogQuery = useBillingCatalogQuery(snapshot?.id ?? null, { status: "active", pageSize: 100 });
  const createCheckoutSessionMutation = useCreateCheckoutSessionMutation(snapshot?.id ?? null);
  const pagedCommercialTasks = useMemo(() => flattenWorkItemPages(leadsQuery.data), [leadsQuery.data]);
  const pagedSignalTasks = useMemo(() => flattenWorkItemPages(signalsQuery.data), [signalsQuery.data]);
  const customers = useMemo(() => flattenCustomerPages(customersQuery.data), [customersQuery.data]);
  const documents = documentsQuery.data ?? [];
  const catalogItems = useMemo<ConnectCatalogItem[]>(
    () => (catalogQuery.data?.items ?? []).filter((item) => item.isActive),
    [catalogQuery.data?.items]
  );
  const leadPage = leadsQuery.data?.pages[0] ?? null;
  const signalPage = signalsQuery.data?.pages[0] ?? null;
  const customerPage = customersQuery.data?.pages[0] ?? null;

  const commercialTasks = useMemo(
    () => {
      if (pagedCommercialTasks.length > 0 || pagedSignalTasks.length > 0 || leadsQuery.data || signalsQuery.data) {
        return [...pagedSignalTasks, ...pagedCommercialTasks].sort((left, right) =>
          String(right.id).localeCompare(String(left.id))
        );
      }
      if (!leadMetadata) return [];
      const commercialTypeIds = new Set(leadMetadata.itemTypeIds);
      return (snapshot?.tasks ?? []).filter((task) => commercialTypeIds.has(task.type));
    },
    [leadMetadata, leadsQuery.data, pagedCommercialTasks, pagedSignalTasks, signalsQuery.data, snapshot?.tasks]
  );

  const statusLabelById = useMemo(
    () => new Map(boardStatuses.map((s) => [s.id, s.label])),
    [boardStatuses]
  );

  const commercialFieldDefinitions = snapshot?.boardConfig.fieldDefinitions ?? [];
  const buildCommercialCustomFieldValues = useCallback(
    (fields: Record<string, unknown>) => buildCustomFieldValuesBySlug(commercialFieldDefinitions, fields),
    [commercialFieldDefinitions]
  );

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const documentsById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const catalogItemsById = useMemo(() => new Map(catalogItems.map((item) => [item.id, item])), [catalogItems]);
  const resolveCatalogLabel = useCallback(
    (value: string) => catalogItemsById.get(value)?.name ?? value,
    [catalogItemsById]
  );

  const selectedTask = useMemo(
    () => commercialTasks.find((t) => t.id === selectedTaskId) ?? null,
    [commercialTasks, selectedTaskId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredTasks = commercialTasks;
  const filteredCustomers = customers;

  const pipelineMetrics = useMemo(
    () => buildPipelineMetrics(commercialTasks, customers, documents, leadMetadata),
    [commercialTasks, customers, documents, leadMetadata]
  );
  const funnelData = useMemo(() => buildFunnelData(commercialTasks, leadMetadata), [commercialTasks, leadMetadata]);
  const statusDistribution = useMemo(
    () => buildStatusDistribution(boardStatuses, commercialTasks),
    [boardStatuses, commercialTasks]
  );
  const sourceBreakdown = useMemo(() => buildSourceBreakdown(commercialTasks), [commercialTasks]);
  const pendingItems = useMemo(() => buildPendingItems(commercialTasks, documents, leadMetadata), [commercialTasks, documents, leadMetadata]);
  const filteredLeadMetrics = useMemo(() => buildFilteredLeadMetrics(filteredTasks, leadMetadata), [filteredTasks, leadMetadata]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setIsSubmitting(true);
    try {
      await action();
      toast.success(successMessage);
    } catch (e) {
      toast.error("Falha ao executar acao comercial.", {
        description: e instanceof Error ? e.message : "Tente novamente."
      });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const refreshCommercialQueries = useCallback(() => {
    if (!workspaceSlug) return;
    const refreshes = [
      queryClient.invalidateQueries({ queryKey: leadsQueryKeys.workspace(workspaceSlug) }),
      queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workspace(workspaceSlug) })
    ];

    if (snapshot?.id) {
      refreshes.push(queryClient.invalidateQueries({ queryKey: billingQueryKeys.workspace(snapshot.id) }));
    }

    void Promise.all(refreshes);
  }, [queryClient, snapshot?.id, workspaceSlug]);

  const openNewLeadModal = (customer?: Customer) => {
    if (!leadMetadata) {
      toast.error("Nao foi possivel criar lead.", {
        description: "Metadados comerciais do board nao configurados para criar leads."
      });
      return;
    }
    setLeadForm({ ...emptyLeadForm(), customerId: customer?.id ?? "", companyName: getCustomerDisplayName(customer) || "", contactEmail: customer?.email ?? "", contactPhone: customer?.phone ?? "" });
    setSelectedCustomerId(customer?.id ?? null);
    setSelectedTaskId(null);
    setModalMode("lead");
  };
  const openNewSignalModal = () => {
    if (!leadMetadata || !signalTypeId || !signalInitialStatusId) {
      toast.error("Nao foi possivel criar signal.", {
        description: "Metadados comerciais do board nao configurados para criar signals."
      });
      return;
    }
    setLeadForm(emptyLeadForm());
    setSelectedCustomerId(null);
    setSelectedTaskId(null);
    setModalMode("signal");
  };
  const openCustomerModal = () => { setCustomerForm(emptyCustomerForm()); setSelectedCustomerId(null); setSelectedTaskId(null); setModalMode("customer"); };
  const openCustomerFromLeadModal = (task: Task) => { setCustomerForm(buildCustomerInputFromLead(task)); setSelectedTaskId(task.id); setSelectedCustomerId(null); setModalMode("customer-from-lead"); };
  const openLinkCustomerModal = (task: Task) => { setSelectedTaskId(task.id); setLinkCustomerId(getTextField(task, "customerId")); setModalMode("link-customer"); };

  const resolveCustomerForLead = async (form: LeadFormState = leadForm) => {
    if (form.customerId) {
      return customersById.get(form.customerId) ?? null;
    }

    const companyName = form.companyName.trim();
    const contactName = form.contactName.trim();
    const email = form.contactEmail.trim().toLowerCase();
    const phone = form.contactPhone.replace(/\D/g, "");
    const name = companyName || contactName;

    const existing = customers.find((customer) => {
      const customerPhone = String(customer.phone ?? "").replace(/\D/g, "");
      return (
        (email.length > 0 && customer.email?.toLowerCase() === email) ||
        (phone.length > 0 && customerPhone === phone) ||
        (name.length > 0 && getCustomerDisplayName(customer).trim().toLowerCase() === name.toLowerCase())
      );
    });

    if (existing) {
      return existing;
    }

    if (!name) {
      return null;
    }

    const created = await createCustomerMutation.mutateAsync({
      name,
      tradeName: companyName || null,
      email: form.contactEmail.trim() || null,
      phone: form.contactPhone.trim() || null,
      status: "prospect",
      notes: form.notes.trim() || null
    });

    return created;
  };

  const createCommercialWorkItem = async (form: LeadFormState = leadForm, kind: "lead" | "signal" = "lead") => {
    const typeSlug = kind === "signal" ? signalTypeId : commercialTypeId;
    const stateSlug = kind === "signal" ? signalInitialStatusId : initialStatusId;
    if (!leadMetadata || !typeSlug || !stateSlug) {
      throw new Error(
        kind === "signal"
          ? "Metadados comerciais do board nao configurados para criar signals."
          : "Metadados comerciais do board nao configurados para criar leads."
      );
    }
    const companyNameInput = form.companyName.trim();
    const contactName = form.contactName.trim();
    const catalogItem = form.interest ? catalogItemsById.get(form.interest) ?? null : null;
    const catalogMetadata = catalogItem?.metadata ?? {};
    const titleBase = companyNameInput || contactName || catalogItem?.name;
    if (!titleBase) throw new Error("Informe empresa, contato ou interesse para criar o lead.");
    const customer = await resolveCustomerForLead(form);
    const companyName = companyNameInput || getCustomerDisplayName(customer);
    const estimatedValue = Number(form.estimatedValue.replace(",", "."));
    const catalogAmount = catalogItem ? catalogItem.amount / 100 : undefined;
    const fields = {
      customerId: customer?.id || undefined,
      clientName: getCustomerDisplayName(customer) || companyName || contactName,
      companyName: companyName || undefined,
      clientLegalName: customer?.legalName || customer?.tradeName || customer?.name || undefined,
      clientDocument: customer?.document || undefined,
      clientAddress: formatCustomerAddress(customer) || undefined,
      clientLogoUrl: customer?.logoUrl || undefined,
      contactName: contactName || undefined,
      contactEmail: form.contactEmail.trim() || customer?.email || undefined,
      contactPhone: form.contactPhone.trim() || customer?.phone || undefined,
      source: form.source.trim() || undefined,
      interest: catalogItem?.id || undefined,
      estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : catalogAmount,
      proposalValidity: form.proposalValidity || catalogMetadata.proposalValidity || undefined,
      paymentTerms: catalogMetadata.paymentTerms || undefined
    };
    const mutation = kind === "signal" ? createSignalMutation : createLeadMutation;
    await mutation.mutateAsync({
      typeSlug,
      title: titleBase,
      description: form.notes.trim() || catalogMetadata.scope || catalogItem?.description || catalogItem?.name || "",
      stateSlug,
      fields,
      customFieldValues: buildCommercialCustomFieldValues(fields)
    });
  };

  const buildCustomerFieldsForTask = (task: Task, customer: Customer) => ({
    ...task.customFields,
    customerId: customer.id,
    clientName: getCustomerDisplayName(customer),
    companyName: getTextField(task, "companyName") || getCustomerDisplayName(customer),
    clientLegalName: customer.legalName || customer.tradeName || customer.name,
    clientDocument: customer.document || getTextField(task, "clientDocument") || undefined,
    clientAddress: formatCustomerAddress(customer) || getTextField(task, "clientAddress") || undefined,
    clientLogoUrl: customer.logoUrl || getTextField(task, "clientLogoUrl") || undefined,
    contactEmail: getTextField(task, "contactEmail") || customer.email || undefined,
    contactPhone: getTextField(task, "contactPhone") || customer.phone || undefined
  });

  const createCustomerFromForm = async (nextCustomerForm = customerForm) => {
    const parsed = customerFormSchema.safeParse(nextCustomerForm);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Revise os dados do cliente.");
    }
    const address = parsed.data.address
      ? Object.fromEntries(
          Object.entries(parsed.data.address).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
        )
      : null;
    const customerInput = {
      ...parsed.data,
      address,
      sourceWorkItemId: modalMode === "customer-from-lead" ? selectedTask?.id ?? null : null
    };
    if (modalMode === "customer-from-lead" && selectedTask) {
      const nextFields = {
        ...selectedTask.customFields,
        converted: true,
        convertedAt: new Date().toISOString()
      };
      await convertLeadToCustomerMutation.mutateAsync({
        workItemId: selectedTask.id,
        customer: customerInput,
        fields: nextFields,
        customFieldValues: buildCommercialCustomFieldValues(nextFields)
      });
      return;
    }
    await createCustomerMutation.mutateAsync(customerInput);
  };

  const linkTaskToCustomer = async (task: Task, customer: Customer) => {
    const nextFields = buildCustomerFieldsForTask(task, customer);
    await updateLeadMutation.mutateAsync({
      workItemId: task.id,
      fields: nextFields,
      customFieldValues: buildCommercialCustomFieldValues(nextFields)
    });
  };

  const convertTaskToExistingCustomer = async (task: Task, customer: Customer) => {
    const nextFields = {
      ...buildCustomerFieldsForTask(task, customer),
      converted: true,
      convertedAt: new Date().toISOString()
    };
    await convertLeadToCustomerMutation.mutateAsync({
      workItemId: task.id,
      customerId: customer.id,
      fields: nextFields,
      customFieldValues: buildCommercialCustomFieldValues(nextFields)
    });
  };

  const hasLeadProposalOrContract = useCallback((task: Task) => {
    if (getTextField(task, "proposalId") || getTextField(task, "contractId")) {
      return true;
    }
    if (task.linkedDocuments?.some((document) => document.kind === "proposal" || document.kind === "contract")) {
      return true;
    }
    return documents.some((document) => {
      if (document.kind !== "proposal" && document.kind !== "contract") return false;
      if (document.linkedEntityType === "work_item" && document.linkedEntityId === task.id) return true;
      return document.metadata?.sourceWorkItemId === task.id;
    });
  }, [documents]);

  const createChargeFromLead = async (task: Task, justification?: string) => {
    const workspaceId = snapshot?.id;
    if (!workspaceId) throw new Error("Workspace nao carregado.");
    if (getTextField(task, "billingOrderId")) {
      throw new Error("Este lead ja tem uma cobranca vinculada.");
    }

    const customer = customersById.get(getTextField(task, "customerId")) ?? null;
    const catalogItem = catalogItemsById.get(getTextField(task, "interest")) ?? null;
    const amount = getNumberField(task, "estimatedValue");
    const customerEmail = getTextField(task, "contactEmail") || customer?.email || "";
    if (!customer && !customerEmail) {
      throw new Error("Vincule um cliente ou informe o email do contato antes de cobrar.");
    }
    if (!catalogItem && (!amount || amount <= 0)) {
      throw new Error("Informe um item de catalogo ou valor estimado para gerar a cobranca.");
    }
    const amountInCents = amount ? Math.round(amount * 100) : undefined;
    const hasProposalOrContract = hasLeadProposalOrContract(task);
    const billingJustification = String(justification ?? "").trim();
    if (!hasProposalOrContract && billingJustification.length < 12) {
      throw new Error("Informe uma justificativa formal para cobrar este lead sem proposta ou contrato.");
    }

    const response = await createCheckoutSessionMutation.mutateAsync({
      amount: catalogItem ? undefined : amountInCents,
      currency: "brl",
      description: catalogItem ? undefined : task.title,
      catalogItemId: catalogItem?.id,
      customerId: customer?.id,
      customerName: getCustomerDisplayName(customer) || getTextField(task, "clientName") || task.title,
      customerEmail: customerEmail || undefined,
      sourceWorkItemId: task.id,
      hasProposalOrContract,
      justification: billingJustification || undefined,
      sendEmail: true,
      successUrl: workspaceSlug.length > 0
        ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
        : undefined,
      cancelUrl: workspaceSlug.length > 0
        ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=cancel`
        : undefined,
      metadata: {
        sourceWorkItemId: task.id,
        sourceLeadTitle: task.title,
        ...(billingJustification ? { billingJustification } : {})
      }
    });
    const nextFields = {
      ...task.customFields,
      billingOrderId: response.orderId,
      billingStatus: "pending",
      billingCheckoutUrl: response.url
    };
    await updateLeadMutation.mutateAsync({
      workItemId: task.id,
      fields: nextFields,
      customFieldValues: buildCommercialCustomFieldValues(nextFields)
    });
  };

  const handleCreateCharge = (task: Task) => {
    if (!hasLeadProposalOrContract(task)) {
      setSelectedTaskId(task.id);
      setModalMode("billing-justification");
      return;
    }
    void runAction(
      async () => { await createChargeFromLead(task); },
      "Cobranca gerada e enviada para o email do lead."
    );
  };

  const resolveTransformationForTask = (task: Task): WorkItemTypeTransformationSummary | null => {
    const transformations = transformationsQuery.data ?? [];
    return transformations.find((entry) => entry.fromType.slug === task.type && entry.valid) ??
      transformations.find((entry) => entry.fromType.slug === task.type) ??
      null;
  };

  const executeTypeTransformation = async (
    task: Task,
    transformation: WorkItemTypeTransformationSummary,
    values?: Record<string, unknown>
  ) => {
    const defaultValuesForNewFields = buildTransformationDefaultValues(transformation, values);
    await transformWorkItemTypeMutation.mutateAsync({
      workItemId: task.id,
      transformationId: transformation.id,
      defaultValuesForNewFields,
      customFieldValues: defaultValuesForNewFields
    });
  };

  const handleTransformSignal = (task: Task) => {
    const transformation = resolveTransformationForTask(task);
    if (!transformation || !transformation.valid) {
      const missing = transformation?.missingFields.map((field) => field.name || field.slug).join(", ");
      toast.error("Nao foi possivel converter signal.", {
        description: missing
          ? `O tipo destino nao contem todos os campos necessarios para preservar os dados: ${missing}.`
          : "Nenhuma transformacao valida de Signal para Lead foi encontrada."
      });
      return;
    }

    const fieldsToFill = getFieldsRequiringTransformationInput(transformation);
    if (fieldsToFill.length > 0) {
      setSelectedTaskId(task.id);
      setModalMode("type-transformation");
      return;
    }

    void runAction(
      async () => { await executeTypeTransformation(task, transformation); },
      "Signal transformado em Lead."
    );
  };

  const submitTypeTransformation = async (
    task: Task,
    transformation: WorkItemTypeTransformationSummary,
    values: Record<string, unknown>
  ) => {
    if (!transformation.valid) {
      throw new Error(
        "O tipo destino nao contem todos os campos necessarios para preservar os dados."
      );
    }
    await executeTypeTransformation(task, transformation, values);
  };

  const topNavigation = (
    <LeadsTopNavigation
      tab={tab}
      isAuxLoading={documentsQuery.isFetching || catalogQuery.isFetching}
      isSubmitting={isSubmitting}
      onChangeTab={setTab}
      onRefresh={refreshCommercialQueries}
      onNewCustomer={openCustomerModal}
      onNewLead={() => openNewLeadModal()}
      onNewSignal={openNewSignalModal}
      canCreateLead={Boolean(leadMetadata)}
      canCreateSignal={Boolean(leadMetadata && signalTypeId && signalInitialStatusId)}
    />
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="leads-page" variant="dashboard" scroll="none">
        <LoadingState text="Carregando central comercial..." animation="leads" variant="frame" visible={(isLoading && !snapshot) || documentsQuery.isLoading || catalogQuery.isLoading || leadsQuery.isLoading || signalsQuery.isLoading || customersQuery.isLoading} />

        {leadsQuery.error instanceof Error ? <InlineAlert tone="danger">{leadsQuery.error.message}</InlineAlert> : null}
        {signalsQuery.error instanceof Error ? <InlineAlert tone="danger">{signalsQuery.error.message}</InlineAlert> : null}
        {customersQuery.error instanceof Error ? <InlineAlert tone="danger">{customersQuery.error.message}</InlineAlert> : null}
        {documentsQuery.error instanceof Error ? <InlineAlert tone="danger">{documentsQuery.error.message}</InlineAlert> : null}
        {catalogQuery.error instanceof Error ? <InlineAlert tone="danger">{catalogQuery.error.message}</InlineAlert> : null}
        {transformationsQuery.error instanceof Error ? <InlineAlert tone="danger">{transformationsQuery.error.message}</InlineAlert> : null}
        {!isLoading && snapshot && !leadMetadata ? (
          <InlineAlert tone="warning">Template comercial sem metadados operacionais de leads. Reaplique o template comercial antes de criar ou analisar oportunidades.</InlineAlert>
        ) : null}

        <div className="leads-page__content">
          <div className="leads-page__stack">
            {tab === "overview" ? (
              <LeadsOverviewSection
                pipelineMetrics={pipelineMetrics}
                funnelData={funnelData}
                statusDistribution={statusDistribution}
                sourceBreakdown={sourceBreakdown}
                pendingItems={pendingItems}
                commercialTasks={commercialTasks}
                customers={customers}
                customersById={customersById}
                boardStatuses={boardStatuses}
                statusLabelById={statusLabelById}
              />
            ) : null}

            {tab === "leads" ? (
              <LeadsListSection
                filteredTasks={filteredTasks}
                filteredLeadMetrics={filteredLeadMetrics}
                search={search}
                customersById={customersById}
                documentsById={documentsById}
                boardStatuses={boardStatuses}
                statusLabelById={statusLabelById}
                resolveCatalogLabel={resolveCatalogLabel}
                onSearchChange={setSearch}
                onOpenCustomerDetails={(customerId) => { setSelectedCustomerId(customerId); setModalMode("customer-detail"); }}
                onOpenCustomerFromLead={openCustomerFromLeadModal}
                onOpenLinkCustomer={openLinkCustomerModal}
                onOpenFlow={(task) => workspaceSlug && navigate(buildWorkspaceLeadFlowPath(workspaceSlug, task.id))}
                onCreateCharge={handleCreateCharge}
                onTransformSignal={handleTransformSignal}
                onOpenDocs={() => workspaceSlug && navigate(buildWorkspaceDocumentationPath(workspaceSlug))}
                onOpenBoard={() => workspaceSlug && navigate(buildWorkspaceBoardPath(workspaceSlug))}
                signalTypeIds={leadMetadata?.prospecting?.itemTypeIds ?? []}
                totalCount={(leadPage?.totalCount ?? leadPage?.total ?? 0) + (signalPage?.totalCount ?? signalPage?.total ?? 0) || filteredTasks.length}
                hasMore={Boolean(leadsQuery.hasNextPage || signalsQuery.hasNextPage)}
                isFetchingMore={leadsQuery.isFetchingNextPage || signalsQuery.isFetchingNextPage}
                onLoadMore={() => {
                  void Promise.all([
                    leadsQuery.hasNextPage ? leadsQuery.fetchNextPage() : Promise.resolve(),
                    signalsQuery.hasNextPage ? signalsQuery.fetchNextPage() : Promise.resolve()
                  ]);
                }}
              />
            ) : null}

            {tab === "customers" ? (
              <CustomersListSection
                filteredCustomers={filteredCustomers}
                commercialTasks={commercialTasks}
                search={search}
                pipelineMetrics={pipelineMetrics}
                onSearchChange={setSearch}
                onOpenCustomerDetails={(customerId) => { setSelectedCustomerId(customerId); setModalMode("customer-detail"); }}
                onNewLead={openNewLeadModal}
                totalCount={customerPage?.totalCount ?? customerPage?.total ?? filteredCustomers.length}
                hasMore={Boolean(customersQuery.hasNextPage)}
                isFetchingMore={customersQuery.isFetchingNextPage}
                onLoadMore={() => void customersQuery.fetchNextPage()}
              />
            ) : null}
          </div>
        </div>
      </WorkspaceFrame>

      {modalMode === "lead" || modalMode === "signal" ? (
        <LeadFormModal
          leadForm={leadForm}
          mode={modalMode}
          customers={customers}
          catalogItems={catalogItems}
          catalogItemsById={catalogItemsById}
          isSubmitting={isSubmitting}
          onChange={setLeadForm}
          onClose={() => setModalMode(null)}
          onSubmit={(values) => void runAction(async () => {
            const mode = modalMode;
            setLeadForm(values);
            await createCommercialWorkItem(values, mode);
            setModalMode(null);
            setTab("leads");
          }, modalMode === "signal" ? "Signal criado como WorkItem comercial." : "Lead criado como WorkItem comercial.")}
        />
      ) : null}

      {(modalMode === "customer" || modalMode === "customer-from-lead") ? (
        <AppDialog
          open
          title={modalMode === "customer-from-lead" ? "Criar cliente a partir do lead" : "Novo cliente"}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setModalMode(null);
          }}
          showClose={!isSubmitting}
          className="leads-page__modal"
          contentClassName="leads-page__modal-content"
          footer={
            <div className="leads-page__row-actions">
              <Button type="button" variant="outline" onClick={() => setModalMode(null)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" form="customer-form-modal-form" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Salvando cliente..." : "Salvar cliente"}
              </Button>
            </div>
          }
        >
          <CustomerForm
            id="customer-form-modal-form"
            value={customerForm}
            duplicates={findPossibleDuplicates(customers, customerForm)}
            disabled={isSubmitting}
            onChange={setCustomerForm}
            onSubmit={(value) => {
              void runAction(async () => { await createCustomerFromForm(value); setModalMode(null); setTab("customers"); }, modalMode === "customer-from-lead" ? "Cliente criado e vinculado ao WorkItem." : "Cliente criado com sucesso.");
            }}
            onLinkDuplicate={(customer) => {
              if (selectedTask) {
                void runAction(async () => {
                  if (modalMode === "customer-from-lead") {
                    await convertTaskToExistingCustomer(selectedTask, customer);
                  } else {
                    await linkTaskToCustomer(selectedTask, customer);
                  }
                  setModalMode(null);
                }, modalMode === "customer-from-lead" ? "Lead convertido e vinculado ao cliente existente." : "WorkItem vinculado ao cliente existente.");
              }
            }}
          />
        </AppDialog>
      ) : null}

      {modalMode === "link-customer" && selectedTask ? (
        <LinkCustomerModal
          customers={customers}
          linkCustomerId={linkCustomerId}
          isSubmitting={isSubmitting}
          onChange={setLinkCustomerId}
          onClose={() => setModalMode(null)}
          onSubmit={(nextCustomerId) => void runAction(async () => {
            if (!nextCustomerId) {
              const nextFields = { ...selectedTask.customFields, customerId: "" };
              await updateLeadMutation.mutateAsync({
                workItemId: selectedTask.id,
                fields: nextFields,
                customFieldValues: buildCommercialCustomFieldValues(nextFields)
              });
            } else {
              const customer = customersById.get(nextCustomerId);
              if (!customer) throw new Error("Cliente selecionado nao encontrado.");
              await linkTaskToCustomer(selectedTask, customer);
            }
            setModalMode(null);
          }, "Vinculo de cliente atualizado.")}
        />
      ) : null}

      {modalMode === "customer-detail" && selectedCustomer ? (
        <CustomerDetailModal
          customer={selectedCustomer}
          commercialTasks={commercialTasks}
          statusLabelById={statusLabelById}
          resolveCatalogLabel={resolveCatalogLabel}
          onClose={() => setModalMode(null)}
          onNewLead={openNewLeadModal}
        />
      ) : null}

      {modalMode === "billing-justification" && selectedTask ? (
        <BillingJustificationDialog
          leadId={selectedTask.id}
          leadTitle={selectedTask.title}
          isSubmitting={isSubmitting}
          onClose={() => setModalMode(null)}
          onSubmit={(justification) => void runAction(async () => {
            await createChargeFromLead(selectedTask, justification);
            setModalMode(null);
          }, "Cobranca gerada com justificativa formal.")}
        />
      ) : null}

      {modalMode === "type-transformation" && selectedTask && resolveTransformationForTask(selectedTask) ? (
        <WorkItemTypeTransformationDialog
          task={selectedTask}
          transformation={resolveTransformationForTask(selectedTask)!}
          isSubmitting={isSubmitting}
          onClose={() => setModalMode(null)}
          onSubmit={(values) => void runAction(async () => {
            const transformation = resolveTransformationForTask(selectedTask);
            if (!transformation) throw new Error("Transformacao nao encontrada.");
            await submitTypeTransformation(
              selectedTask,
              transformation,
              values.defaultValuesForNewFields ?? {}
            );
            setModalMode(null);
          }, "Signal transformado em Lead.")}
        />
      ) : null}
    </AppShell>
  );
}
