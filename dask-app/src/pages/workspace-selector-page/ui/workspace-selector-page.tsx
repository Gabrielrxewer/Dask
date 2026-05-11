import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath } from "@/app/router";
import { useBillingStatusQuery } from "@/modules/billing";
import {
  useDeleteWorkspaceMutation,
  useProvisionWorkspaceWithProfileMutation,
  useWorkspaceListQuery,
  useWorkspaceTemplatesQuery,
  type WorkspaceSummary
} from "@/modules/workspace";
import { AppDialog, AppSelect, Button, Card, FormField, Textarea, TextInput, toast } from "@/shared/ui";
import {
  EMPTY_TEMPLATE_VALUE,
  emptyWorkspaceCreateFormValues,
  makeWorkspaceKeyDraft,
  toProvisionWorkspaceMutationInput,
  workspaceCreateFormSchema,
  workspaceKindOptions,
  type WorkspaceCreateFormValues,
  type WorkspaceSelectorView
} from "./workspace-selector-page.model";
import "../../no-workspace-page/ui/no-workspace-page.css";
import "./workspace-selector-page.css";

function fieldError(message: unknown) {
  return typeof message === "string" ? <span className="workspace-selector-page__field-error">{message}</span> : null;
}

export function WorkspaceSelectorPage() {
  const navigate = useNavigate();
  const billingStatusQuery = useBillingStatusQuery();
  const workspacesQuery = useWorkspaceListQuery();
  const canCreateWorkspace = billingStatusQuery.data?.canCreateWorkspace ?? false;
  const templatesQuery = useWorkspaceTemplatesQuery({ enabled: canCreateWorkspace });
  const createWorkspaceMutation = useProvisionWorkspaceWithProfileMutation();
  const deleteWorkspaceMutation = useDeleteWorkspaceMutation();
  const [view, setView] = useState<WorkspaceSelectorView>("select");
  const [query, setQuery] = useState("");
  const [isWorkspaceKeyDirty, setIsWorkspaceKeyDirty] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState<WorkspaceSummary | null>(null);

  const form = useForm<WorkspaceCreateFormValues>({
    resolver: zodResolver(workspaceCreateFormSchema) as Resolver<WorkspaceCreateFormValues>,
    defaultValues: emptyWorkspaceCreateFormValues,
    mode: "onBlur"
  });

  const workspaceName = form.watch("workspaceName");
  const templateKey = form.watch("templateKey");
  const availableTemplates = templatesQuery.data ?? [];
  const firstTemplateKey = availableTemplates[0]?.key;
  const workspaces = workspacesQuery.data ?? [];
  const isCreateView = view === "create";
  const isCreating = createWorkspaceMutation.isPending;
  const isDeletingWorkspace = deleteWorkspaceMutation.isPending;
  const deleteConfirmationMatches = workspacePendingDelete
    ? deleteConfirmation.trim() === workspacePendingDelete.name
    : false;

  useEffect(() => {
    if (isWorkspaceKeyDirty) {
      return;
    }

    form.setValue("workspaceKey", makeWorkspaceKeyDraft(workspaceName), { shouldValidate: true });
  }, [form, isWorkspaceKeyDirty, workspaceName]);

  useEffect(() => {
    if (!canCreateWorkspace) {
      form.setValue("templateKey", "", { shouldValidate: true });
      return;
    }

    const currentTemplateKey = form.getValues("templateKey");
    if (!currentTemplateKey && firstTemplateKey) {
      form.setValue("templateKey", firstTemplateKey, { shouldValidate: true });
    }
  }, [canCreateWorkspace, firstTemplateKey, form]);

  useEffect(() => {
    if (isCreateView && templatesQuery.isError) {
      toast.error("Nao foi possivel carregar o catalogo de templates.");
    }
  }, [isCreateView, templatesQuery.isError]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return workspaces;
    }

    return workspaces.filter((workspace) => {
      return (
        workspace.name.toLowerCase().includes(value) ||
        workspace.slug.toLowerCase().includes(value) ||
        workspace.key.toLowerCase().includes(value)
      );
    });
  }, [query, workspaces]);

  const templateItems = useMemo(() => {
    const emptyLabel = templatesQuery.isLoading ? "Carregando templates..." : "Catalogo indisponivel";

    return [
      { value: EMPTY_TEMPLATE_VALUE, label: emptyLabel, disabled: true },
      ...availableTemplates.map((template) => ({
        value: template.key,
        label: template.name,
        description: template.description
      }))
    ];
  }, [availableTemplates, templatesQuery.isLoading]);

  const handleOpenDeleteWorkspace = (workspace: WorkspaceSummary) => {
    setWorkspacePendingDelete(workspace);
    setDeleteConfirmation("");
    setDeleteError(null);
  };

  const handleCloseDeleteWorkspace = () => {
    if (isDeletingWorkspace) {
      return;
    }

    setWorkspacePendingDelete(null);
    setDeleteConfirmation("");
    setDeleteError(null);
  };

  const handleOpenCreate = () => {
    setView("create");
    setDeleteError(null);
  };

  const handleBackToSelection = () => {
    if (isCreating) {
      return;
    }

    setView("select");
    form.clearErrors();
  };

  const handleCreateWorkspace = async (values: WorkspaceCreateFormValues) => {
    setDeleteError(null);

    try {
      const created = await createWorkspaceMutation.mutateAsync(toProvisionWorkspaceMutationInput(values));
      toast.success(`Workspace ${created.name} criado com sucesso.`);
      form.reset(emptyWorkspaceCreateFormValues);
      setIsWorkspaceKeyDirty(false);
      setView("select");
      navigate(buildWorkspaceBoardPath(created.slug));
    } catch {
      // The mutation hook owns the user-facing toast.
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspacePendingDelete) {
      return;
    }

    if (!deleteConfirmationMatches) {
      setDeleteError("Digite o nome do workspace exatamente como exibido para confirmar a exclusao.");
      return;
    }

    setDeleteError(null);

    try {
      const deletedWorkspaceName = workspacePendingDelete.name;
      await deleteWorkspaceMutation.mutateAsync(workspacePendingDelete.slug);
      toast.success(`Workspace ${deletedWorkspaceName} excluido com sucesso.`);
      setWorkspacePendingDelete(null);
      setDeleteConfirmation("");
    } catch {
      // The mutation hook owns the user-facing toast.
    }
  };

  return (
    <main className="no-workspace-page workspace-selector-page">
      <div className="no-workspace-page__backdrop" aria-hidden="true" />
      <section
        className={`no-workspace-page__shell workspace-selector-page__shell${
          isCreateView ? " workspace-selector-page__shell--create" : ""
        }`}
        aria-label={isCreateView ? "Cadastrar workspace" : "Selecionar workspace"}
      >
        <Card className="no-workspace-page__card workspace-selector-page__card">
          {isCreateView ? (
            <>
              <header className="no-workspace-page__header workspace-selector-page__create-header">
                <div className="workspace-selector-page__create-header-copy">
                  <Button
                    className="workspace-selector-page__back-button"
                    type="button"
                    variant="outline"
                    onClick={handleBackToSelection}
                    disabled={isCreating}
                  >
                    <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.2} />
                    Voltar para workspaces
                  </Button>
                  <p className="no-workspace-page__eyebrow">Novo workspace</p>
                  <h1 className="no-workspace-page__title">Cadastre tudo de uma vez</h1>
                  <p className="no-workspace-page__description">
                    Preencha a identidade do workspace e os dados que alimentam propostas, contratos e cobrancas.
                  </p>
                </div>
              </header>

              {!canCreateWorkspace ? (
                <p className="workspace-selector-page__state">
                  Sua conta foi convidada para workspaces existentes e nao pode criar um workspace proprio sem assinatura.
                </p>
              ) : (
                <form
                  className="workspace-selector-page__create-card"
                  aria-label="Cadastrar workspace"
                  onSubmit={form.handleSubmit(handleCreateWorkspace)}
                >
                  <div className="workspace-selector-page__create-section">
                    <h2>Base do workspace</h2>
                    <div className="workspace-selector-page__create-grid">
                      <FormField label="Tipo">
                        <Controller
                          control={form.control}
                          name="kind"
                          render={({ field }) => (
                            <AppSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              items={workspaceKindOptions}
                            />
                          )}
                        />
                        {fieldError(form.formState.errors.kind?.message)}
                      </FormField>
                      <FormField label="Template">
                        <Controller
                          control={form.control}
                          name="templateKey"
                          render={({ field }) => (
                            <AppSelect
                              value={field.value || EMPTY_TEMPLATE_VALUE}
                              onValueChange={(value) => {
                                field.onChange(value === EMPTY_TEMPLATE_VALUE ? "" : value);
                              }}
                              disabled={templatesQuery.isLoading || availableTemplates.length === 0}
                              items={templateItems}
                            />
                          )}
                        />
                        {fieldError(form.formState.errors.templateKey?.message)}
                      </FormField>
                      <FormField label="Nome do workspace">
                        <TextInput {...form.register("workspaceName")} placeholder="Ex.: Produto Core" />
                        {fieldError(form.formState.errors.workspaceName?.message)}
                      </FormField>
                      <FormField label="Chave do workspace">
                        <Controller
                          control={form.control}
                          name="workspaceKey"
                          render={({ field }) => (
                            <TextInput
                              value={field.value}
                              onChange={(event) => {
                                setIsWorkspaceKeyDirty(true);
                                field.onChange(makeWorkspaceKeyDraft(event.target.value));
                              }}
                              placeholder="PRODCORE"
                            />
                          )}
                        />
                        {fieldError(form.formState.errors.workspaceKey?.message)}
                      </FormField>
                      <FormField label="Website" className="workspace-selector-page__field--wide">
                        <TextInput {...form.register("workspaceWebsite")} placeholder="https://suaempresa.com" />
                        {fieldError(form.formState.errors.workspaceWebsite?.message)}
                      </FormField>
                      <FormField label="Descricao" className="workspace-selector-page__field--wide">
                        <Textarea
                          {...form.register("workspaceDescription")}
                          placeholder="Resumo da area, objetivo ou contexto deste workspace."
                          rows={3}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="workspace-selector-page__create-section">
                    <h2>Empresa e dados legais</h2>
                    <div className="workspace-selector-page__create-grid">
                      <FormField label="Nome fantasia / empresa">
                        <TextInput {...form.register("companyProfile.name")} placeholder="Ex.: Dask Labs" />
                        {fieldError(form.formState.errors.companyProfile?.name?.message)}
                      </FormField>
                      <FormField label="Razao social / nome legal">
                        <TextInput
                          {...form.register("companyProfile.legalName")}
                          placeholder="Ex.: Dask Labs Tecnologia Ltda"
                        />
                      </FormField>
                      <FormField label="CPF / CNPJ">
                        <TextInput {...form.register("companyProfile.document")} placeholder="Ex.: 00.000.000/0001-00" />
                      </FormField>
                      <FormField label="Aviso previo padrao (dias)">
                        <TextInput {...form.register("companyProfile.noticePeriod")} placeholder="Ex.: 30" />
                      </FormField>
                      <FormField label="Endereco da contratada" className="workspace-selector-page__field--wide">
                        <Textarea
                          {...form.register("companyProfile.address")}
                          placeholder="Logradouro, numero, complemento, cidade, estado, CEP"
                          rows={3}
                        />
                      </FormField>
                      <FormField label="Cidade do foro">
                        <TextInput {...form.register("companyProfile.jurisdictionCity")} placeholder="Ex.: Sao Paulo" />
                      </FormField>
                      <FormField label="Estado do foro">
                        <TextInput {...form.register("companyProfile.jurisdictionState")} placeholder="Ex.: SP" />
                      </FormField>
                    </div>
                  </div>

                  <div className="workspace-selector-page__create-actions">
                    <div className="workspace-selector-page__create-action-feedback">
                      {templatesQuery.isError ? (
                        <p className="workspace-selector-page__error">Nao foi possivel carregar o catalogo de templates.</p>
                      ) : null}
                    </div>
                    <Button
                      className="workspace-selector-page__create-submit"
                      type="submit"
                      variant="primary"
                      disabled={isCreating || templatesQuery.isLoading || !templateKey}
                      loading={isCreating}
                    >
                      {isCreating ? "Criando..." : "Criar workspace"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <header className="no-workspace-page__header">
                <p className="no-workspace-page__eyebrow">Trocar workspace</p>
                <h1 className="no-workspace-page__title">Selecione onde voce quer trabalhar</h1>
                <p className="no-workspace-page__description">
                  Voce pode participar de varios workspaces. Escolha um para abrir o board.
                </p>
              </header>

              <div className="no-workspace-page__actions workspace-selector-page__toolbar">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, slug ou chave"
                />
                <div className="workspace-selector-page__toolbar-actions">
                  <Button
                    className="no-workspace-page__secondary"
                    type="button"
                    onClick={handleOpenCreate}
                    disabled={billingStatusQuery.isLoading || !canCreateWorkspace}
                  >
                    {!canCreateWorkspace ? "Criacao indisponivel" : "Criar novo workspace"}
                  </Button>
                </div>
              </div>

              {!canCreateWorkspace && !billingStatusQuery.isLoading ? (
                <p className="workspace-selector-page__state">
                  Sua conta foi convidada para workspaces existentes e nao pode criar um workspace proprio sem assinatura.
                </p>
              ) : null}

              {workspacesQuery.isLoading ? <p className="workspace-selector-page__state">Carregando workspaces...</p> : null}
              {workspacesQuery.isError ? (
                <p className="workspace-selector-page__error">Nao foi possivel carregar seus workspaces agora.</p>
              ) : null}

              {!workspacesQuery.isLoading && !workspacesQuery.isError && filtered.length === 0 ? (
                <p className="workspace-selector-page__state">Nenhum workspace encontrado.</p>
              ) : null}

              {!workspacesQuery.isLoading && !workspacesQuery.isError && filtered.length > 0 ? (
                <div className="workspace-selector-page__list">
                  {filtered.map((workspace) => (
                    <article key={workspace.id} className="workspace-selector-page__workspace">
                      <div className="workspace-selector-page__workspace-copy">
                        <strong>{workspace.name}</strong>
                        <span>{workspace.kind === "CORPORATE" ? "Corporativo" : "Pessoal"} - {workspace.role}</span>
                        <small>{workspace.slug}</small>
                      </div>
                      <div className="workspace-selector-page__workspace-actions">
                        <Button
                          className="workspace-selector-page__enter-button"
                          variant="primary"
                          type="button"
                          onClick={() => navigate(buildWorkspaceBoardPath(workspace.slug))}
                        >
                          Entrar
                        </Button>
                        {workspace.role === "OWNER" ? (
                          <Button
                            className="workspace-selector-page__delete-trigger"
                            type="button"
                            onClick={() => handleOpenDeleteWorkspace(workspace)}
                          >
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Card>
      </section>

      {workspacePendingDelete ? (
        <AppDialog
          open
          showClose={false}
          className="workspace-selector-page__delete-modal"
          contentClassName="workspace-selector-page__delete-dialog"
          title={(
            <>
              <span className="workspace-selector-page__delete-eyebrow">Excluir workspace</span>
              <span className="workspace-selector-page__delete-title-text">Confirmar exclusao permanente</span>
            </>
          )}
          titleClassName="workspace-selector-page__delete-title"
          description={(
            <>
              Essa acao remove o workspace, boards, documentos, automacoes e configuracoes vinculadas. Nao existe
              restauracao automatica depois da exclusao.
            </>
          )}
          descriptionClassName="workspace-selector-page__delete-description"
          onOpenChange={(open) => {
            if (!open) handleCloseDeleteWorkspace();
          }}
        >
          <div className="workspace-selector-page__delete-target">
            <strong>{workspacePendingDelete.name}</strong>
            <span>
              {workspacePendingDelete.kind === "CORPORATE" ? "Corporativo" : "Pessoal"} - {workspacePendingDelete.role}
            </span>
            <small>{workspacePendingDelete.slug}</small>
          </div>

          <FormField label="Digite o nome do workspace para confirmar">
            <TextInput
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={workspacePendingDelete.name}
              autoFocus
            />
          </FormField>

          <p className="workspace-selector-page__delete-hint">
            Confirmacao necessaria: <strong>{workspacePendingDelete.name}</strong>
          </p>

          {deleteError ? <p className="workspace-selector-page__error">{deleteError}</p> : null}

          <div className="workspace-selector-page__delete-actions">
            <Button
              className="no-workspace-page__secondary"
              type="button"
              onClick={handleCloseDeleteWorkspace}
              disabled={isDeletingWorkspace}
            >
              Cancelar
            </Button>
            <Button
              className="workspace-selector-page__delete-confirm"
              type="button"
              onClick={() => void handleDeleteWorkspace()}
              disabled={isDeletingWorkspace || !deleteConfirmationMatches}
              loading={isDeletingWorkspace}
            >
              {isDeletingWorkspace ? "Excluindo..." : "Excluir workspace"}
            </Button>
          </div>
        </AppDialog>
      ) : null}
    </main>
  );
}
