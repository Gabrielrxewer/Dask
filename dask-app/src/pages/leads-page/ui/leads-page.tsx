import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { buildWorkspaceBoardPath, buildWorkspaceDocumentationPath, buildWorkspaceLeadFlowPath } from "@/app/router";
import { buildBoardMetrics, type BoardLeadOperationalMetadata, type Task } from "@/entities/task";
import {
  getCustomerDisplayName,
  useWorkspace,
  type Customer,
  type CreateCustomerInput,
  type WorkspaceDocument
} from "@/modules/workspace";
import { billingService, type ConnectCatalogItem } from "@/modules/billing";
import { FormModal, InlineAlert, LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { CustomerDetailModal } from "./customer-detail-modal";
import { CustomerForm } from "./customer-form";
import { CustomersListSection } from "./customers-list-section";
import { LeadFormModal } from "./lead-form-modal";
import { LeadsListSection } from "./leads-list-section";
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
  const {
    snapshot,
    isLoading,
    createTask,
    updateTask,
    listCustomers,
    createCustomer,
    listWorkspaceDocuments
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<LeadsTab>("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [catalogItems, setCatalogItems] = useState<ConnectCatalogItem[]>([]);
  const [isAuxLoading, setIsAuxLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(() => emptyLeadForm());
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>(() => emptyCustomerForm());
  const [linkCustomerId, setLinkCustomerId] = useState("");

  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const leadMetadata: BoardLeadOperationalMetadata | null = snapshot?.boardConfig.operationalMetadata?.leads ?? null;
  const commercialTypeId = leadMetadata?.defaultItemTypeId ?? "";
  const initialStatusId = leadMetadata?.initialStatusId ?? "";

  const commercialTasks = useMemo(
    () => {
      if (!leadMetadata) return [];
      const commercialTypeIds = new Set(leadMetadata.itemTypeIds);
      return (snapshot?.tasks ?? []).filter((task) => commercialTypeIds.has(task.type));
    },
    [leadMetadata, snapshot?.tasks]
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
  const selectedCatalogItem = leadForm.interest ? catalogItemsById.get(leadForm.interest) ?? null : null;
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

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return commercialTasks;
    return commercialTasks.filter((task) => {
      const customer = customersById.get(getTextField(task, "customerId"));
      return [
        task.title, task.text,
        getTextField(task, "companyName"), getTextField(task, "clientName"),
        getTextField(task, "contactName"), getTextField(task, "contactEmail"),
        getTextField(task, "source"), resolveCatalogLabel(getTextField(task, "interest")),
        customer?.name
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
    });
  }, [commercialTasks, customersById, resolveCatalogLabel, search]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) =>
      [c.name, c.tradeName, c.legalName, c.document, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query))
    );
  }, [customers, search]);

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

  const loadAuxData = useCallback(async () => {
    setIsAuxLoading(true);
    setError("");
    try {
      const workspaceId = snapshot?.id;
      const [nextCustomers, nextDocuments, catalogResponse] = await Promise.all([
        listCustomers(),
        listWorkspaceDocuments(),
        workspaceId ? billingService.listConnectCatalogItems(workspaceId, false) : Promise.resolve({ items: [] })
      ]);
      setCustomers(nextCustomers);
      setDocuments(nextDocuments);
      setCatalogItems(catalogResponse.items.filter((item) => item.isActive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados comerciais.");
    } finally {
      setIsAuxLoading(false);
    }
  }, [listCustomers, listWorkspaceDocuments, snapshot?.id]);

  useEffect(() => { void loadAuxData(); }, [loadAuxData]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      await loadAuxData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar ação comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadAuxData]);

  const openNewLeadModal = (customer?: Customer) => {
    if (!leadMetadata) {
      setError("Metadados comerciais do board nao configurados para criar leads.");
      return;
    }
    setLeadForm({ ...emptyLeadForm(), customerId: customer?.id ?? "", companyName: getCustomerDisplayName(customer) || "", contactEmail: customer?.email ?? "", contactPhone: customer?.phone ?? "" });
    setSelectedCustomerId(customer?.id ?? null);
    setSelectedTaskId(null);
    setModalMode("lead");
  };
  const openCustomerModal = () => { setCustomerForm(emptyCustomerForm()); setSelectedCustomerId(null); setSelectedTaskId(null); setModalMode("customer"); };
  const openCustomerFromLeadModal = (task: Task) => { setCustomerForm(buildCustomerInputFromLead(task)); setSelectedTaskId(task.id); setSelectedCustomerId(null); setModalMode("customer-from-lead"); };
  const openLinkCustomerModal = (task: Task) => { setSelectedTaskId(task.id); setLinkCustomerId(getTextField(task, "customerId")); setModalMode("link-customer"); };

  const resolveCustomerForLead = async () => {
    if (leadForm.customerId) {
      return customersById.get(leadForm.customerId) ?? null;
    }

    const companyName = leadForm.companyName.trim();
    const contactName = leadForm.contactName.trim();
    const email = leadForm.contactEmail.trim().toLowerCase();
    const phone = leadForm.contactPhone.replace(/\D/g, "");
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

    const created = await createCustomer({
      name,
      tradeName: companyName || null,
      email: leadForm.contactEmail.trim() || null,
      phone: leadForm.contactPhone.trim() || null,
      status: "prospect",
      notes: leadForm.notes.trim() || null
    });

    setCustomers((current) => [created, ...current.filter((customer) => customer.id !== created.id)]);
    return created;
  };

  const createLeadWorkItem = async () => {
    if (!leadMetadata || !commercialTypeId || !initialStatusId) {
      throw new Error("Metadados comerciais do board nao configurados para criar leads.");
    }
    const companyNameInput = leadForm.companyName.trim();
    const contactName = leadForm.contactName.trim();
    const catalogItem = selectedCatalogItem;
    const catalogMetadata = catalogItem?.metadata ?? {};
    const titleBase = companyNameInput || contactName || catalogItem?.name;
    if (!titleBase) throw new Error("Informe empresa, contato ou interesse para criar o lead.");
    const customer = await resolveCustomerForLead();
    const companyName = companyNameInput || getCustomerDisplayName(customer);
    const estimatedValue = Number(leadForm.estimatedValue.replace(",", "."));
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
      contactEmail: leadForm.contactEmail.trim() || customer?.email || undefined,
      contactPhone: leadForm.contactPhone.trim() || customer?.phone || undefined,
      source: leadForm.source.trim() || undefined,
      interest: catalogItem?.id || undefined,
      estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : catalogAmount,
      proposalValidity: leadForm.proposalValidity || catalogMetadata.proposalValidity || undefined,
      paymentTerms: catalogMetadata.paymentTerms || undefined
    };
    await createTask({
      type: commercialTypeId,
      title: titleBase,
      description: leadForm.notes.trim() || catalogMetadata.scope || catalogItem?.description || catalogItem?.name || "",
      priority: 2,
      statusId: initialStatusId,
      fields,
      customFieldValues: buildCommercialCustomFieldValues(fields)
    });
  };

  const createCustomerFromForm = async () => {
    if (!customerForm.name?.trim()) throw new Error("Informe o nome do cliente.");
    const created = await createCustomer({ ...customerForm, sourceWorkItemId: modalMode === "customer-from-lead" ? selectedTask?.id ?? null : null });
    if (modalMode === "customer-from-lead" && selectedTask) await linkTaskToCustomer(selectedTask, created);
  };

  const linkTaskToCustomer = async (task: Task, customer: Customer) => {
    const nextFields = {
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
    };
    await updateTask(task.id, { fields: nextFields, customFieldValues: buildCommercialCustomFieldValues(nextFields) });
  };

  const createChargeFromLead = async (task: Task) => {
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

    const response = await billingService.createConnectCheckoutSession(workspaceId, {
      amount: catalogItem ? undefined : amountInCents,
      currency: "brl",
      description: catalogItem ? undefined : task.title,
      catalogItemId: catalogItem?.id,
      customerId: customer?.id,
      customerName: getCustomerDisplayName(customer) || getTextField(task, "clientName") || task.title,
      customerEmail: customerEmail || undefined,
      sendEmail: true,
      successUrl: workspaceSlug.length > 0
        ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
        : undefined,
      cancelUrl: workspaceSlug.length > 0
        ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=cancel`
        : undefined,
      metadata: {
        sourceWorkItemId: task.id,
        sourceLeadTitle: task.title
      }
    });
    const nextFields = {
      ...task.customFields,
      billingOrderId: response.orderId,
      billingStatus: "pending",
      billingCheckoutUrl: response.url
    };
    await updateTask(task.id, { fields: nextFields, customFieldValues: buildCommercialCustomFieldValues(nextFields) });
  };

  const topNavigation = (
    <LeadsTopNavigation
      tab={tab}
      isAuxLoading={isAuxLoading}
      isSubmitting={isSubmitting}
      onChangeTab={setTab}
      onRefresh={() => void loadAuxData()}
      onNewCustomer={openCustomerModal}
      onNewLead={() => openNewLeadModal()}
      canCreateLead={Boolean(leadMetadata)}
    />
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="leads-page" variant="dashboard" scroll="none">
        <LoadingState text="Carregando central comercial..." animation="leads" variant="frame" visible={(isLoading && !snapshot) || isAuxLoading} />

        {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
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
                onCreateCharge={(task) => void runAction(
                  async () => { await createChargeFromLead(task); },
                  "Cobranca gerada e enviada para o email do lead."
                )}
                onOpenDocs={() => workspaceSlug && navigate(buildWorkspaceDocumentationPath(workspaceSlug))}
                onOpenBoard={() => workspaceSlug && navigate(buildWorkspaceBoardPath(workspaceSlug))}
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
              />
            ) : null}
          </div>
        </div>
      </WorkspaceFrame>

      {modalMode === "lead" ? (
        <LeadFormModal
          leadForm={leadForm}
          customers={customers}
          catalogItems={catalogItems}
          catalogItemsById={catalogItemsById}
          isSubmitting={isSubmitting}
          onChange={setLeadForm}
          onClose={() => setModalMode(null)}
          onSubmit={() => void runAction(async () => { await createLeadWorkItem(); setModalMode(null); setTab("leads"); }, "Lead criado como WorkItem comercial.")}
        />
      ) : null}

      {(modalMode === "customer" || modalMode === "customer-from-lead") ? (
        <FormModal
          titleId="customer-form-modal"
          title={modalMode === "customer-from-lead" ? "Criar cliente a partir do lead" : "Novo cliente"}
          onClose={() => setModalMode(null)}
          onSubmit={() => void runAction(async () => { await createCustomerFromForm(); setModalMode(null); setTab("customers"); }, modalMode === "customer-from-lead" ? "Cliente criado e vinculado ao WorkItem." : "Cliente criado com sucesso.")}
          submitLabel="Salvar cliente"
          submittingLabel="Salvando cliente..."
          isSubmitting={isSubmitting}
          className="leads-page__modal"
          headerClassName="leads-page__modal-header"
          titleWrapperClassName="leads-page__modal-title"
          contentClassName="leads-page__modal-content"
          footerClassName="leads-page__row-actions"
          errorClassName="leads-page__modal-error"
        >
          <CustomerForm
            value={customerForm}
            duplicates={findPossibleDuplicates(customers, customerForm)}
            onChange={setCustomerForm}
            onLinkDuplicate={(customer) => {
              if (selectedTask) {
                void runAction(async () => { await linkTaskToCustomer(selectedTask, customer); setModalMode(null); }, "WorkItem vinculado ao cliente existente.");
              }
            }}
          />
        </FormModal>
      ) : null}

      {modalMode === "link-customer" && selectedTask ? (
        <LinkCustomerModal
          customers={customers}
          linkCustomerId={linkCustomerId}
          isSubmitting={isSubmitting}
          onChange={setLinkCustomerId}
          onClose={() => setModalMode(null)}
          onSubmit={() => void runAction(async () => {
            if (!linkCustomerId) {
              const nextFields = { ...selectedTask.customFields, customerId: "" };
              await updateTask(selectedTask.id, { fields: nextFields, customFieldValues: buildCommercialCustomFieldValues(nextFields) });
            } else {
              const customer = customersById.get(linkCustomerId);
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
    </AppShell>
  );
}
