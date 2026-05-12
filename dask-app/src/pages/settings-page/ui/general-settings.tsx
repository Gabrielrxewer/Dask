import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { mergeCardFieldDefinitions } from "@/entities/task";
import {
  buildOnboardingChecklist,
  canManageSensitiveConnectSettings as canManageSensitiveConnectSettingsForRole,
  getNextOnboardingAction,
  sensitiveConnectSettingsPermissionMessage,
  useConnectAccountQuery,
  useCreateConnectAccountMutation
} from "@/modules/billing";
import type { ConnectAccountStatus } from "@/modules/billing";
import {
  useUpdateWorkspaceProfileMutation,
  useWorkspaceProfileQuery,
  useWorkspaceSettings,
  useWorkspaceSettingsPermissions,
  useWorkspaceSummaryQuery,
  useWorkspaceTemplatesQuery
} from "@/modules/workspace";
import type { WorkspaceTemplateOption } from "@/modules/workspace/model";
import { buildWorkspaceSettingsMembersPath, buildWorkspaceSelectorPath } from "@/app/router";
import { isApiError } from "@/shared/api/http-client";
import { AppDialog, AppForm, AppFormField, AppSelect, Button, FormField, Textarea, TextInput, toast } from "@/shared/ui";
import {
  emptyCompanyProfile,
  emptyWorkspaceProfileSettingsForm,
  workspaceProfileSettingsFormSchema,
  type CompanyProfileForm,
  type WorkspaceProfileSettingsFormInput,
  type WorkspaceProfileSettingsFormValues
} from "./general-settings.model";
import "./general-settings.css";

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
};

function resolvePerspectives(rawBoardConfig: unknown): BoardPerspective[] {
  const fromPerspectives =
    rawBoardConfig &&
    typeof rawBoardConfig === "object" &&
    Array.isArray((rawBoardConfig as { perspectives?: unknown }).perspectives)
      ? ((rawBoardConfig as { perspectives: BoardPerspective[] }).perspectives ?? [])
      : [];

  if (fromPerspectives.length > 0) {
    return fromPerspectives;
  }

  const fromViews =
    rawBoardConfig &&
    typeof rawBoardConfig === "object" &&
    Array.isArray((rawBoardConfig as { views?: unknown }).views)
      ? ((rawBoardConfig as { views: BoardPerspective[] }).views ?? [])
      : [];

  return fromViews.length > 0 ? fromViews : [];
}

function statusLabel(count: number, minimum: number): "empty" | "partial" | "done" {
  if (count === 0) return "empty";
  if (count < minimum) return "partial";
  return "done";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readCompanyProfile(settings: Record<string, unknown> | undefined): CompanyProfileForm {
  const profile = settings?.companyProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return emptyCompanyProfile;
  }

  const source = profile as Record<string, unknown>;
  return {
    name: readString(source.name),
    legalName: readString(source.legalName),
    document: readString(source.document),
    address: readString(source.address),
    jurisdictionCity: readString(source.jurisdictionCity),
    jurisdictionState: readString(source.jurisdictionState),
    noticePeriod: readString(source.noticePeriod)
  };
}

function buildWorkspaceProfileFormValues(
  workspaceProfile: {
    name: string;
    key: string;
    info: {
      description: string;
      company: string;
      website: string;
    };
  } | null,
  settings: Record<string, unknown> | undefined
): WorkspaceProfileSettingsFormInput {
  if (!workspaceProfile) {
    return {
      ...emptyWorkspaceProfileSettingsForm,
      companyProfile: readCompanyProfile(settings)
    };
  }

  return {
    workspaceName: workspaceProfile.name,
    workspaceKey: workspaceProfile.key,
    workspaceDescription: workspaceProfile.info.description,
    workspaceCompany: workspaceProfile.info.company,
    workspaceWebsite: workspaceProfile.info.website,
    companyProfile: readCompanyProfile(settings)
  };
}

function getCompanyProfileMissingFields(profile: CompanyProfileForm): string[] {
  return [
    { label: "Razao social / nome legal", value: profile.legalName },
    { label: "CPF / CNPJ", value: profile.document },
    { label: "Endereco da contratada", value: profile.address },
    { label: "Cidade do foro", value: profile.jurisdictionCity },
    { label: "Estado do foro", value: profile.jurisdictionState },
    { label: "Aviso previo padrao", value: profile.noticePeriod }
  ].filter((field) => field.value.trim().length === 0).map((field) => field.label);
}

export function GeneralSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot, updatePreferences, resetWorkspaceTemplate, settings } = useWorkspaceSettings();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplateOption["key"] | "">("");
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const [templateToConfirm, setTemplateToConfirm] = useState<WorkspaceTemplateOption | null>(null);
  const workspaceProfileForm = useForm<WorkspaceProfileSettingsFormInput, unknown, WorkspaceProfileSettingsFormValues>({
    resolver: zodResolver(workspaceProfileSettingsFormSchema),
    defaultValues: {
      ...emptyWorkspaceProfileSettingsForm,
      companyProfile: readCompanyProfile(settings)
    },
    mode: "onChange"
  });
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectLoadState, setConnectLoadState] = useState<"idle" | "loading" | "missing" | "ready" | "error">("idle");
  const [isOpeningOnboarding, setIsOpeningOnboarding] = useState(false);
  const workspaceSummaryQuery = useWorkspaceSummaryQuery(workspaceSlug);
  const templatesQuery = useWorkspaceTemplatesQuery();
  const workspaceProfileQuery = useWorkspaceProfileQuery(workspaceSlug);
  const updateWorkspaceProfileMutation = useUpdateWorkspaceProfileMutation(workspaceSlug);
  const permissions = useWorkspaceSettingsPermissions(workspaceSlug, snapshot);
  const canManageSensitiveConnectSettings = canManageSensitiveConnectSettingsForRole(permissions.role);
  const companyProfile = workspaceProfileForm.watch("companyProfile");
  const isSavingWorkspaceProfile = workspaceProfileForm.formState.isSubmitting;
  const isSavingCompanyProfile = workspaceProfileForm.formState.isSubmitting;
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const workspaceProfile = workspaceProfileQuery.data ?? null;
  const isLoadingTemplates = templatesQuery.isLoading;
  const isCorporateWorkspace = workspaceSummaryQuery.data?.kind === "CORPORATE";
  const connectAccountQuery = useConnectAccountQuery(workspaceProfile?.id);
  const connectOnboardingMutation = useCreateConnectAccountMutation(
    canManageSensitiveConnectSettings ? workspaceProfile?.id : null
  );
  const templateTrackRef = useRef<HTMLDivElement>(null);
  const previewTrackRef = useRef<HTMLDivElement>(null);

  function scrollTrack(ref: React.RefObject<HTMLDivElement | null>, dir: -1 | 1) {
    ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  const rawBoardConfig = snapshot?.boardConfig;
  const perspectives = useMemo(() => resolvePerspectives(rawBoardConfig), [rawBoardConfig]);
  const statuses = Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : [];
  const itemTypes = Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : [];
  const fields = mergeCardFieldDefinitions(
    Array.isArray(rawBoardConfig?.fieldDefinitions) ? rawBoardConfig.fieldDefinitions : []
  );
  const tasksCount = snapshot?.tasks.length ?? 0;
  const defaultMode = snapshot?.preferences.defaultBoardMode ?? perspectives[0]?.id ?? "";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";
  const availableTemplates = templates;
  const missingCompanyProfileFields = getCompanyProfileMissingFields(companyProfile);
  const isCompanyProfileComplete = missingCompanyProfileFields.length === 0;

  const stepStates = {
    perspectives: statusLabel(perspectives.length, 1),
    states: statusLabel(statuses.length, 3),
    types: statusLabel(itemTypes.length, 2),
    fields: statusLabel(fields.length, 4)
  };
  const completedSteps = Object.values(stepStates).filter(value => value === "done").length;
  const progress = Math.round((completedSteps / 4) * 100);

  useEffect(() => {
    if (templates.length > 0) {
      setSelectedTemplate(current =>
        templates.some(option => option.key === current) ? current : templates[0].key
      );
      return;
    }

    if (!templatesQuery.isLoading) {
      setSelectedTemplate("");
    }
  }, [templates, templatesQuery.isLoading]);

  useEffect(() => {
    if (templatesQuery.isError) {
      toast.error("Nao foi possivel carregar o catalogo de templates.");
    }
  }, [templatesQuery.isError]);

  useEffect(() => {
    if (workspaceProfileQuery.isError) {
      toast.error("Nao foi possivel carregar os dados do workspace.");
    }
  }, [workspaceProfileQuery.isError]);

  useEffect(() => {
    if (!workspaceProfile?.id) {
      setConnectLoadState("idle");
      setConnectStatus(null);
      return;
    }

    if (connectAccountQuery.isLoading) {
      setConnectLoadState("loading");
      return;
    }

    if (connectAccountQuery.data) {
      setConnectStatus(connectAccountQuery.data);
      setConnectLoadState("ready");
      return;
    }

    const error = connectAccountQuery.error;
    if (error) {
      if (isApiError(error) && error.status === 404) {
        setConnectStatus(null);
        setConnectLoadState("missing");
        return;
      }
      setConnectStatus(null);
      setConnectLoadState("error");
    }
  }, [
    connectAccountQuery.data,
    connectAccountQuery.error,
    connectAccountQuery.isLoading,
    workspaceProfile?.id
  ]);

  useEffect(() => {
    workspaceProfileForm.reset(buildWorkspaceProfileFormValues(workspaceProfile, settings));
  }, [snapshot?.preferences.settings, workspaceProfile, workspaceProfileForm]);

  const members = useMemo(() => Object.values(snapshot?.membersById ?? {}), [snapshot?.membersById]);
  const adminsCount = useMemo(
    () => members.filter(member => member.role === "OWNER" || member.role === "ADMIN").length,
    [members]
  );

  const handleResetTemplate = async (template: WorkspaceTemplateOption) => {
    if (!permissions.canManageWorkspace) {
      toast.error("Voce nao tem permissao para alterar configuracoes do workspace.");
      return;
    }

    setSelectedTemplate(template.key);
    setIsResettingTemplate(true);

    try {
      await resetWorkspaceTemplate(template.key);
      toast.success(`${template.name} aplicado.`);
      setTemplateToConfirm(null);
    } catch {
      toast.error("Nao foi possivel aplicar o template agora.");
    } finally {
      setIsResettingTemplate(false);
    }
  };

  const handleSaveAll = async (values: WorkspaceProfileSettingsFormValues) => {
    if (!permissions.canManageWorkspace) {
      toast.error("Voce nao tem permissao para alterar configuracoes do workspace.");
      return;
    }

    try {
      const [updated] = await Promise.all([
        updateWorkspaceProfileMutation.mutateAsync({
          name: values.workspaceName,
          key: values.workspaceKey,
          info: {
            description: values.workspaceDescription,
            company: values.workspaceCompany,
            website: values.workspaceWebsite
          }
        }),
        updatePreferences({
          settings: {
            ...settings,
            companyProfile: values.companyProfile
          }
        })
      ]);

      workspaceProfileForm.reset({
        workspaceName: updated.name,
        workspaceKey: updated.key,
        workspaceDescription: updated.info.description,
        workspaceCompany: updated.info.company,
        workspaceWebsite: updated.info.website,
        companyProfile: values.companyProfile
      });
      toast.success("Dados salvos.");
    } catch {
      toast.error("Nao foi possivel salvar agora. Tente novamente.");
    }
  };

  const hasConnectRequirements = Boolean(connectStatus && connectStatus.requirementsDue.length > 0);
  const connectNeedsAttention = Boolean(
    connectStatus && (!connectStatus.onboardingComplete || !connectStatus.chargesEnabled || hasConnectRequirements)
  );
  const onboardingChecklist = useMemo(
    () => buildOnboardingChecklist(connectStatus),
    [connectStatus]
  );
  const nextOnboardingAction = useMemo(
    () => getNextOnboardingAction(connectStatus, onboardingChecklist),
    [connectStatus, onboardingChecklist]
  );

  const handleOpenConnectOnboarding = async () => {
    if (!workspaceProfile?.id || isOpeningOnboarding) {
      return;
    }

    if (!canManageSensitiveConnectSettings) {
      toast.warning(sensitiveConnectSettingsPermissionMessage);
      return;
    }

    setIsOpeningOnboarding(true);

    try {
      const response = await connectOnboardingMutation.mutateAsync(undefined);
      window.location.href = response.url;
    } catch {
      toast.error("Nao foi possivel abrir o cadastro da cobranca Connect.");
      setIsOpeningOnboarding(false);
    }
  };

  return (
    <div className="general-settings">
      <section className="general-settings__builder-hero">
        <div className="general-settings__builder-meta">
          <div className="general-settings__builder-copy">
            <span>Configuracao</span>
            <h1>Monte seu workspace</h1>
            <p>Veja o estado do board, aplique um template e ajuste preferencias iniciais.</p>
          </div>
          <div className="general-settings__progress">
            <div>
              <strong>Board {progress}% configurado</strong>
              <small>{completedSteps} de 4 areas prontas</small>
            </div>
            <span><i style={{ width: `${progress}%` }} /></span>
          </div>
        </div>

        <div className="general-settings__track-wrap">
          <button
            type="button"
            className="general-settings__track-arrow"
            onClick={() => scrollTrack(previewTrackRef, -1)}
            aria-label="Anterior"
          >
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div ref={previewTrackRef} className="general-settings__preview-track" aria-label="Preview do board">
            {statuses.map(status => (
              <div key={status.id} className="general-settings__preview-column">
                <span>
                  <i style={{ background: status.dot }} />
                  {status.label}
                </span>
                <div className="general-settings__preview-card">
                  <strong>{itemTypes[0]?.label ?? "Work item"}</strong>
                  <small>{fields[0]?.label ?? "Campo"}</small>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="general-settings__track-arrow"
            onClick={() => scrollTrack(previewTrackRef, 1)}
            aria-label="Proximo"
          >
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </section>

      <section className="general-settings__templates">
        <header>
          <span>Templates</span>
          <h2>Comece com uma base pronta</h2>
        </header>
        <div className="general-settings__track-wrap">
          <button
            type="button"
            className="general-settings__track-arrow"
            onClick={() => scrollTrack(templateTrackRef, -1)}
            aria-label="Anterior"
          >
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div ref={templateTrackRef} className="general-settings__template-track">
            {availableTemplates.map(template => (
              <article
                key={template.key}
                className={`general-settings__template-card${selectedTemplate === template.key ? " is-selected" : ""}`}
              >
                <div>
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setTemplateToConfirm(template)}
                  disabled={!permissions.canManageWorkspace || isLoadingTemplates || isResettingTemplate}
                >
                  Usar
                </Button>
              </article>
            ))}
            {!isLoadingTemplates && availableTemplates.length === 0 ? (
              <p className="general-settings__empty-state">Catalogo de templates indisponivel.</p>
            ) : null}
          </div>
          <button
            type="button"
            className="general-settings__track-arrow"
            onClick={() => scrollTrack(templateTrackRef, 1)}
            aria-label="Proximo"
          >
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </section>

      <section className="general-settings__preferences-row">
        <div className="general-settings__summary-card">
          <h2>Resumo do workspace</h2>
          <div className="general-settings__summary-grid">
            <span><strong>{perspectives.length}</strong> perspectivas</span>
            <span><strong>{statuses.length}</strong> estados</span>
            <span><strong>{itemTypes.length}</strong> tipos</span>
            <span><strong>{fields.length}</strong> campos</span>
            <span className="general-settings__summary-wide"><strong>{tasksCount}</strong> itens</span>
          </div>
          <div className="general-settings__members-cta">
            <strong>Membros e acesso</strong>
            {isCorporateWorkspace ? (
              <>
                <p>
                  {members.length} membro(s) no workspace, sendo {adminsCount} com perfil administrativo.
                </p>
                <Link to={buildWorkspaceSettingsMembersPath(workspaceSlug)}>
                  Abrir configuracao de membros
                </Link>
                <Link to={buildWorkspaceSelectorPath()}>
                  Trocar workspace
                </Link>
              </>
            ) : (
              <p>Workspace pessoal: controle de membros disponivel apenas em workspaces corporativos.</p>
            )}
          </div>
        </div>

        <div className="general-settings__preference-card">
          <h2>Preferencias iniciais</h2>
          <div className="general-settings__form-grid">
            <FormField label="Perspectiva inicial">
              <AppSelect
                value={defaultMode}
                onValueChange={value => void updatePreferences({ defaultBoardMode: value })}
                disabled={!permissions.canManageWorkspace || perspectives.length === 0}
                aria-label="Perspectiva inicial"
                items={perspectives.map(perspective => ({ value: perspective.id, label: perspective.label }))}
              />
            </FormField>
            <FormField label="Formato de data">
              <AppSelect
                value={dateFormat}
                onValueChange={value =>
                  void updatePreferences({
                    dateFormat: value as "dd/mm/yyyy" | "mm/dd/yyyy"
                  })
                }
                aria-label="Formato de data"
                disabled={!permissions.canManageWorkspace}
                items={[
                  { value: "dd/mm/yyyy", label: "DD/MM/YYYY" },
                  { value: "mm/dd/yyyy", label: "MM/DD/YYYY" }
                ]}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className="general-settings__workspace-profile">
        <header>
          <span>Workspace</span>
          <h2>Identidade e dados legais</h2>
          <p>Nome e informacoes do workspace e cadastro da contratada usada em propostas e contratos.</p>
        </header>
        {isCorporateWorkspace && !isCompanyProfileComplete ? (
          <div className="general-settings__required-company-alert">
            <strong>Cadastro legal incompleto</strong>
            <p>Complete os dados da contratada. Sem isso, contratos e propostas ficam com campos "a definir".</p>
            <small>Pendente: {missingCompanyProfileFields.join(", ")}</small>
          </div>
        ) : null}
        <AppForm
          form={workspaceProfileForm}
          onSubmit={handleSaveAll}
          className="general-settings__workspace-profile-form"
          disabled={!permissions.canManageWorkspace}
          loading={isSavingWorkspaceProfile || isSavingCompanyProfile}
        >
        <div className="general-settings__workspace-profile-grid">
          <AppFormField label="Nome do workspace" error={workspaceProfileForm.formState.errors.workspaceName?.message}>
            <TextInput
              {...workspaceProfileForm.register("workspaceName")}
              placeholder="Ex.: Produto Core"
              disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile}
              aria-invalid={workspaceProfileForm.formState.errors.workspaceName ? true : undefined}
            />
          </AppFormField>
          <AppFormField label="Chave do workspace (A-Z e 0-9)" error={workspaceProfileForm.formState.errors.workspaceKey?.message}>
            <TextInput
              {...workspaceProfileForm.register("workspaceKey", {
                onChange: event => {
                  event.target.value = event.target.value.toUpperCase();
                }
              })}
              placeholder="PRODCORE"
              disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile}
              aria-invalid={workspaceProfileForm.formState.errors.workspaceKey ? true : undefined}
            />
          </AppFormField>
          <AppFormField label="Website" error={workspaceProfileForm.formState.errors.workspaceWebsite?.message}>
            <TextInput
              {...workspaceProfileForm.register("workspaceWebsite")}
              placeholder="https://suaempresa.com"
              disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile}
            />
          </AppFormField>
          <AppFormField label="Descricao" className="general-settings__field--full" error={workspaceProfileForm.formState.errors.workspaceDescription?.message}>
            <Textarea
              {...workspaceProfileForm.register("workspaceDescription")}
              placeholder="Resumo da area, objetivo ou contexto deste workspace."
              rows={3}
              disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile}
            />
          </AppFormField>

          <div className="general-settings__form-divider">
            <span>Dados legais da contratada</span>
          </div>

          <AppFormField label="Nome fantasia / empresa" error={workspaceProfileForm.formState.errors.companyProfile?.name?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.name", {
                onChange: event => {
                  workspaceProfileForm.setValue("workspaceCompany", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }
              })}
              placeholder="Ex.: Dask Labs"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
          <AppFormField label="Razao social / nome legal" error={workspaceProfileForm.formState.errors.companyProfile?.legalName?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.legalName")}
              placeholder="Ex.: Dask Labs Tecnologia Ltda"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
          <AppFormField label="CPF / CNPJ" error={workspaceProfileForm.formState.errors.companyProfile?.document?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.document")}
              placeholder="Ex.: 00.000.000/0001-00"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
          <AppFormField label="Aviso previo padrao (dias)" error={workspaceProfileForm.formState.errors.companyProfile?.noticePeriod?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.noticePeriod")}
              placeholder="Ex.: 30"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
              aria-invalid={workspaceProfileForm.formState.errors.companyProfile?.noticePeriod ? true : undefined}
            />
          </AppFormField>
          <AppFormField label="Endereco da contratada" className="general-settings__field--full" error={workspaceProfileForm.formState.errors.companyProfile?.address?.message}>
            <Textarea
              {...workspaceProfileForm.register("companyProfile.address")}
              placeholder="Logradouro, numero, complemento, cidade, estado, CEP"
              rows={3}
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
          <AppFormField label="Cidade do foro" error={workspaceProfileForm.formState.errors.companyProfile?.jurisdictionCity?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.jurisdictionCity")}
              placeholder="Ex.: Sao Paulo"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
          <AppFormField label="Estado do foro" error={workspaceProfileForm.formState.errors.companyProfile?.jurisdictionState?.message}>
            <TextInput
              {...workspaceProfileForm.register("companyProfile.jurisdictionState")}
              placeholder="Ex.: SP"
              disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
            />
          </AppFormField>
        </div>
        <div className="general-settings__workspace-profile-actions">
          <Button
            type="submit"
            disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile || isSavingCompanyProfile}
          >
            {isSavingWorkspaceProfile || isSavingCompanyProfile ? "Salvando..." : "Salvar"}
          </Button>
          {workspaceProfile?.kind ? <small>Tipo: {workspaceProfile.kind}</small> : null}
        </div>
        </AppForm>
      </section>

      <section className="general-settings__billing-connect">
        <header>
          <span>Cobranca Connect</span>
          <h2>Completar cadastro da cobranca</h2>
          <p>
            Seus clientes so conseguem cobrar clientes deles quando a conta Connect do workspace estiver completa.
          </p>
        </header>

        <div className="general-settings__billing-status">
          {connectLoadState === "loading" ? (
            <p>Carregando status da conta Connect...</p>
          ) : null}
          {connectLoadState === "missing" ? (
            <p className="general-settings__billing-warning">
              Conta Connect ainda nao iniciada. Complete o cadastro para liberar cobrancas.
            </p>
          ) : null}
          {connectLoadState === "error" ? (
            <p className="general-settings__billing-warning">
              Nao foi possivel verificar o status da cobranca agora.
            </p>
          ) : null}
          {connectLoadState === "ready" && connectStatus ? (
            <>
              {connectNeedsAttention ? (
                <p className="general-settings__billing-warning">
                  Existem pendencias cadastrais no Stripe Connect. Complete os dados para habilitar cobrancas.
                </p>
              ) : (
                <p className="general-settings__billing-success">
                  Conta Connect pronta. Cobrancas e repasses habilitados.
                </p>
              )}
              <div className="general-settings__billing-grid">
                <span>
                  <strong>{connectStatus.chargesEnabled ? "Sim" : "Nao"}</strong>
                  Cobrancas habilitadas
                </span>
                <span>
                  <strong>{connectStatus.payoutsEnabled ? "Sim" : "Nao"}</strong>
                  Repasses habilitados
                </span>
                <span>
                  <strong>{connectStatus.requirementsDue.length}</strong>
                  Pendencias cadastrais
                </span>
              </div>
              <p className="general-settings__billing-next-step">
                <strong>Proximo passo:</strong> {nextOnboardingAction}
              </p>
            </>
          ) : null}
        </div>

        <ul className="general-settings__billing-checklist">
          {onboardingChecklist.map((item) => (
            <li key={item.key} className={item.done ? "is-done" : "is-pending"}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              {!item.done && item.pendingReasons.length > 0 ? (
                <small>{item.pendingReasons.join(" | ")}</small>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="general-settings__billing-actions">
          <Button
            type="button"
            onClick={() => void handleOpenConnectOnboarding()}
            disabled={!canManageSensitiveConnectSettings || isOpeningOnboarding}
            title={!canManageSensitiveConnectSettings ? sensitiveConnectSettingsPermissionMessage : undefined}
          >
            {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
          </Button>
        </div>
      </section>

      {templateToConfirm ? (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) setTemplateToConfirm(null);
          }}
          className="general-settings__template-modal"
          bodyClassName="general-settings__template-modal-body"
          showClose={false}
        >
          <>
            <div className="general-settings__modal-copy">
              <span>Trocar template</span>
              <h2 id="template-confirm-title">Usar {templateToConfirm.name}?</h2>
              <p>
                A base do workspace sera recriada com esse template. As configuracoes detalhadas podem ser ajustadas depois nas telas do menu.
              </p>
            </div>
            <div className="general-settings__modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemplateToConfirm(null)}
                disabled={isResettingTemplate}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleResetTemplate(templateToConfirm)}
                disabled={!permissions.canManageWorkspace || isResettingTemplate}
              >
                {isResettingTemplate ? "Aplicando..." : "Usar template"}
              </Button>
            </div>
          </>
        </AppDialog>
      ) : null}
    </div>
  );
}
