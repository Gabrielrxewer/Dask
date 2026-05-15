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
import {
  useDisableWhatsAppIntegrationMutation,
  useTestWhatsAppIntegrationMutation,
  useUpsertWhatsAppIntegrationMutation,
  useWhatsAppIntegration
} from "@/modules/automation/query";
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
import { SettingsProfileCard, SettingsSectionHeading, SettingsSummaryList } from "./settings-summary-components";
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
    addressLine1: readString(source.addressLine1),
    addressLine2: readString(source.addressLine2),
    city: readString(source.city),
    state: readString(source.state),
    postalCode: readString(source.postalCode),
    country: readString(source.country) || "BR",
    businessType:
      source.businessType === "individual" || source.businessType === "company" || source.businessType === "corporate"
        ? source.businessType
        : "company",
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
    { label: "Endereco da contratada", value: profile.addressLine1 || profile.address },
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
  const [profileDialog, setProfileDialog] = useState<"identity" | "legal" | null>(null);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);
  const [isConnectDetailsOpen, setIsConnectDetailsOpen] = useState(false);
  const [whatsAppAccessToken, setWhatsAppAccessToken] = useState("");
  const [whatsAppPhoneNumberId, setWhatsAppPhoneNumberId] = useState("");
  const [whatsAppWabaId, setWhatsAppWabaId] = useState("");
  const [whatsAppGraphApiVersion, setWhatsAppGraphApiVersion] = useState("v23.0");
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
  const workspaceProfileValues = workspaceProfileForm.watch();
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
  const whatsAppIntegrationQuery = useWhatsAppIntegration(workspaceSlug || null);
  const upsertWhatsAppIntegrationMutation = useUpsertWhatsAppIntegrationMutation(workspaceSlug || null);
  const testWhatsAppIntegrationMutation = useTestWhatsAppIntegrationMutation(workspaceSlug || null);
  const disableWhatsAppIntegrationMutation = useDisableWhatsAppIntegrationMutation(workspaceSlug || null);
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
  const defaultModeLabel = perspectives.find(perspective => perspective.id === defaultMode)?.label ?? "Nao definido";
  const legalStatusLabel = isCompanyProfileComplete ? "Completo" : `${missingCompanyProfileFields.length} pendencia(s)`;

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

  useEffect(() => {
    const integration = whatsAppIntegrationQuery.data?.integration;
    if (!integration) return;
    setWhatsAppPhoneNumberId(integration.phoneNumberId);
    setWhatsAppWabaId(integration.wabaId ?? "");
    setWhatsAppGraphApiVersion(integration.graphApiVersion || "v23.0");
  }, [whatsAppIntegrationQuery.data?.integration]);

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
      return true;
    } catch {
      toast.error("Nao foi possivel salvar agora. Tente novamente.");
      return false;
    }
  };

  const closeProfileDialog = () => setProfileDialog(null);

  const hasConnectRequirements = Boolean(connectStatus && connectStatus.requirementsDue.length > 0);
  const connectNeedsAttention = Boolean(
    connectStatus && (!connectStatus.onboardingComplete || !connectStatus.chargesEnabled || hasConnectRequirements)
  );
  const connectSummaryLabel =
    connectLoadState === "ready" && connectStatus
      ? connectNeedsAttention
        ? "Verificacao pendente"
        : "Conta pronta"
      : connectLoadState === "missing"
        ? "Nao iniciado"
        : connectLoadState === "loading"
          ? "Carregando"
          : "Indisponivel";
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
  const whatsAppIntegration = whatsAppIntegrationQuery.data?.integration ?? null;
  const isWhatsAppBusy =
    upsertWhatsAppIntegrationMutation.isPending ||
    testWhatsAppIntegrationMutation.isPending ||
    disableWhatsAppIntegrationMutation.isPending;
  const canSaveWhatsApp = whatsAppAccessToken.trim().length > 0 && whatsAppPhoneNumberId.trim().length > 0;

  const handleSaveWhatsAppIntegration = async () => {
    if (!canSaveWhatsApp) return;
    await upsertWhatsAppIntegrationMutation.mutateAsync({
      accessToken: whatsAppAccessToken,
      phoneNumberId: whatsAppPhoneNumberId,
      wabaId: whatsAppWabaId || null,
      graphApiVersion: whatsAppGraphApiVersion || "v23.0"
    });
    setWhatsAppAccessToken("");
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
          <SettingsSectionHeading eyebrow="Resumo" title="Workspace em operacao" />
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
          <SettingsSectionHeading
            eyebrow="Preferencias"
            title="Preferencias iniciais"
            description="Define como o workspace abre para quem acessa o board."
          />
          <SettingsSummaryList
            items={[
              { label: "Perspectiva inicial", value: defaultModeLabel },
              { label: "Formato de data", value: dateFormat.toUpperCase() }
            ]}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPreferencesDialogOpen(true)}
            disabled={!permissions.canManageWorkspace}
          >
            Editar preferencias
          </Button>
        </div>
      </section>

      <section className="general-settings__workspace-profile">
        <header>
          <SettingsSectionHeading
            eyebrow="Integracoes"
            title="WhatsApp Business"
            description="Conecte a Cloud API da Meta para o workspace enviar e receber conversas pelo numero do cliente."
          />
        </header>
        <div className="general-settings__profile-grid">
          <SettingsProfileCard
            eyebrow="Status"
            title={whatsAppIntegration ? whatsAppIntegration.status : "Nao conectado"}
            description={
              whatsAppIntegration
                ? `${whatsAppIntegration.displayPhoneNumber ?? whatsAppIntegration.phoneNumberId} - token ...${whatsAppIntegration.accessTokenLast4 ?? "****"}`
                : "Cole as credenciais do WhatsApp Cloud API do cliente para ativar o provider Meta neste workspace."
            }
            details={[
              { label: "Phone number ID", value: whatsAppIntegration?.phoneNumberId ?? "Nao definido" },
              { label: "WABA ID", value: whatsAppIntegration?.wabaId ?? "Nao definido" },
              { label: "Ultimo teste", value: whatsAppIntegration?.lastTestStatus ?? "Nao testado" }
            ]}
            action={
              <div className="general-settings__inline-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!whatsAppIntegration || isWhatsAppBusy}
                  onClick={() => void testWhatsAppIntegrationMutation.mutateAsync()}
                >
                  Testar conexao
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!whatsAppIntegration || isWhatsAppBusy}
                  onClick={() => void disableWhatsAppIntegrationMutation.mutateAsync()}
                >
                  Desativar
                </Button>
              </div>
            }
          />
          <div className="general-settings__profile-card">
            <span>Credenciais</span>
            <div className="general-settings__form-grid">
              <TextInput
                type="password"
                placeholder={whatsAppIntegration ? "Novo access token" : "Access token da Meta"}
                value={whatsAppAccessToken}
                disabled={isWhatsAppBusy}
                onChange={(event) => setWhatsAppAccessToken(event.target.value)}
              />
              <TextInput
                placeholder="Phone number ID"
                value={whatsAppPhoneNumberId}
                disabled={isWhatsAppBusy}
                onChange={(event) => setWhatsAppPhoneNumberId(event.target.value)}
              />
              <TextInput
                placeholder="WABA ID"
                value={whatsAppWabaId}
                disabled={isWhatsAppBusy}
                onChange={(event) => setWhatsAppWabaId(event.target.value)}
              />
              <TextInput
                placeholder="v23.0"
                value={whatsAppGraphApiVersion}
                disabled={isWhatsAppBusy}
                onChange={(event) => setWhatsAppGraphApiVersion(event.target.value)}
              />
            </div>
            {whatsAppIntegration?.lastTestError ? <p>{whatsAppIntegration.lastTestError}</p> : null}
            <Button
              type="button"
              disabled={!canSaveWhatsApp || isWhatsAppBusy}
              onClick={() => void handleSaveWhatsAppIntegration()}
            >
              Salvar WhatsApp
            </Button>
          </div>
        </div>
      </section>

      <section className="general-settings__workspace-profile">
        <header>
          <SettingsSectionHeading
            eyebrow="Workspace"
            title="Identidade e dados legais"
            description="Resumo dos dados usados em propostas, contratos, fiscal e pre-cadastro da cobranca."
          />
        </header>
        {isCorporateWorkspace && !isCompanyProfileComplete ? (
          <div className="general-settings__required-company-alert">
            <strong>Cadastro legal incompleto</strong>
            <p>Complete os dados da contratada. Sem isso, contratos e propostas ficam com campos "a definir".</p>
            <small>Pendente: {missingCompanyProfileFields.join(", ")}</small>
          </div>
        ) : null}
        <div className="general-settings__profile-grid">
          <SettingsProfileCard
            eyebrow="Identidade do workspace"
            title={workspaceProfileValues.workspaceName || "Workspace sem nome"}
            description={workspaceProfileValues.workspaceDescription || "Sem descricao cadastrada."}
            details={[
              { label: "Chave", value: workspaceProfileValues.workspaceKey || "Nao definida" },
              { label: "Empresa", value: workspaceProfileValues.workspaceCompany || "Nao definida" },
              { label: "Website", value: workspaceProfileValues.workspaceWebsite || "Nao definido" }
            ]}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileDialog("identity")}
                disabled={!permissions.canManageWorkspace}
              >
                Editar dados
              </Button>
            }
          />
          <SettingsProfileCard
            eyebrow="Dados legais"
            title={legalStatusLabel}
            description={companyProfile.legalName || companyProfile.name || "Identidade legal ainda nao cadastrada."}
            details={[
              { label: "Documento", value: companyProfile.document || "Nao definido" },
              { label: "Endereco", value: companyProfile.addressLine1 || companyProfile.address || "Nao definido" },
              {
                label: "Foro",
                value: [companyProfile.jurisdictionCity, companyProfile.jurisdictionState].filter(Boolean).join(" / ") || "Nao definido"
              }
            ]}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileDialog("legal")}
                disabled={!permissions.canManageWorkspace}
              >
                Editar dados legais
              </Button>
            }
          />
        </div>
      </section>

      <section className="general-settings__billing-connect">
        <header>
          <SettingsSectionHeading
            eyebrow="Cobranca Connect"
            title="Status e verificacao da conta Stripe"
            description="Status e verificacao da conta Stripe usada para receber pagamentos. Os dados legais vem do Workspace; a Stripe pode solicitar informacoes adicionais de compliance."
          />
        </header>

        <div className="general-settings__billing-status general-settings__billing-status--compact">
          {connectLoadState === "loading" ? (
            <p>Carregando status da conta Connect...</p>
          ) : null}
          {connectLoadState === "missing" ? (
            <p className="general-settings__billing-warning">
              Conta Connect ainda nao iniciada. Vamos usar os dados legais do workspace para iniciar o pre-cadastro.
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
                  <strong>Sim</strong>
                  Conta Connect criada
                </span>
                <span>
                  <strong>{connectStatus.chargesEnabled ? "Sim" : "Nao"}</strong>
                  Cobrancas habilitadas
                </span>
                <span>
                  <strong>{connectStatus.payoutsEnabled ? "Sim" : "Nao"}</strong>
                  Repasses habilitados
                </span>
                <span>
                  <strong>{connectStatus.requirementsDue.length + connectStatus.requirementsPastDue.length}</strong>
                  Pendencias cadastrais
                </span>
              </div>
            </>
          ) : null}
        </div>

        <div className="general-settings__billing-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConnectDetailsOpen(true)}
          >
            Ver detalhes
          </Button>
          <Button
            type="button"
            onClick={() => void handleOpenConnectOnboarding()}
            disabled={!canManageSensitiveConnectSettings || isOpeningOnboarding}
            title={!canManageSensitiveConnectSettings ? sensitiveConnectSettingsPermissionMessage : undefined}
          >
            {isOpeningOnboarding ? "Abrindo..." : connectStatus ? "Completar verificacao na Stripe" : "Continuar cadastro de cobranca"}
          </Button>
        </div>
      </section>

      {profileDialog === "identity" ? (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) closeProfileDialog();
          }}
          title="Editar identidade do workspace"
          description="Atualize nome, chave, descricao e informacoes publicas do workspace."
          className="general-settings__settings-dialog"
          bodyClassName="general-settings__settings-dialog-body"
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeProfileDialog} disabled={isSavingWorkspaceProfile}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="workspace-identity-form"
                disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile || isSavingCompanyProfile}
              >
                {isSavingWorkspaceProfile || isSavingCompanyProfile ? "Salvando..." : "Salvar dados"}
              </Button>
            </>
          }
        >
          <AppForm
            id="workspace-identity-form"
            form={workspaceProfileForm}
            onSubmit={async (values) => {
              const saved = await handleSaveAll(values);
              if (saved) closeProfileDialog();
            }}
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
              <AppFormField label="Empresa" error={workspaceProfileForm.formState.errors.companyProfile?.name?.message}>
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
                  rows={4}
                  disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile}
                />
              </AppFormField>
            </div>
          </AppForm>
        </AppDialog>
      ) : null}

      {profileDialog === "legal" ? (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) closeProfileDialog();
          }}
          title="Editar dados legais"
          description="Dados usados em propostas, contratos, fiscal e pre-cadastro Stripe Connect."
          className="general-settings__settings-dialog general-settings__settings-dialog--wide"
          bodyClassName="general-settings__settings-dialog-body"
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeProfileDialog} disabled={isSavingCompanyProfile}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="workspace-legal-form"
                disabled={!permissions.canManageWorkspace || isSavingWorkspaceProfile || isSavingCompanyProfile}
              >
                {isSavingWorkspaceProfile || isSavingCompanyProfile ? "Salvando..." : "Salvar dados legais"}
              </Button>
            </>
          }
        >
          <AppForm
            id="workspace-legal-form"
            form={workspaceProfileForm}
            onSubmit={async (values) => {
              const saved = await handleSaveAll(values);
              if (saved) closeProfileDialog();
            }}
            className="general-settings__workspace-profile-form"
            disabled={!permissions.canManageWorkspace}
            loading={isSavingWorkspaceProfile || isSavingCompanyProfile}
          >
            <div className="general-settings__workspace-profile-grid">
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
              <AppFormField label="Tipo de negocio" error={workspaceProfileForm.formState.errors.companyProfile?.businessType?.message}>
                <AppSelect
                  value={companyProfile.businessType || "company"}
                  onValueChange={(value) =>
                    workspaceProfileForm.setValue("companyProfile.businessType", value as "individual" | "company" | "corporate", {
                      shouldDirty: true,
                      shouldValidate: true
                    })
                  }
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                  aria-label="Tipo de negocio"
                  items={[
                    { value: "company", label: "Empresa" },
                    { value: "individual", label: "Pessoa fisica" },
                    { value: "corporate", label: "Corporativo" }
                  ]}
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
                  placeholder="Endereco completo usado em propostas e contratos."
                  rows={3}
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="Endereco para pre-cadastro Stripe" error={workspaceProfileForm.formState.errors.companyProfile?.addressLine1?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.addressLine1")}
                  placeholder="Logradouro e numero"
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="Complemento" error={workspaceProfileForm.formState.errors.companyProfile?.addressLine2?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.addressLine2")}
                  placeholder="Sala, bloco, andar"
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="Cidade" error={workspaceProfileForm.formState.errors.companyProfile?.city?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.city")}
                  placeholder="Ex.: Sao Paulo"
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="Estado" error={workspaceProfileForm.formState.errors.companyProfile?.state?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.state")}
                  placeholder="Ex.: SP"
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="CEP" error={workspaceProfileForm.formState.errors.companyProfile?.postalCode?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.postalCode")}
                  placeholder="Ex.: 01310-100"
                  disabled={!permissions.canManageWorkspace || isSavingCompanyProfile}
                />
              </AppFormField>
              <AppFormField label="Pais" error={workspaceProfileForm.formState.errors.companyProfile?.country?.message}>
                <TextInput
                  {...workspaceProfileForm.register("companyProfile.country")}
                  placeholder="BR"
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
          </AppForm>
        </AppDialog>
      ) : null}

      {isPreferencesDialogOpen ? (
        <AppDialog
          open
          onOpenChange={setIsPreferencesDialogOpen}
          title="Editar preferencias iniciais"
          description="Ajuste a primeira perspectiva e o formato de data do workspace."
          className="general-settings__settings-dialog"
          bodyClassName="general-settings__settings-dialog-body"
        >
          <div className="general-settings__form-grid general-settings__form-grid--dialog">
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
        </AppDialog>
      ) : null}

      {isConnectDetailsOpen ? (
        <AppDialog
          open
          onOpenChange={setIsConnectDetailsOpen}
          title="Detalhes da cobranca Connect"
          description={`Status atual: ${connectSummaryLabel}. Proximo passo: ${nextOnboardingAction}`}
          className="general-settings__settings-dialog general-settings__settings-dialog--wide"
          bodyClassName="general-settings__settings-dialog-body"
          footer={
            <Button
              type="button"
              onClick={() => void handleOpenConnectOnboarding()}
              disabled={!canManageSensitiveConnectSettings || isOpeningOnboarding}
              title={!canManageSensitiveConnectSettings ? sensitiveConnectSettingsPermissionMessage : undefined}
            >
              {isOpeningOnboarding ? "Abrindo..." : connectStatus ? "Completar verificacao na Stripe" : "Continuar cadastro de cobranca"}
            </Button>
          }
        >
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
        </AppDialog>
      ) : null}

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
