import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { factoryBoardConfig, mergeCardFieldDefinitions } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type { WorkspaceProfile, WorkspaceTemplateOption } from "@/modules/workspace/model";
import { buildWorkspaceSettingsMembersPath, buildWorkspaceSelectorPath } from "@/app/router";
import { Button, FormField, Select, Textarea, TextInput } from "@/shared/ui";
import "./general-settings.css";

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
};

const FALLBACK_TEMPLATES: WorkspaceTemplateOption[] = [
  {
    key: "software_delivery",
    name: "Entrega de software",
    description: "Backlog, execucao, revisao e pronto."
  },
  {
    key: "product_discovery",
    name: "Descoberta de produto",
    description: "Oportunidades, hipoteses e experimentos."
  },
  {
    key: "operations_kanban",
    name: "Operacoes",
    description: "Fila, triagem, execucao e resolucao."
  }
];

const TEMPLATE_PREVIEWS: Record<WorkspaceTemplateOption["key"], string[]> = {
  software_delivery: ["Backlog", "Execucao", "Review", "Done"],
  product_discovery: ["Ideias", "Hipoteses", "Experimentos", "Validados"],
  operations_kanban: ["Fila", "Triagem", "Execucao", "Resolvido"]
};

const TEMPLATE_ACCENTS: Record<WorkspaceTemplateOption["key"], string> = {
  software_delivery: "#0a86e8",
  product_discovery: "#7d61ee",
  operations_kanban: "#0f9f98"
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

  return fromViews.length > 0 ? fromViews : [{ id: "dev", label: "DEV", caption: "Fluxo principal" }];
}

function statusLabel(count: number, minimum: number): "empty" | "partial" | "done" {
  if (count === 0) return "empty";
  if (count < minimum) return "partial";
  return "done";
}

function getTemplatePreview(templateKey: WorkspaceTemplateOption["key"]): string[] {
  return TEMPLATE_PREVIEWS[templateKey] ?? ["Inicio", "Em andamento", "Finalizado"];
}

export function GeneralSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot, updatePreferences, resetWorkspaceTemplate } = useWorkspace();
  const [templates, setTemplates] = useState<WorkspaceTemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplateOption["key"]>("software_delivery");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);
  const [templateToConfirm, setTemplateToConfirm] = useState<WorkspaceTemplateOption | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [workspaceKeyDraft, setWorkspaceKeyDraft] = useState("");
  const [workspaceDescriptionDraft, setWorkspaceDescriptionDraft] = useState("");
  const [workspaceCompanyDraft, setWorkspaceCompanyDraft] = useState("");
  const [workspaceWebsiteDraft, setWorkspaceWebsiteDraft] = useState("");
  const [isSavingWorkspaceProfile, setIsSavingWorkspaceProfile] = useState(false);

  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const perspectives = useMemo(() => resolvePerspectives(rawBoardConfig), [rawBoardConfig]);
  const statuses = Array.isArray(rawBoardConfig.statuses) ? rawBoardConfig.statuses : factoryBoardConfig.statuses;
  const itemTypes = Array.isArray(rawBoardConfig.taskTypes) ? rawBoardConfig.taskTypes : factoryBoardConfig.taskTypes;
  const fields = mergeCardFieldDefinitions(
    Array.isArray(rawBoardConfig.fieldDefinitions) ? rawBoardConfig.fieldDefinitions : []
  );
  const tasksCount = snapshot?.tasks.length ?? 0;
  const defaultMode = snapshot?.preferences.defaultBoardMode ?? perspectives[0]?.id ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";
  const availableTemplates = templates.length > 0 ? templates : FALLBACK_TEMPLATES;

  const stepStates = {
    perspectives: statusLabel(perspectives.length, 1),
    states: statusLabel(statuses.length, 3),
    types: statusLabel(itemTypes.length, 2),
    fields: statusLabel(fields.length, 4)
  };
  const completedSteps = Object.values(stepStates).filter(value => value === "done").length;
  const progress = Math.round((completedSteps / 4) * 100);

  useEffect(() => {
    let mounted = true;
    setIsLoadingTemplates(true);

    workspaceService
      .listWorkspaceTemplates()
      .then(options => {
        if (!mounted) return;
        setTemplates(options);
        if (options.length > 0) {
          setSelectedTemplate(current =>
            options.some(option => option.key === current) ? current : options[0].key
          );
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingTemplates(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    workspaceService
      .listWorkspaces()
      .then(workspaces => {
        if (!mounted) {
          return;
        }

        const currentWorkspace = workspaces.find(workspace => workspace.slug === workspaceSlug);
        setIsCorporateWorkspace(currentWorkspace?.kind === "CORPORATE");
      })
      .catch(() => {
        if (mounted) {
          setIsCorporateWorkspace(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    let mounted = true;

    workspaceService
      .getWorkspaceProfile(workspaceSlug)
      .then((profile) => {
        if (!mounted) {
          return;
        }
        setWorkspaceProfile(profile);
        setWorkspaceNameDraft(profile.name);
        setWorkspaceKeyDraft(profile.key);
        setWorkspaceDescriptionDraft(profile.info.description);
        setWorkspaceCompanyDraft(profile.info.company);
        setWorkspaceWebsiteDraft(profile.info.website);
      })
      .catch(() => {
        if (mounted) {
          setError("Nao foi possivel carregar os dados do workspace.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [workspaceSlug]);

  const members = useMemo(() => Object.values(snapshot?.membersById ?? {}), [snapshot?.membersById]);
  const adminsCount = useMemo(
    () => members.filter(member => member.role === "OWNER" || member.role === "ADMIN").length,
    [members]
  );

  const handleResetTemplate = async (template: WorkspaceTemplateOption) => {
    setSelectedTemplate(template.key);
    setIsResettingTemplate(true);
    setFeedback("");
    setError("");

    try {
      await resetWorkspaceTemplate(template.key);
      setFeedback(`${template.name} aplicado.`);
      setTemplateToConfirm(null);
    } catch {
      setError("Nao foi possivel aplicar o template agora.");
    } finally {
      setIsResettingTemplate(false);
    }
  };

  const handleSaveWorkspaceProfile = async () => {
    const normalizedName = workspaceNameDraft.trim();
    const normalizedKey = workspaceKeyDraft.trim().toUpperCase();

    if (normalizedName.length < 2) {
      setError("O nome do workspace precisa ter pelo menos 2 caracteres.");
      setFeedback("");
      return;
    }

    if (normalizedKey.length < 2) {
      setError("A chave do workspace precisa ter pelo menos 2 caracteres.");
      setFeedback("");
      return;
    }

    setIsSavingWorkspaceProfile(true);
    setFeedback("");
    setError("");

    try {
      const updated = await workspaceService.updateWorkspaceProfile(workspaceSlug, {
        name: normalizedName,
        key: normalizedKey,
        info: {
          description: workspaceDescriptionDraft.trim(),
          company: workspaceCompanyDraft.trim(),
          website: workspaceWebsiteDraft.trim()
        }
      });

      setWorkspaceProfile(updated);
      setWorkspaceNameDraft(updated.name);
      setWorkspaceKeyDraft(updated.key);
      setWorkspaceDescriptionDraft(updated.info.description);
      setWorkspaceCompanyDraft(updated.info.company);
      setWorkspaceWebsiteDraft(updated.info.website);
      setFeedback("Dados do workspace atualizados.");
    } catch {
      setError("Nao foi possivel salvar os dados do workspace agora.");
    } finally {
      setIsSavingWorkspaceProfile(false);
    }
  };

  return (
    <div className="general-settings">
      <section className="general-settings__builder-hero">
        <div className="general-settings__builder-copy">
          <span>Comece aqui</span>
          <h1>Monte seu sistema de trabalho visualmente.</h1>
          <p>
            Esta tela e somente o ponto de partida. Veja o estado geral do workspace, escolha um template e ajuste preferencias iniciais.
          </p>
        </div>

        <div className="general-settings__live-preview" aria-label="Preview do board">
          {statuses.map(status => (
            <div key={status.id} className="general-settings__preview-column">
              <span>
                <i style={{ background: status.dot }} />
                {status.label}
              </span>
              <div className="general-settings__preview-card">
                <strong>{itemTypes[0]?.label ?? "Work item"}</strong>
                <small>{fields[0]?.label ?? "Campo"} - prioridade media</small>
              </div>
            </div>
          ))}
        </div>

        <div className="general-settings__progress">
          <div>
            <strong>Board {progress}% configurado</strong>
            <small>{completedSteps} de 4 areas prontas</small>
          </div>
          <span><i style={{ width: `${progress}%` }} /></span>
        </div>
      </section>

      <section className="general-settings__preferences-row">
        <div className="general-settings__preference-card">
          <h2>Preferencias iniciais</h2>
          <div className="general-settings__form-grid">
            <FormField label="Perspectiva inicial">
              <Select
                value={defaultMode}
                onChange={event => void updatePreferences({ defaultBoardMode: event.target.value })}
              >
                {perspectives.map(perspective => (
                  <option key={perspective.id} value={perspective.id}>{perspective.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Formato de data">
              <Select
                value={dateFormat}
                onChange={event =>
                  void updatePreferences({
                    dateFormat: event.target.value as "dd/mm/yyyy" | "mm/dd/yyyy"
                  })
                }
              >
                <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                <option value="mm/dd/yyyy">MM/DD/YYYY</option>
              </Select>
            </FormField>
          </div>
        </div>

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
      </section>

      <section className="general-settings__workspace-profile">
        <header>
          <span>Workspace</span>
          <h2>Nome e informacoes</h2>
          <p>Defina a identidade do workspace e mantenha os dados institucionais atualizados.</p>
        </header>
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
          <FormField label="Empresa">
            <TextInput
              value={workspaceCompanyDraft}
              onChange={(event) => setWorkspaceCompanyDraft(event.target.value)}
              placeholder="Ex.: Dask Labs"
            />
          </FormField>
          <FormField label="Website">
            <TextInput
              value={workspaceWebsiteDraft}
              onChange={(event) => setWorkspaceWebsiteDraft(event.target.value)}
              placeholder="https://suaempresa.com"
            />
          </FormField>
          <FormField label="Descricao">
            <Textarea
              value={workspaceDescriptionDraft}
              onChange={(event) => setWorkspaceDescriptionDraft(event.target.value)}
              placeholder="Resumo da area, objetivo ou contexto deste workspace."
              rows={4}
            />
          </FormField>
        </div>
        <div className="general-settings__workspace-profile-actions">
          <Button type="button" onClick={() => void handleSaveWorkspaceProfile()} disabled={isSavingWorkspaceProfile}>
            {isSavingWorkspaceProfile ? "Salvando..." : "Salvar dados do workspace"}
          </Button>
          {workspaceProfile?.kind ? <small>Tipo atual: {workspaceProfile.kind}</small> : null}
        </div>
      </section>

      {feedback ? <p className="general-settings__feedback">{feedback}</p> : null}
      {error ? <p className="general-settings__error">{error}</p> : null}

      <section className="general-settings__templates">
        <header>
          <span>Templates</span>
          <h2>Comece com uma base pronta</h2>
        </header>
        <div className="general-settings__template-grid">
          {availableTemplates.map(template => (
            <article
              key={template.key}
              className={`general-settings__template-card${selectedTemplate === template.key ? " is-selected" : ""}`}
              style={{ "--template-accent": TEMPLATE_ACCENTS[template.key] } as CSSProperties}
            >
              <div className="general-settings__template-preview">
                {getTemplatePreview(template.key).map(label => (
                  <span key={`${template.key}-${label}`}>{label}</span>
                ))}
              </div>
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
        </div>
      </section>

      {templateToConfirm ? (
        <div className="general-settings__modal-backdrop" role="presentation">
          <section className="general-settings__template-modal" role="dialog" aria-modal="true" aria-labelledby="template-confirm-title">
            <div
              className="general-settings__modal-preview"
              style={{ "--template-accent": TEMPLATE_ACCENTS[templateToConfirm.key] } as CSSProperties}
            >
              {getTemplatePreview(templateToConfirm.key).map(label => (
                <span key={`modal-${templateToConfirm.key}-${label}`}>{label}</span>
              ))}
            </div>
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
          </section>
        </div>
      ) : null}
    </div>
  );
}
