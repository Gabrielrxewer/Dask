import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { buildWorkspaceBoardPath, buildWorkspaceBoardPathWithTask, buildWorkspaceDocumentationPath } from "@/app/router";
import { buildBoardMetrics, type BoardCommercialOperationalMetadata, type Task } from "@/entities/task";
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
  commercialQueryKeys,
  useConvertWorkItemToCustomerMutation,
  useCreateCustomerMutation,
  useCustomersQuery,
  useCommercialTransformationsQuery,
  useCommercialWorkItemsQuery,
  useSignalsQuery,
  useTransformWorkItemTypeMutation,
  useUpdateCommercialWorkItemMutation
} from "@/modules/commercial";
import {
  useBillingCatalogQuery,
  useCreateCheckoutSessionMutation,
  billingQueryKeys,
  type ConnectCatalogItem
} from "@/modules/billing";
import { documentationQueryKeys, useDocumentsQuery } from "@/modules/documentation";
import { AppDialog, Button, InlineAlert, LoadingState, toast, WorkspaceFrame } from "@/shared/ui";
import { customerFormSchema } from "@/modules/commercial/model";
import { AppShell } from "@/widgets/app-shell";
import { BillingJustificationDialog } from "./billing-justification-dialog";
import { CommercialWorkItemDialog } from "./commercial-work-item-dialog";
import { CustomerDetailModal } from "./customer-detail-modal";
import { CustomerForm } from "./customer-form";
import { CustomersListSection } from "./customers-list-section";
import { CommercialListSection } from "./commercial-list-section";
import {
  buildTransformationDefaultValues,
  getFieldsRequiringTransformationInput,
  WorkItemTypeTransformationDialog
} from "./work-item-type-transformation-dialog";
import {
  buildCustomFieldValuesBySlug,
  buildCustomerInputFromWorkItem,
  buildFilteredCommercialMetrics,
  buildFunnelData,
  buildPendingItems,
  buildPipelineMetrics,
  buildSourceBreakdown,
  buildStatusDistribution,
  emptyCustomerForm,
  emptyCommercialWorkItemForm,
  findPossibleDuplicates,
  formatCustomerAddress,
  getNumberField,
  getTextField,
  type CommercialWorkItemFormState,
  type CommercialTab,
  type ModalMode
} from "./commercial-page.model";
import { CommercialOverviewSection } from "./commercial-overview-section";
import { CommercialTopNavigation } from "./commercial-top-navigation";
import { LinkCustomerModal } from "./link-customer-modal";
import "./commercial-page.css";

export function CommercialPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const queryClient = useQueryClient();
  const {
    snapshot,
    isLoading
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<CommercialTab>("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [commercialWorkItemForm, setCommercialWorkItemForm] = useState<CommercialWorkItemFormState>(() => emptyCommercialWorkItemForm());
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>(() => emptyCustomerForm());
  const [linkCustomerId, setLinkCustomerId] = useState("");

  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const commercialMetadata: BoardCommercialOperationalMetadata | null = snapshot?.boardConfig.operationalMetadata?.commercial ?? null;
  const commercialTypeId = commercialMetadata?.defaultItemTypeId ?? "";
  const signalTypeId = commercialMetadata?.prospecting?.itemTypeIds?.[0] ?? "";
  const initialStatusId = commercialMetadata?.initialStatusId ?? "";
  const signalInitialStatusId = commercialMetadata?.prospecting?.initialStatusId || initialStatusId;
  const deferredSearch = useDeferredValue(search);
  const documentsQuery = useDocumentsQuery(workspaceSlug || null, { limit: 200, sort: "updated_desc" });
  const workItemsQuery = useCommercialWorkItemsQuery(workspaceSlug || null, commercialTypeId || null, {
    search: tab === "commercial" ? deferredSearch : "",
    limit: 50,
    sort: "updated_desc"
  });
  const signalsQuery = useSignalsQuery(workspaceSlug || null, signalTypeId || null, {
    search: tab === "commercial" ? deferredSearch : "",
    limit: 30,
    sort: "updated_desc"
  });
  const customersQuery = useCustomersQuery(workspaceSlug || null, {
    search: tab === "customers" ? deferredSearch : "",
    limit: 80
  });
  const transformationsQuery = useCommercialTransformationsQuery(workspaceSlug || null);
  const updateWorkItemMutation = useUpdateCommercialWorkItemMutation(workspaceSlug || null, { silent: true });
  const createCustomerMutation = useCreateCustomerMutation(workspaceSlug || null, { silent: true });
  const transformWorkItemTypeMutation = useTransformWorkItemTypeMutation(workspaceSlug || null, { silent: true });
  const convertWorkItemToCustomerMutation = useConvertWorkItemToCustomerMutation(workspaceSlug || null, { silent: true });
  const catalogQuery = useBillingCatalogQuery(snapshot?.id ?? null, { status: "active", pageSize: 100 });
  const createCheckoutSessionMutation = useCreateCheckoutSessionMutation(snapshot?.id ?? null);
  const pagedCommercialTasks = useMemo(() => flattenWorkItemPages(workItemsQuery.data), [workItemsQuery.data]);
  const pagedSignalTasks = useMemo(() => flattenWorkItemPages(signalsQuery.data), [signalsQuery.data]);
  const customers = useMemo(() => flattenCustomerPages(customersQuery.data), [customersQuery.data]);
  const documents = documentsQuery.data ?? [];
  const catalogItems = useMemo<ConnectCatalogItem[]>(
    () => (catalogQuery.data?.items ?? []).filter((item) => item.isActive),
    [catalogQuery.data?.items]
  );
  const workItemPage = workItemsQuery.data?.pages[0] ?? null;
  const signalPage = signalsQuery.data?.pages[0] ?? null;
  const customerPage = customersQuery.data?.pages[0] ?? null;

  const commercialTasks = useMemo(
    () => {
      if (pagedCommercialTasks.length > 0 || pagedSignalTasks.length > 0 || workItemsQuery.data || signalsQuery.data) {
        return [...pagedSignalTasks, ...pagedCommercialTasks].sort((left, right) =>
          String(right.id).localeCompare(String(left.id))
        );
      }
      if (!commercialMetadata) return [];
      const commercialTypeIds = new Set(commercialMetadata.itemTypeIds);
      return (snapshot?.tasks ?? []).filter((task) => commercialTypeIds.has(task.type));
    },
    [commercialMetadata, workItemsQuery.data, pagedCommercialTasks, pagedSignalTasks, signalsQuery.data, snapshot?.tasks]
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
    () => buildPipelineMetrics(commercialTasks, customers, documents, commercialMetadata),
    [commercialTasks, customers, documents, commercialMetadata]
  );
  const funnelData = useMemo(() => buildFunnelData(commercialTasks, commercialMetadata), [commercialTasks, commercialMetadata]);
  const statusDistribution = useMemo(
    () => buildStatusDistribution(boardStatuses, commercialTasks),
    [boardStatuses, commercialTasks]
  );
  const sourceBreakdown = useMemo(() => buildSourceBreakdown(commercialTasks), [commercialTasks]);
  const pendingItems = useMemo(() => buildPendingItems(commercialTasks, documents, commercialMetadata), [commercialTasks, documents, commercialMetadata]);
  const filteredWorkItemMetrics = useMemo(() => buildFilteredCommercialMetrics(filteredTasks, commercialMetadata), [filteredTasks, commercialMetadata]);

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
      queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workspace(workspaceSlug) }),
      queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workspace(workspaceSlug) })
    ];

    if (snapshot?.id) {
      refreshes.push(queryClient.invalidateQueries({ queryKey: billingQueryKeys.workspace(snapshot.id) }));
    }

    void Promise.all(refreshes);
  }, [queryClient, snapshot?.id, workspaceSlug]);

  const openNewCommercialWorkItemModal = (customer?: Customer) => {
    if (!commercialMetadata) {
      toast.error("Nao foi possivel criar WorkItem comercial.", {
        description: "Metadados comerciais do board nao configurados para criar WorkItems comerciais."
      });
      return;
    }
    setCommercialWorkItemForm({
      ...emptyCommercialWorkItemForm(),
      customerId: customer?.id ?? "",
      companyName: getCustomerDisplayName(customer) || "",
      contactEmail: customer?.email ?? "",
      contactPhone: customer?.phone ?? ""
    });
    setSelectedCustomerId(customer?.id ?? null);
    setSelectedTaskId(null);
    setModalMode("workItem");
  };
  const openNewSignalModal = () => {
    if (!commercialMetadata || !signalTypeId || !signalInitialStatusId) {
      toast.error("Nao foi possivel criar signal.", {
        description: "Metadados comerciais do board nao configurados para criar signals."
      });
      return;
    }
    setCommercialWorkItemForm(emptyCommercialWorkItemForm());
    setSelectedCustomerId(null);
    setSelectedTaskId(null);
    setModalMode("signal");
  };
  const openCustomerModal = () => { setCustomerForm(emptyCustomerForm()); setSelectedCustomerId(null); setSelectedTaskId(null); setModalMode("customer"); };
  const openCustomerFromWorkItemModal = (task: Task) => { setCustomerForm(buildCustomerInputFromWorkItem(task)); setSelectedTaskId(task.id); setSelectedCustomerId(null); setModalMode("customer-from-workItem"); };
  const openLinkCustomerModal = (task: Task) => { setSelectedTaskId(task.id); setLinkCustomerId(getTextField(task, "customerId")); setModalMode("link-customer"); };

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
      sourceWorkItemId: modalMode === "customer-from-workItem" ? selectedTask?.id ?? null : null
    };
    if (modalMode === "customer-from-workItem" && selectedTask) {
      const nextFields = {
        ...selectedTask.customFields,
        converted: true,
        convertedAt: new Date().toISOString()
      };
      await convertWorkItemToCustomerMutation.mutateAsync({
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
    await updateWorkItemMutation.mutateAsync({
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
    await convertWorkItemToCustomerMutation.mutateAsync({
      workItemId: task.id,
      customerId: customer.id,
      fields: nextFields,
      customFieldValues: buildCommercialCustomFieldValues(nextFields)
    });
  };

  const hasCommercialProposalOrContract = useCallback((task: Task) => {
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

  const createChargeFromWorkItem = async (task: Task, justification?: string) => {
    const workspaceId = snapshot?.id;
    if (!workspaceId) throw new Error("Workspace nao carregado.");
    if (getTextField(task, "billingOrderId")) {
      throw new Error("Este workItem ja tem uma cobranca vinculada.");
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
    const hasProposalOrContract = hasCommercialProposalOrContract(task);
    const billingJustification = String(justification ?? "").trim();
    if (!hasProposalOrContract && billingJustification.length < 12) {
      throw new Error("Informe uma justificativa formal para cobrar este workItem sem proposta ou contrato.");
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
        sourceWorkItemTitle: task.title,
        ...(billingJustification ? { billingJustification } : {})
      }
    });
    const nextFields = {
      ...task.customFields,
      billingOrderId: response.orderId,
      billingStatus: "pending",
      billingCheckoutUrl: response.url
    };
    await updateWorkItemMutation.mutateAsync({
      workItemId: task.id,
      fields: nextFields,
      customFieldValues: buildCommercialCustomFieldValues(nextFields)
    });
  };

  const handleCreateCharge = (task: Task) => {
    if (!hasCommercialProposalOrContract(task)) {
      setSelectedTaskId(task.id);
      setModalMode("billing-justification");
      return;
    }
    void runAction(
      async () => { await createChargeFromWorkItem(task); },
      "Cobranca gerada e enviada para o email do workItem."
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
      toast.error("Nao foi possivel transformar Prospect em Lead.", {
        description: missing
          ? `O tipo destino nao contem todos os campos necessarios para preservar os dados: ${missing}.`
          : "Nenhuma transformacao valida de Prospect para Lead foi encontrada."
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
      async () => {
        await executeTypeTransformation(task, transformation);
        setTab("commercial");
      },
      "Prospect transformado em Lead"
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
    <CommercialTopNavigation
      tab={tab}
      isAuxLoading={documentsQuery.isFetching || catalogQuery.isFetching}
      isSubmitting={isSubmitting}
      onChangeTab={setTab}
      onRefresh={refreshCommercialQueries}
      onNewCustomer={openCustomerModal}
      onNewCommercialWorkItem={() => openNewCommercialWorkItemModal()}
      onNewSignal={openNewSignalModal}
      canCreateCommercialWorkItem={Boolean(commercialMetadata)}
      canCreateSignal={Boolean(commercialMetadata && signalTypeId && signalInitialStatusId)}
    />
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="commercial-page" variant="dashboard" scroll="none">
        <LoadingState text="Carregando central comercial..." animation="commercial" variant="frame" visible={(isLoading && !snapshot) || documentsQuery.isLoading || catalogQuery.isLoading || workItemsQuery.isLoading || signalsQuery.isLoading || customersQuery.isLoading} />

        {workItemsQuery.error instanceof Error ? <InlineAlert tone="danger">{workItemsQuery.error.message}</InlineAlert> : null}
        {signalsQuery.error instanceof Error ? <InlineAlert tone="danger">{signalsQuery.error.message}</InlineAlert> : null}
        {customersQuery.error instanceof Error ? <InlineAlert tone="danger">{customersQuery.error.message}</InlineAlert> : null}
        {documentsQuery.error instanceof Error ? <InlineAlert tone="danger">{documentsQuery.error.message}</InlineAlert> : null}
        {catalogQuery.error instanceof Error ? <InlineAlert tone="danger">{catalogQuery.error.message}</InlineAlert> : null}
        {transformationsQuery.error instanceof Error ? <InlineAlert tone="danger">{transformationsQuery.error.message}</InlineAlert> : null}
        {!isLoading && snapshot && !commercialMetadata ? (
          <InlineAlert tone="warning">Template comercial sem metadados operacionais de commercial. Reaplique o template comercial antes de criar ou analisar oportunidades.</InlineAlert>
        ) : null}

        <div className="commercial-page__content">
          <div className="commercial-page__stack">
            {tab === "overview" ? (
              <CommercialOverviewSection
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

            {tab === "commercial" ? (
              <CommercialListSection
                filteredTasks={filteredTasks}
                filteredWorkItemMetrics={filteredWorkItemMetrics}
                search={search}
                customersById={customersById}
                documentsById={documentsById}
                boardStatuses={boardStatuses}
                statusLabelById={statusLabelById}
                resolveCatalogLabel={resolveCatalogLabel}
                onSearchChange={setSearch}
                onOpenCustomerDetails={(customerId) => { setSelectedCustomerId(customerId); setModalMode("customer-detail"); }}
                onOpenCustomerFromWorkItem={openCustomerFromWorkItemModal}
                onOpenLinkCustomer={openLinkCustomerModal}
                onOpenFlow={(task) => workspaceSlug && navigate(buildWorkspaceBoardPathWithTask(workspaceSlug, task.id, "commercial"))}
                onCreateCharge={handleCreateCharge}
                onTransformSignal={handleTransformSignal}
                onOpenDocs={() => workspaceSlug && navigate(buildWorkspaceDocumentationPath(workspaceSlug))}
                onOpenBoard={() => workspaceSlug && navigate(buildWorkspaceBoardPath(workspaceSlug))}
                signalTypeIds={commercialMetadata?.prospecting?.itemTypeIds ?? []}
                totalCount={(workItemPage?.totalCount ?? workItemPage?.total ?? 0) + (signalPage?.totalCount ?? signalPage?.total ?? 0) || filteredTasks.length}
                hasMore={Boolean(workItemsQuery.hasNextPage || signalsQuery.hasNextPage)}
                isFetchingMore={workItemsQuery.isFetchingNextPage || signalsQuery.isFetchingNextPage}
                onLoadMore={() => {
                  void Promise.all([
                    workItemsQuery.hasNextPage ? workItemsQuery.fetchNextPage() : Promise.resolve(),
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
                onNewCommercialWorkItem={openNewCommercialWorkItemModal}
                totalCount={customerPage?.totalCount ?? customerPage?.total ?? filteredCustomers.length}
                hasMore={Boolean(customersQuery.hasNextPage)}
                isFetchingMore={customersQuery.isFetchingNextPage}
                onLoadMore={() => void customersQuery.fetchNextPage()}
              />
            ) : null}
          </div>
        </div>
      </WorkspaceFrame>

      {modalMode === "workItem" || modalMode === "signal" ? (
        <CommercialWorkItemDialog
          open
          mode={modalMode}
          workspaceId={workspaceSlug || null}
          defaultValues={commercialWorkItemForm}
          customers={customers}
          catalogItems={catalogItems}
          catalogItemsById={catalogItemsById}
          fieldDefinitions={commercialFieldDefinitions}
          commercialTypeId={commercialTypeId}
          signalTypeId={signalTypeId}
          initialStatusId={initialStatusId}
          signalInitialStatusId={signalInitialStatusId}
          onOpenChange={(open) => {
            if (!open) setModalMode(null);
          }}
          onCreated={() => setTab("commercial")}
        />
      ) : null}

      {(modalMode === "customer" || modalMode === "customer-from-workItem") ? (
        <AppDialog
          open
          title={modalMode === "customer-from-workItem" ? "Criar cliente a partir do workItem" : "Novo cliente"}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setModalMode(null);
          }}
          showClose={!isSubmitting}
          className="commercial-page__modal"
          contentClassName="commercial-page__modal-content"
          footer={
            <div className="commercial-page__row-actions">
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
              void runAction(async () => { await createCustomerFromForm(value); setModalMode(null); setTab("customers"); }, modalMode === "customer-from-workItem" ? "Cliente criado e vinculado ao WorkItem." : "Cliente criado com sucesso.");
            }}
            onLinkDuplicate={(customer) => {
              if (selectedTask) {
                void runAction(async () => {
                  if (modalMode === "customer-from-workItem") {
                    await convertTaskToExistingCustomer(selectedTask, customer);
                  } else {
                    await linkTaskToCustomer(selectedTask, customer);
                  }
                  setModalMode(null);
                }, modalMode === "customer-from-workItem" ? "WorkItem convertido e vinculado ao cliente existente." : "WorkItem vinculado ao cliente existente.");
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
              await updateWorkItemMutation.mutateAsync({
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
          onNewCommercialWorkItem={openNewCommercialWorkItemModal}
        />
      ) : null}

      {modalMode === "billing-justification" && selectedTask ? (
        <BillingJustificationDialog
          workItemId={selectedTask.id}
          workItemTitle={selectedTask.title}
          isSubmitting={isSubmitting}
          onClose={() => setModalMode(null)}
          onSubmit={(justification) => void runAction(async () => {
            await createChargeFromWorkItem(selectedTask, justification);
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
            setTab("commercial");
          }, "Prospect transformado em Lead")}
        />
      ) : null}
    </AppShell>
  );
}
