import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath, routePaths } from "@/app/router";
import { useAuth } from "@/features/auth";
import { billingStore, useBilling } from "@/modules/billing";
import {
  useProvisionWorkspaceWithProfileMutation,
  useWorkspaceTemplatesQuery,
  type WorkspaceTemplateOption
} from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { AppSelect, Button, Card, FormField, TextInput, toast } from "@/shared/ui";
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
  const billing = useBilling();
  const [isCreating, setIsCreating] = useState(false);

  const [kind, setKind] = useState<WorkspaceKind>("PERSONAL");
  const [workspaceName, setWorkspaceName] = useState("Meu Workspace");
  const [organizationName, setOrganizationName] = useState("");
  const [templateKey, setTemplateKey] = useState<WorkspaceTemplateOption["key"] | "">("");
  const canCreateWorkspace = billing.status?.canCreateWorkspace ?? false;
  const templatesQuery = useWorkspaceTemplatesQuery({ enabled: canCreateWorkspace });
  const provisionWorkspaceMutation = useProvisionWorkspaceWithProfileMutation();
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const isLoadingTemplates = templatesQuery.isLoading;
  const emptyTemplateValue = "__empty_template__";

  useEffect(() => {
    if (billing.loadState === "idle") {
      void billingStore.load();
    }
  }, [billing.loadState]);

  useEffect(() => {
    if (!canCreateWorkspace) {
      setTemplateKey("");
      return;
    }

    const firstKey = templates[0]?.key;
    if (firstKey) {
      setTemplateKey(current => templates.some(template => template.key === current) ? current : firstKey);
    } else if (!isLoadingTemplates) {
      setTemplateKey("");
    }
  }, [canCreateWorkspace, isLoadingTemplates, templates]);

  useEffect(() => {
    if (templatesQuery.isError) {
      toast.error("Nao foi possivel carregar o catalogo de templates.");
    }
  }, [templatesQuery.isError]);

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
      toast.error("Informe um nome de workspace com pelo menos 2 caracteres.");
      return;
    }

    if (kind === "CORPORATE" && !resolvedOrganizationName) {
      toast.error("Informe o nome da organizacao para workspace corporativo.");
      return;
    }

    if (!templateKey) {
      toast.error("Selecione um template carregado pelo backend.");
      return;
    }

    setIsCreating(true);

    try {
      const workspace = await provisionWorkspaceMutation.mutateAsync({
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
          toast.error("Seu backend nao reconheceu o fluxo de provisionamento. Reinicie a API e tente novamente.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Nao foi possivel criar seu workspace agora. Tente novamente.");
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
            <h1 className="no-workspace-page__title">{canCreateWorkspace ? "Crie seu workspace" : "Aguardando convite"}</h1>
            <p className="no-workspace-page__description">
              {!canCreateWorkspace
                ? user?.email
                  ? `A conta ${user.email} ainda nao possui um workspace convidado. Assim que um convite for aceito, ele vai aparecer aqui.`
                  : "Assim que voce receber um convite para um workspace, ele vai aparecer aqui."
                : user?.email
                  ? `A conta ${user.email} ainda nao possui workspace. Configure um pessoal ou corporativo para comecar.`
                  : "Configure um workspace pessoal ou corporativo para comecar."}
            </p>
          </div>

          {canCreateWorkspace ? (
            <>
              <div className="no-workspace-page__form-grid">
                <FormField label="Tipo de workspace" className="no-workspace-page__field">
                  <AppSelect
                    value={kind}
                    onValueChange={(value) => setKind(value as WorkspaceKind)}
                    aria-label="Tipo de workspace"
                    items={[
                      { value: "PERSONAL", label: "Pessoal" },
                      { value: "CORPORATE", label: "Corporativo" }
                    ]}
                  />
                </FormField>

                <FormField label="Template padrao" className="no-workspace-page__field">
                  <AppSelect
                    value={templateKey || emptyTemplateValue}
                    onValueChange={(value) => setTemplateKey(value === emptyTemplateValue ? "" : value as WorkspaceTemplateOption["key"])}
                    disabled={isLoadingTemplates || templates.length === 0}
                    aria-label="Template padrao"
                    placeholder={isLoadingTemplates ? "Carregando templates..." : "Selecionar template"}
                    items={[
                      {
                        value: emptyTemplateValue,
                        label: isLoadingTemplates ? "Carregando templates..." : "Catalogo indisponivel",
                        disabled: templates.length > 0
                      },
                      ...templates.map((template) => ({ value: template.key, label: template.name }))
                    ]}
                  />
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

            </>
          ) : (
            <p className="no-workspace-page__support-text">
              Esta conta pode entrar apenas em workspaces para os quais foi convidada. A criacao de workspace proprio
              requer assinatura ativa.
            </p>
          )}
          <div className="no-workspace-page__actions">
            {canCreateWorkspace ? (
              <Button
                className="no-workspace-page__submit"
                type="button"
                variant="primary"
                onClick={handleCreateWorkspace}
                disabled={isCreating || isLoadingTemplates || !templateKey}
              >
                {isCreating ? "Provisionando workspace..." : "Criar workspace"}
              </Button>
            ) : null}
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
