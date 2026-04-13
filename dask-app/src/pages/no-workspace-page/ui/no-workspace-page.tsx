import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildWorkspaceBoardPath, routePaths } from "@/app/router";
import { useAuth } from "@/features/auth";
import { workspaceService, type WorkspaceTemplateOption } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { Button, Card, FormField, Select, TextInput } from "@/shared/ui";

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

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section aria-label="Criar workspace" style={{ width: "min(760px, 100%)" }}>
        <Card>
          <h1>Crie seu workspace</h1>
          <p>
            {user?.email
              ? `A conta ${user.email} ainda nao possui workspace. Configure um pessoal ou corporativo para comecar.`
              : "Configure um workspace pessoal ou corporativo para comecar."}
          </p>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <FormField label="Tipo de workspace">
              <Select value={kind} onChange={(event) => setKind(event.target.value as WorkspaceKind)}>
                <option value="PERSONAL">Pessoal</option>
                <option value="CORPORATE">Corporativo</option>
              </Select>
            </FormField>

            <FormField label="Nome do workspace">
              <TextInput value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
            </FormField>

            <FormField label="Template padrao">
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

            {kind === "CORPORATE" ? (
              <FormField label="Nome da organizacao">
                <TextInput
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Ex.: Acme Inc"
                />
              </FormField>
            ) : null}
          </div>

          {templates.length > 0 ? (
            <p style={{ marginTop: 8, color: "#475467" }}>
              {templates.find((item) => item.key === templateKey)?.description ?? ""}
            </p>
          ) : null}

          {templateNotice ? <p style={{ marginTop: 8, color: "#475467" }}>{templateNotice}</p> : null}
          {errorMessage ? <p style={{ color: "#b42318", marginTop: 12 }}>{errorMessage}</p> : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <Button type="button" variant="primary" onClick={handleCreateWorkspace} disabled={isCreating}>
              {isCreating ? "Provisionando workspace..." : "Criar workspace"}
            </Button>
            <Link to={routePaths.home}>
              <Button type="button">Voltar para home</Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
