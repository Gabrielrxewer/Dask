import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath, routePaths } from "@/app/router";
import { useAuth } from "@/features/auth";
import { workspaceService, type WorkspaceTemplateOption } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { Button, Card, FormField, Select, TextInput } from "@/shared/ui";
import "./no-workspace-page.css";

type WorkspaceKind = "PERSONAL" | "CORPORATE";

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toWorkspaceKey(value: string): string {
  const base = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);

  const fallback = base.length >= 2 ? base : "WORKSPACE";
  const suffix = Date.now().toString().slice(-4);
  return `${fallback}${suffix}`.slice(0, 20);
}

export function NoWorkspacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkspaceTemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const [kind, setKind] = useState<WorkspaceKind>("PERSONAL");
  const [workspaceName, setWorkspaceName] = useState("Meu Workspace");
  const [organizationName, setOrganizationName] = useState("");
  const [templateKey, setTemplateKey] = useState<WorkspaceTemplateOption["key"]>("software_delivery");

  useEffect(() => {
    let active = true;

    workspaceService
      .listWorkspaceTemplates()
      .then((items) => {
        if (!active) {
          return;
        }

        setTemplates(items);
        const firstKey = items[0]?.key;
        if (firstKey) {
          setTemplateKey(firstKey);
        }
      })
      .catch(() => {
        if (active) {
          setTemplates([]);
          setTemplateNotice("Nao foi possivel carregar o catalogo de templates. Usando preset padrao.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingTemplates(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const resolvedOrganizationName = useMemo(() => {
    if (kind !== "CORPORATE") {
      return undefined;
    }

    const trimmed = organizationName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return `${workspaceName.trim() || "Workspace"} Organization`;
  }, [kind, organizationName, workspaceName]);

  const handleCreateWorkspace = async () => {
    if (isCreating) {
      return;
    }

    const finalWorkspaceName = workspaceName.trim();
    if (finalWorkspaceName.length < 2) {
      setErrorMessage("Informe um nome de workspace com pelo menos 2 caracteres.");
      return;
    }

    if (kind === "CORPORATE" && !resolvedOrganizationName) {
      setErrorMessage("Informe o nome da organizacao para workspace corporativo.");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const workspace = await workspaceService.provisionWorkspace({
        kind,
        workspaceName: finalWorkspaceName,
        workspaceKey: toWorkspaceKey(finalWorkspaceName),
        templateKey,
        organizationName: resolvedOrganizationName,
        organizationSlug: resolvedOrganizationName ? toSlug(resolvedOrganizationName) : undefined
      });

      navigate(buildWorkspaceBoardPath(workspace.slug), { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        if (error.status === 404) {
          setErrorMessage("Seu backend nao reconheceu o fluxo de provisionamento. Reinicie a API e tente novamente.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Nao foi possivel criar seu workspace agora. Tente novamente.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const selectedTemplateDescription = templates.find((item) => item.key === templateKey)?.description ?? "";

  return (
    <main className="no-workspace-page">
      <div className="no-workspace-page__backdrop" aria-hidden="true" />
      <section className="no-workspace-page__shell" aria-label="Criar workspace">
        <Card className="no-workspace-page__card">
          <div className="no-workspace-page__header">
            <p className="no-workspace-page__eyebrow">Novo ambiente Dask</p>
            <h1 className="no-workspace-page__title">Crie seu workspace</h1>
            <p className="no-workspace-page__description">
              {user?.email
                ? `A conta ${user.email} ainda nao possui workspace. Configure um pessoal ou corporativo para comecar.`
                : "Configure um workspace pessoal ou corporativo para comecar."}
            </p>
          </div>

          <div className="no-workspace-page__form-grid">
            <FormField label="Tipo de workspace" className="no-workspace-page__field">
              <Select value={kind} onChange={(event) => setKind(event.target.value as WorkspaceKind)}>
                <option value="PERSONAL">Pessoal</option>
                <option value="CORPORATE">Corporativo</option>
              </Select>
            </FormField>

            <FormField label="Template padrao" className="no-workspace-page__field">
              <Select
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value as WorkspaceTemplateOption["key"])}
                disabled={isLoadingTemplates}
              >
                {isLoadingTemplates ? <option>Carregando templates...</option> : null}
                {!isLoadingTemplates && templates.length === 0 ? <option value={templateKey}>Software Delivery</option> : null}
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Nome do workspace" className="no-workspace-page__field no-workspace-page__field--wide">
              <TextInput value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
            </FormField>

            {kind === "CORPORATE" ? (
              <FormField label="Nome da organizacao" className="no-workspace-page__field no-workspace-page__field--wide">
                <TextInput
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Ex.: Acme Inc"
                />
              </FormField>
            ) : null}
          </div>

          {selectedTemplateDescription ? (
            <p className="no-workspace-page__support-text">{selectedTemplateDescription}</p>
          ) : null}

          {templateNotice ? <p className="no-workspace-page__support-text">{templateNotice}</p> : null}
          {errorMessage ? <p className="no-workspace-page__error">{errorMessage}</p> : null}

          <div className="no-workspace-page__actions">
            <Button
              className="no-workspace-page__submit"
              type="button"
              variant="primary"
              onClick={handleCreateWorkspace}
              disabled={isCreating}
            >
              {isCreating ? "Provisionando workspace..." : "Criar workspace"}
            </Button>
            <Link className="no-workspace-page__home-link" to={routePaths.home}>
              <Button className="no-workspace-page__secondary" type="button">
                Voltar para home
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
