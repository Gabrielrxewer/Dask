import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mergeCardFieldDefinitions } from "@/entities/task";
import {
  buildOnboardingChecklist,
  getNextOnboardingAction,
  useConnectAccountQuery,
  useCreateConnectAccountMutation
} from "@/modules/billing";
import type { ConnectAccountStatus } from "@/modules/billing";
import {
  useUpdateWorkspaceProfileMutation,
  useWorkspace,
  useWorkspaceListQuery,
  useWorkspaceProfileQuery,
  useWorkspaceTemplatesQuery
} from "@/modules/workspace";
import type { WorkspaceTemplateOption } from "@/modules/workspace/model";
import { buildWorkspaceSettingsMembersPath, buildWorkspaceSelectorPath } from "@/app/router";
import { isApiError } from "@/shared/api/http-client";
import { AppDialog, AppSelect, Button, FormField, Textarea, TextInput, toast } from "@/shared/ui";
import "./general-settings.css";

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
};

type CompanyProfileForm = {
  name: string;
  legalName: string;
  document: string;
  address: string;
  jurisdictionCity: string;
  jurisdictionState: string;
  noticePeriod: string;
};

const emptyCompanyProfile: CompanyProfileForm = {
  name: "",
  legalName: "",
  document: "",
  address: "",
  jurisdictionCity: "",
  jurisdictionState: "",
  noticePeriod: ""
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
  const { snapshot, updatePreferences, resetWorkspaceTemplate } = useWorkspace();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplateOption["key"] | "">("");
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const [templateToConfirm, setTemplateToConfirm] = useState<WorkspaceTemplateOption | null>(null);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [workspaceKeyDraft, setWorkspaceKeyDraft] = useState("");
  const [workspaceDescriptionDraft, setWorkspaceDescriptionDraft] = useState("");
  const [workspaceCompanyDraft, setWorkspaceCompanyDraft] = useState("");
  const [workspaceWebsiteDraft, setWorkspaceWebsiteDraft] = useState("");
  const [isSavingWorkspaceProfile, setIsSavingWorkspaceProfile] = useState(false);
  const settings = (snapshot?.preferences.settings as Record<string, unknown> | undefined) ?? {};
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileForm>(() => readCompanyProfile(settings));
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectLoadState, setConnectLoadState] = useState<"idle" | "loading" | "missing" | "ready" | "error">("idle");
  const [isOpeningOnboarding, setIsOpeningOnboarding] = useState(false);
  const workspaceListQuery = useWorkspaceListQuery();
  const templatesQuery = useWorkspaceTemplatesQuery();
  const workspaceProfileQuery = useWorkspaceProfileQuery(workspaceSlug);
  const updateWorkspaceProfileMutation = useUpdateWorkspaceProfileMutation(workspaceSlug);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const workspaceProfile = workspaceProfileQuery.data ?? null;
  const isLoadingTemplates = templatesQuery.isLoading;
  const isCorporateWorkspace = workspaceListQuery.data?.find(workspace => workspace.slug === workspaceSlug)?.kind === "CORPORATE";
  const connectAccountQuery = useConnectAccountQuery(workspaceProfile?.id);
  const connectOnboardingMutation = useCreateConnectAccountMutation(workspaceProfile?.id);
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
    setCompanyProfile(readCompanyProfile(settings));
  }, [snapshot?.preferences.settings]);

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
    if (!workspaceProfile) {
      return;
    }

    setWorkspaceNameDraft(workspaceProfile.name);
    setWorkspaceKeyDraft(workspaceProfile.key);
    setWorkspaceDescriptionDraft(workspaceProfile.info.description);
    setWorkspaceCompanyDraft(workspaceProfile.info.company);
    setWorkspaceWebsiteDraft(workspaceProfile.info.website);
  }, [workspaceProfile]);

  const members = useMemo(() => Object.values(snapshot?.membersById ?? {}), [snapshot?.membersById]);
  const adminsCount = useMemo(
    () => members.filter(member => member.role === "OWNER" || member.role === "ADMIN").length,
    [members]
  );

  const handleResetTemplate = async (template: WorkspaceTemplateOption) => {
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

  const handleSaveAll = async () => {
    const normalizedName = workspaceNameDraft.trim();
    const normalizedKey = workspaceKeyDraft.trim().toUpperCase();

    if (normalizedName.length < 2) {
      toast.error("O nome do workspace precisa ter pelo menos 2 caracteres.");
      return;
    }

    if (normalizedKey.length < 2) {
      toast.error("A chave do workspace precisa ter pelo menos 2 caracteres.");
      return;
    }

    const nextProfile = {
      name: companyProfile.name.trim(),
      legalName: companyProfile.legalName.trim(),
      document: companyProfile.document.trim(),
      address: companyProfile.address.trim(),
      jurisdictionCity: companyProfile.jurisdictionCity.trim(),
      jurisdictionState: companyProfile.jurisdictionState.trim(),
      noticePeriod: companyProfile.noticePeriod.trim()
    };

    setIsSavingWorkspaceProfile(true);
    setIsSavingCompanyProfile(true);

    try {
      const [updated] = await Promise.all([
        updateWorkspaceProfileMutation.mutateAsync({
          name: normalizedName,
          key: normalizedKey,
          info: {
            description: workspaceDescriptionDraft.trim(),
            company: workspaceCompanyDraft.trim(),
            website: workspaceWebsiteDraft.trim()
          }
        }),
        updatePreferences({
          settings: {
            ...settings,
            companyProfile: nextProfile
          }
        })
      ]);

      setWorkspaceNameDraft(updated.name);
      setWorkspaceKeyDraft(updated.key);
      setWorkspaceDescriptionDraft(updated.info.description);
      setWorkspaceCompanyDraft(updated.info.company);
      setWorkspaceWebsiteDraft(updated.info.website);
      toast.success("Dados salvos.");
    } catch {
      toast.error("Nao foi possivel salvar agora. Tente novamente.");
    } finally {
      setIsSavingWorkspaceProfile(false);
      setIsSavingCompanyProfile(false);
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
                  disabled={isLoadingTemplates || isResettingTemplate}
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
                disabled={perspectives.length === 0}
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
        <div className="general-settings__workspace-profile-grid">
          <FormField label="Nome do workspace">
            <TextInput
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              placeholder="Ex.: Produto Core"
            />
          </FormField>
          <FormField label="Chave do workspace (A-Z e 0-9)">
            <TextInput
              value={workspaceKeyDraft}
              onChange={(event) => setWorkspaceKeyDraft(event.target.value.toUpperCase())}
              placeholder="PRODCORE"
            />
          </FormField>
          <FormField label="Website">
            <TextInput
              value={workspaceWebsiteDraft}
              onChange={(event) => setWorkspaceWebsiteDraft(event.target.value)}
              placeholder="https://suaempresa.com"
            />
          </FormField>
          <FormField label="Descricao" className="general-settings__field--full">
            <Textarea
              value={workspaceDescriptionDraft}
              onChange={(event) => setWorkspaceDescriptionDraft(event.target.value)}
              placeholder="Resumo da area, objetivo ou contexto deste workspace."
              rows={3}
            />
          </FormField>

          <div className="general-settings__form-divider">
            <span>Dados legais da contratada</span>
          </div>

          <FormField label="Nome fantasia / empresa">
            <TextInput
              value={companyProfile.name}
              onChange={(event) => {
                const value = event.target.value;
                setCompanyProfile(current => ({ ...current, name: value }));
                setWorkspaceCompanyDraft(value);
              }}
              placeholder="Ex.: Dask Labs"
            />
          </FormField>
          <FormField label="Razao social / nome legal">
            <TextInput
              value={companyProfile.legalName}
              onChange={(event) => setCompanyProfile(current => ({ ...current, legalName: event.target.value }))}
              placeholder="Ex.: Dask Labs Tecnologia Ltda"
            />
          </FormField>
          <FormField label="CPF / CNPJ">
            <TextInput
              value={companyProfile.document}
              onChange={(event) => setCompanyProfile(current => ({ ...current, document: event.target.value }))}
              placeholder="Ex.: 00.000.000/0001-00"
            />
          </FormField>
          <FormField label="Aviso previo padrao (dias)">
            <TextInput
              value={companyProfile.noticePeriod}
              onChange={(event) => setCompanyProfile(current => ({ ...current, noticePeriod: event.target.value }))}
              placeholder="Ex.: 30"
            />
          </FormField>
          <FormField label="Endereco da contratada" className="general-settings__field--full">
            <Textarea
              value={companyProfile.address}
              onChange={(event) => setCompanyProfile(current => ({ ...current, address: event.target.value }))}
              placeholder="Logradouro, numero, complemento, cidade, estado, CEP"
              rows={3}
            />
          </FormField>
          <FormField label="Cidade do foro">
            <TextInput
              value={companyProfile.jurisdictionCity}
              onChange={(event) => setCompanyProfile(current => ({ ...current, jurisdictionCity: event.target.value }))}
              placeholder="Ex.: Sao Paulo"
            />
          </FormField>
          <FormField label="Estado do foro">
            <TextInput
              value={companyProfile.jurisdictionState}
              onChange={(event) => setCompanyProfile(current => ({ ...current, jurisdictionState: event.target.value }))}
              placeholder="Ex.: SP"
            />
          </FormField>
        </div>
        <div className="general-settings__workspace-profile-actions">
          <Button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={isSavingWorkspaceProfile || isSavingCompanyProfile}
          >
            {isSavingWorkspaceProfile || isSavingCompanyProfile ? "Salvando..." : "Salvar"}
          </Button>
          {workspaceProfile?.kind ? <small>Tipo: {workspaceProfile.kind}</small> : null}
        </div>
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
          <Button type="button" onClick={() => void handleOpenConnectOnboarding()} disabled={isOpeningOnboarding}>
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
                disabled={isResettingTemplate}
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
