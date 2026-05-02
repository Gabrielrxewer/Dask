import type {
  WorkspaceAccessControlSnapshot,
  WorkspaceModuleKey
} from "@/modules/workspace/model";
import { Section } from "@/shared/ui";
import { MODULE_META } from "./members-settings.model";

interface WorkspaceModulesSectionProps {
  moduleCatalog: WorkspaceModuleKey[];
  accessControl: WorkspaceAccessControlSnapshot | null;
  isSavingModuleEntitlements: boolean;
  onToggleModule: (moduleKey: WorkspaceModuleKey, enabled: boolean) => Promise<void>;
}

export function WorkspaceModulesSection({
  moduleCatalog,
  accessControl,
  isSavingModuleEntitlements,
  onToggleModule,
}: WorkspaceModulesSectionProps) {
  return (
    <Section
      title="MÃ³dulos do workspace"
      subtitle="Controle quais mÃ³dulos estÃ£o habilitados no plano atual."
      className="ms-section"
    >
      {isSavingModuleEntitlements && (
        <p className="ms-hint">Salvando...</p>
      )}
      <div className="ms-module-grid">
        {moduleCatalog.map(moduleKey => {
          const meta = MODULE_META[moduleKey];
          const enabled = accessControl?.moduleEntitlements?.[moduleKey] !== false;
          return (
            <div
              key={moduleKey}
              className={`ms-module-card${enabled ? " ms-module-card--enabled" : ""}`}
            >
              <div className="ms-module-card__head">
                <div className="ms-module-card__info">
                  <strong>{meta.label}</strong>
                  <span>{meta.description}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  className={`ms-toggle${enabled ? " ms-toggle--on" : ""}`}
                  onClick={() => void onToggleModule(moduleKey, !enabled)}
                  disabled={isSavingModuleEntitlements}
                  aria-label={`${enabled ? "Desabilitar" : "Habilitar"} ${meta.label}`}
                >
                  <span className="ms-toggle__knob" />
                </button>
              </div>
              <div className="ms-module-card__status">
                <span className={`ms-status-dot${enabled ? " ms-status-dot--on" : ""}`} />
                {enabled ? "Habilitado" : "Desabilitado"}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
