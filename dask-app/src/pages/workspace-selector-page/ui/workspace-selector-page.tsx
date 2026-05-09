import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath } from "@/app/router";
import { billingStore, useBilling } from "@/modules/billing";
import { workspaceService, type WorkspaceSummary, type WorkspaceTemplateOption } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { Button, Card, FormField, ModalShell, Select, Textarea, TextInput } from "@/shared/ui";
import "../../no-workspace-page/ui/no-workspace-page.css";
import "./workspace-selector-page.css";

type WorkspaceKind = "PERSONAL" | "CORPORATE";
type WorkspaceSelectorView = "select" | "create";

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

function makeWorkspaceKeyDraft(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 20);
}

function hasCompanyProfileData(profile: CompanyProfileForm) {
  return Object.values(profile).some((value) => value.trim().length > 0);
}

export function WorkspaceSelectorPage() {
  const navigate = useNavigate();
  const billing = useBilling();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [templates, setTemplates] = useState<WorkspaceTemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [view, setView] = useState<WorkspaceSelectorView>("select");
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<WorkspaceKind>("PERSONAL");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceKey, setWorkspaceKey] = useState("");
  const [isWorkspaceKeyDirty, setIsWorkspaceKeyDirty] = useState(false);
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceWebsite, setWorkspaceWebsite] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileForm>(emptyCompanyProfile);
  const [templateKey, setTemplateKey] = useState<WorkspaceTemplateOption["key"] | "">("");
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState<WorkspaceSummary | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const canCreateWorkspace = billing.status?.canCreateWorkspace ?? false;

  useEffect(() => {
    if (billing.loadState === "idle") {
      void billingStore.load();
    }
  }, [billing.loadState]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    workspaceService
      .listWorkspaces()
      .then((items) => {
        if (!mounted) {
          return;
        }
        setWorkspaces(items);
      })
      .catch(() => {
        if (mounted) {
          setError("Nao foi possivel carregar seus workspaces agora.");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canCreateWorkspace) {
      setTemplates([]);
      setIsLoadingTemplates(false);
      return;
    }

    let mounted = true;
    setIsLoadingTemplates(true);

    workspaceService
      .listWorkspaceTemplates()
      .then((items) => {
        if (!mounted) {
          return;
        }
        setTemplates(items);
        if (items[0]?.key) {
          setTemplateKey(items[0].key);
        }
      })
      .catch(() => {
        if (mounted) {
          setTemplates([]);
          setTemplateKey("");
          setCreateError("Nao foi possivel carregar o catalogo de templates.");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingTemplates(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canCreateWorkspace]);

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

  const availableTemplates = templates;
  const deleteConfirmationMatches = workspacePendingDelete
    ? deleteConfirmation.trim() === workspacePendingDelete.name
    : false;
  const isCreateView = view === "create";

  useEffect(() => {
    if (isWorkspaceKeyDirty) {
      return;
    }

    setWorkspaceKey(makeWorkspaceKeyDraft(workspaceName));
  }, [isWorkspaceKeyDirty, workspaceName]);

  const reloadWorkspaces = async () => {
    const refreshed = await workspaceService.listWorkspaces();
    setWorkspaces(refreshed);
  };

  const handleOpenDeleteWorkspace = (workspace: WorkspaceSummary) => {
    setWorkspacePendingDelete(workspace);
    setDeleteConfirmation("");
    setDeleteError(null);
    setDeleteFeedback(null);
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
    setCreateError(null);
    setCreateFeedback(null);
    setDeleteFeedback(null);
  };

  const handleBackToSelection = () => {
    if (isCreating) {
      return;
    }

    setView("select");
    setCreateError(null);
  };

  const handleCreateWorkspace = async () => {
    const normalizedName = workspaceName.trim();
    const normalizedKey = workspaceKey.trim().toUpperCase();
    const normalizedCompanyName = companyProfile.name.trim();
    const normalizedWebsite = workspaceWebsite.trim();

    if (normalizedName.length < 2) {
      setCreateError("Informe um nome de workspace com pelo menos 2 caracteres.");
      setCreateFeedback(null);
      return;
    }

    if (normalizedKey.length < 2) {
      setCreateError("Informe uma chave de workspace com pelo menos 2 caracteres.");
      setCreateFeedback(null);
      return;
    }

    if (kind === "CORPORATE" && normalizedCompanyName.length < 2) {
      setCreateError("Informe o nome da empresa ou organizacao para workspace corporativo.");
      setCreateFeedback(null);
      return;
    }

    if (!templateKey) {
      setCreateError("Selecione um template carregado pelo backend.");
      setCreateFeedback(null);
      return;
    }

    if (normalizedWebsite.length > 0 && !/^https?:\/\/\S+\.\S+/.test(normalizedWebsite)) {
      setCreateError("Informe um website valido com http:// ou https://.");
      setCreateFeedback(null);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateFeedback(null);
    setDeleteFeedback(null);

    try {
      const created = await workspaceService.provisionWorkspace({
        kind,
        workspaceName: normalizedName,
        workspaceKey: normalizedKey,
        templateKey,
        organizationName: kind === "CORPORATE" ? normalizedCompanyName : undefined
      });

      const profileInfo: { description?: string; company?: string; website?: string } = {};
      const normalizedDescription = workspaceDescription.trim();
      if (normalizedDescription.length > 0) {
        profileInfo.description = normalizedDescription;
      }
      if (normalizedCompanyName.length > 0) {
        profileInfo.company = normalizedCompanyName;
      }
      if (normalizedWebsite.length > 0) {
        profileInfo.website = normalizedWebsite;
      }

      const postCreateRequests: Promise<unknown>[] = [];
      if (Object.keys(profileInfo).length > 0) {
        postCreateRequests.push(
          workspaceService.updateWorkspaceProfile(created.slug, {
            name: normalizedName,
            key: normalizedKey,
            info: profileInfo
          })
        );
      }

      if (hasCompanyProfileData(companyProfile)) {
        postCreateRequests.push(
          workspaceService.updatePreferences(created.slug, {
            settings: {
              companyProfile: {
                name: normalizedCompanyName,
                legalName: companyProfile.legalName.trim(),
                document: companyProfile.document.trim(),
                address: companyProfile.address.trim(),
                jurisdictionCity: companyProfile.jurisdictionCity.trim(),
                jurisdictionState: companyProfile.jurisdictionState.trim(),
                noticePeriod: companyProfile.noticePeriod.trim()
              }
            }
          })
        );
      }

      if (postCreateRequests.length > 0) {
        await Promise.all(postCreateRequests);
      }

      await reloadWorkspaces();
      setCreateFeedback(`Workspace ${created.name} criado com sucesso.`);
      setWorkspaceName("");
      setWorkspaceKey("");
      setIsWorkspaceKeyDirty(false);
      setWorkspaceDescription("");
      setWorkspaceWebsite("");
      setCompanyProfile(emptyCompanyProfile);
      setView("select");
      navigate(buildWorkspaceBoardPath(created.slug));
    } catch (creationError) {
      if (isApiError(creationError)) {
        setCreateError(creationError.message);
      } else {
        setCreateError("Nao foi possivel criar o workspace agora.");
      }
      setCreateFeedback(null);
    } finally {
      setIsCreating(false);
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

    setIsDeletingWorkspace(true);
    setDeleteError(null);
    setCreateFeedback(null);

    try {
      const deletedWorkspaceName = workspacePendingDelete.name;
      await workspaceService.deleteWorkspace(workspacePendingDelete.slug);
      await reloadWorkspaces();
      setDeleteFeedback(`Workspace ${deletedWorkspaceName} excluido com sucesso.`);
      setWorkspacePendingDelete(null);
      setDeleteConfirmation("");
    } catch (deletionError) {
      if (isApiError(deletionError)) {
        setDeleteError(deletionError.message);
      } else {
        setDeleteError("Nao foi possivel excluir o workspace agora.");
      }
    } finally {
      setIsDeletingWorkspace(false);
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
                <section className="workspace-selector-page__create-card" aria-label="Cadastrar workspace">
                  <div className="workspace-selector-page__create-section">
                    <h2>Base do workspace</h2>
                    <div className="workspace-selector-page__create-grid">
                      <FormField label="Tipo">
                        <Select value={kind} onChange={(event) => setKind(event.target.value as WorkspaceKind)}>
                          <option value="PERSONAL">Pessoal</option>
                          <option value="CORPORATE">Corporativo</option>
                        </Select>
                      </FormField>
                      <FormField label="Template">
                        <Select
                          value={templateKey}
                          onChange={(event) => setTemplateKey(event.target.value as WorkspaceTemplateOption["key"])}
                          disabled={isLoadingTemplates || availableTemplates.length === 0}
                        >
                          {isLoadingTemplates ? <option value="">Carregando templates...</option> : null}
                          {!isLoadingTemplates && availableTemplates.length === 0 ? <option value="">Catalogo indisponivel</option> : null}
                          {availableTemplates.map((template) => (
                            <option key={template.key} value={template.key}>
                              {template.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Nome do workspace">
                        <TextInput
                          value={workspaceName}
                          onChange={(event) => setWorkspaceName(event.target.value)}
                          placeholder="Ex.: Produto Core"
                        />
                      </FormField>
                      <FormField label="Chave do workspace">
                        <TextInput
                          value={workspaceKey}
                          onChange={(event) => {
                            setIsWorkspaceKeyDirty(true);
                            setWorkspaceKey(makeWorkspaceKeyDraft(event.target.value));
                          }}
                          placeholder="PRODCORE"
                        />
                      </FormField>
                      <FormField label="Website" className="workspace-selector-page__field--wide">
                        <TextInput
                          value={workspaceWebsite}
                          onChange={(event) => setWorkspaceWebsite(event.target.value)}
                          placeholder="https://suaempresa.com"
                        />
                      </FormField>
                      <FormField label="Descricao" className="workspace-selector-page__field--wide">
                        <Textarea
                          value={workspaceDescription}
                          onChange={(event) => setWorkspaceDescription(event.target.value)}
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
                        <TextInput
                          value={companyProfile.name}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Ex.: Dask Labs"
                        />
                      </FormField>
                      <FormField label="Razao social / nome legal">
                        <TextInput
                          value={companyProfile.legalName}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, legalName: event.target.value }))
                          }
                          placeholder="Ex.: Dask Labs Tecnologia Ltda"
                        />
                      </FormField>
                      <FormField label="CPF / CNPJ">
                        <TextInput
                          value={companyProfile.document}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, document: event.target.value }))
                          }
                          placeholder="Ex.: 00.000.000/0001-00"
                        />
                      </FormField>
                      <FormField label="Aviso previo padrao (dias)">
                        <TextInput
                          value={companyProfile.noticePeriod}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, noticePeriod: event.target.value }))
                          }
                          placeholder="Ex.: 30"
                        />
                      </FormField>
                      <FormField label="Endereco da contratada" className="workspace-selector-page__field--wide">
                        <Textarea
                          value={companyProfile.address}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, address: event.target.value }))
                          }
                          placeholder="Logradouro, numero, complemento, cidade, estado, CEP"
                          rows={3}
                        />
                      </FormField>
                      <FormField label="Cidade do foro">
                        <TextInput
                          value={companyProfile.jurisdictionCity}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, jurisdictionCity: event.target.value }))
                          }
                          placeholder="Ex.: Sao Paulo"
                        />
                      </FormField>
                      <FormField label="Estado do foro">
                        <TextInput
                          value={companyProfile.jurisdictionState}
                          onChange={(event) =>
                            setCompanyProfile((current) => ({ ...current, jurisdictionState: event.target.value }))
                          }
                          placeholder="Ex.: SP"
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="workspace-selector-page__create-actions">
                    <div className="workspace-selector-page__create-action-feedback">
                      {createFeedback ? <p className="workspace-selector-page__feedback">{createFeedback}</p> : null}
                      {createError ? <p className="workspace-selector-page__error">{createError}</p> : null}
                    </div>
                    <Button
                      className="workspace-selector-page__create-submit"
                      type="button"
                      variant="primary"
                      onClick={() => void handleCreateWorkspace()}
                      disabled={isCreating || isLoadingTemplates || !templateKey}
                    >
                      {isCreating ? "Criando..." : "Criar workspace"}
                    </Button>
                  </div>
                </section>
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
                    disabled={!canCreateWorkspace}
                  >
                    {!canCreateWorkspace ? "Criacao indisponivel" : "Criar novo workspace"}
                  </Button>
                </div>
              </div>

              {!canCreateWorkspace ? (
                <p className="workspace-selector-page__state">
                  Sua conta foi convidada para workspaces existentes e nao pode criar um workspace proprio sem assinatura.
                </p>
              ) : null}

              {isLoading ? <p className="workspace-selector-page__state">Carregando workspaces...</p> : null}
              {error ? <p className="workspace-selector-page__error">{error}</p> : null}
              {deleteFeedback ? (
                <p className="workspace-selector-page__feedback workspace-selector-page__feedback--banner">
                  {deleteFeedback}
                </p>
              ) : null}

              {!isLoading && !error && filtered.length === 0 ? (
                <p className="workspace-selector-page__state">Nenhum workspace encontrado.</p>
              ) : null}

              {!isLoading && !error && filtered.length > 0 ? (
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
        <ModalShell
          titleId="workspace-delete-title"
          className="workspace-selector-page__delete-modal"
          onClose={handleCloseDeleteWorkspace}
        >
          <div className="workspace-selector-page__delete-dialog">
            <header className="workspace-selector-page__delete-header">
              <p className="workspace-selector-page__delete-eyebrow">Excluir workspace</p>
              <h2 id="workspace-delete-title" className="workspace-selector-page__delete-title">
                Confirmar exclusao permanente
              </h2>
              <p className="workspace-selector-page__delete-description">
                Essa acao remove o workspace, boards, documentos, automacoes e configuracoes vinculadas. Nao existe
                restauracao automatica depois da exclusao.
              </p>
            </header>

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
              >
                {isDeletingWorkspace ? "Excluindo..." : "Excluir workspace"}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </main>
  );
}
