import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath } from "@/app/router";
import { billingStore, useBilling } from "@/modules/billing";
import { workspaceService, type WorkspaceSummary, type WorkspaceTemplateOption } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { Button, Card, FormField, Select, TextInput } from "@/shared/ui";
import "../../no-workspace-page/ui/no-workspace-page.css";
import "./workspace-selector-page.css";

type WorkspaceKind = "PERSONAL" | "CORPORATE";

const FALLBACK_TEMPLATES: WorkspaceTemplateOption[] = [
  { key: "software_delivery", name: "Software Delivery", description: "Template padrao" },
  { key: "product_discovery", name: "Product Discovery", description: "Template de descoberta" },
  { key: "operations_kanban", name: "Operations Kanban", description: "Template operacional" }
];

export function WorkspaceSelectorPage() {
  const navigate = useNavigate();
  const billing = useBilling();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [templates, setTemplates] = useState<WorkspaceTemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<WorkspaceKind>("PERSONAL");
  const [workspaceName, setWorkspaceName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [templateKey, setTemplateKey] = useState<WorkspaceTemplateOption["key"]>("software_delivery");
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
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
          setTemplates(FALLBACK_TEMPLATES);
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

  const availableTemplates = templates.length > 0 ? templates : FALLBACK_TEMPLATES;

  const reloadWorkspaces = async () => {
    const refreshed = await workspaceService.listWorkspaces();
    setWorkspaces(refreshed);
  };

  const handleCreateWorkspace = async () => {
    const normalizedName = workspaceName.trim();
    if (normalizedName.length < 2) {
      setCreateError("Informe um nome de workspace com pelo menos 2 caracteres.");
      setCreateFeedback(null);
      return;
    }

    const normalizedOrg = organizationName.trim();
    if (kind === "CORPORATE" && normalizedOrg.length < 2) {
      setCreateError("Informe o nome da organizacao para workspace corporativo.");
      setCreateFeedback(null);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateFeedback(null);

    try {
      const created = await workspaceService.provisionWorkspace({
        kind,
        workspaceName: normalizedName,
        templateKey,
        organizationName: kind === "CORPORATE" ? normalizedOrg : undefined
      });

      await reloadWorkspaces();
      setCreateFeedback(`Workspace ${created.name} criado com sucesso.`);
      setWorkspaceName("");
      setOrganizationName("");
      setIsCreateOpen(false);
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

  return (
    <main className="no-workspace-page workspace-selector-page">
      <div className="no-workspace-page__backdrop" aria-hidden="true" />
      <section className="no-workspace-page__shell workspace-selector-page__shell" aria-label="Selecionar workspace">
        <Card className="no-workspace-page__card workspace-selector-page__card">
          <header className="no-workspace-page__header">
            <p className="no-workspace-page__eyebrow">Trocar workspace</p>
            <h1 className="no-workspace-page__title">Selecione onde voce quer trabalhar</h1>
            <p className="no-workspace-page__description">
              Voce pode participar de varios workspaces. Escolha um para abrir o board.
            </p>
          </header>

          <div
            className={`no-workspace-page__actions workspace-selector-page__toolbar${
              isCreateOpen ? " workspace-selector-page__toolbar--create-open" : ""
            }`}
          >
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, slug ou chave"
            />
            <div className="workspace-selector-page__toolbar-actions">
              <Button
                className="no-workspace-page__secondary"
                type="button"
                onClick={() => setIsCreateOpen((current) => !current)}
                disabled={!canCreateWorkspace}
              >
                {!canCreateWorkspace ? "Criacao indisponivel" : isCreateOpen ? "Fechar criacao" : "Criar novo workspace"}
              </Button>
              {isCreateOpen ? (
                <Button type="button" onClick={() => void handleCreateWorkspace()} disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar workspace"}
                </Button>
              ) : null}
            </div>
          </div>

          {!canCreateWorkspace ? (
            <p className="workspace-selector-page__state">
              Sua conta foi convidada para workspaces existentes e nao pode criar um workspace proprio sem assinatura.
            </p>
          ) : null}

          {isCreateOpen && canCreateWorkspace ? (
            <section className="workspace-selector-page__create-card" aria-label="Criar workspace">
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
                    disabled={isLoadingTemplates}
                  >
                    {availableTemplates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Nome do workspace" className="workspace-selector-page__field--wide">
                  <TextInput
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Ex.: Produto Core"
                  />
                </FormField>
                {kind === "CORPORATE" ? (
                  <FormField label="Organizacao" className="workspace-selector-page__field--wide">
                    <TextInput
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Ex.: Dask Labs"
                    />
                  </FormField>
                ) : null}
              </div>
              <div className="workspace-selector-page__create-actions">
                {createFeedback ? <p className="workspace-selector-page__feedback">{createFeedback}</p> : null}
                {createError ? <p className="workspace-selector-page__error">{createError}</p> : null}
              </div>
            </section>
          ) : null}

          {isLoading ? <p className="workspace-selector-page__state">Carregando workspaces...</p> : null}
          {error ? <p className="workspace-selector-page__error">{error}</p> : null}

          {!isLoading && !error && filtered.length === 0 ? (
            <p className="workspace-selector-page__state">Nenhum workspace encontrado.</p>
          ) : null}

          {!isLoading && !error && filtered.length > 0 ? (
            <div className="workspace-selector-page__list">
              {filtered.map((workspace) => (
                <article key={workspace.id} className="workspace-selector-page__workspace">
                  <div className="workspace-selector-page__workspace-copy">
                    <strong>{workspace.name}</strong>
                    <span>{workspace.kind === "CORPORATE" ? "Corporativo" : "Pessoal"} · {workspace.role}</span>
                    <small>{workspace.slug}</small>
                  </div>
                  <Button
                    className="no-workspace-page__secondary"
                    type="button"
                    onClick={() => navigate(buildWorkspaceBoardPath(workspace.slug))}
                  >
                    Entrar
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
