import { useEffect, useMemo, useState } from "react";
import { factoryBoardConfig } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type { WorkspaceTemplateOption } from "@/modules/workspace/model";
import { FormField, Section, Select } from "@/shared/ui";
import { Button } from "@/shared/ui";
import "./general-settings.css";

type BoardPerspective = {
  id: string;
  label: string;
};

export function GeneralSettings() {
  const { snapshot, updatePreferences, resetWorkspaceTemplate } = useWorkspace();
  const [templates, setTemplates] = useState<WorkspaceTemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplateOption["key"]>("software_delivery");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string>("");
  const [resetError, setResetError] = useState<string>("");

  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const perspectives = useMemo(() => {
    const fromPerspectives =
      Array.isArray((rawBoardConfig as { perspectives?: unknown }).perspectives)
        ? ((rawBoardConfig as { perspectives: BoardPerspective[] }).perspectives ?? [])
        : [];

    if (fromPerspectives.length > 0) {
      return fromPerspectives;
    }

    const fromViews =
      Array.isArray((rawBoardConfig as { views?: unknown }).views)
        ? ((rawBoardConfig as { views: BoardPerspective[] }).views ?? [])
        : [];

    if (fromViews.length > 0) {
      return fromViews;
    }

    return [{ id: "dev", label: "DEV" }];
  }, [rawBoardConfig]);

  const defaultMode = snapshot?.preferences.defaultBoardMode ?? perspectives[0]?.id ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";

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
        if (mounted) {
          setIsLoadingTemplates(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const availableTemplates =
    templates.length > 0
      ? templates
      : [
          { key: "software_delivery", name: "Software Delivery", description: "Template padrao" },
          { key: "product_discovery", name: "Product Discovery", description: "Template de descoberta" },
          { key: "operations_kanban", name: "Operations Kanban", description: "Template operacional" }
        ];

  const handleResetTemplate = async () => {
    const selected = availableTemplates.find(template => template.key === selectedTemplate);
    const selectedName = selected?.name ?? selectedTemplate;

    const confirmed = window.confirm(
      `Isso vai remover campos customizados e configuracoes manuais e aplicar o template ${selectedName}. Deseja continuar?`
    );

    if (!confirmed) {
      return;
    }

    setIsResettingTemplate(true);
    setResetFeedback("");
    setResetError("");

    try {
      await resetWorkspaceTemplate(selectedTemplate);
      setResetFeedback(`Template ${selectedName} aplicado com sucesso.`);
    } catch {
      setResetError("Nao foi possivel restaurar o template agora. Tente novamente.");
    } finally {
      setIsResettingTemplate(false);
    }
  };

  return (
    <div className="general-settings">
      <Section
        title="Preferencias do workspace"
        subtitle="As configuracoes sao aplicadas automaticamente no workspace."
        className="general-settings__card"
      >
        <div className="general-settings__form-grid">
          <FormField label="Perspectiva inicial">
            <Select
              value={defaultMode}
              onChange={event =>
                void updatePreferences({
                  defaultBoardMode: event.target.value
                })
              }
            >
              {perspectives.map(perspective => (
                <option key={perspective.id} value={perspective.id}>
                  {perspective.label}
                </option>
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
      </Section>

      <Section
        title="Restaurar template"
        subtitle="Aplica um template default e remove configuracoes customizadas de campos, tipos, estados e colunas."
        className="general-settings__card"
      >
        <div className="general-settings__form-grid">
          <FormField label="Template default">
            <Select
              value={selectedTemplate}
              onChange={event => setSelectedTemplate(event.target.value as WorkspaceTemplateOption["key"])}
              disabled={isLoadingTemplates || isResettingTemplate}
            >
              {availableTemplates.map(template => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </Select>
          </FormField>

          <p className="general-settings__warning">
            Esta acao remove todas as customizacoes de configuracao do workspace e reaplica apenas o necessario do template.
          </p>

          <div className="general-settings__reset-actions">
            <Button type="button" onClick={() => void handleResetTemplate()} disabled={isResettingTemplate}>
              {isResettingTemplate ? "Restaurando..." : "Voltar ao template default"}
            </Button>
            {resetFeedback ? <span className="general-settings__feedback">{resetFeedback}</span> : null}
            {resetError ? <span className="general-settings__error">{resetError}</span> : null}
          </div>
        </div>
      </Section>
    </div>
  );
}
