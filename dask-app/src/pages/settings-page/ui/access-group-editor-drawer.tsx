import { useState } from "react";
import type { WorkspaceAccessGroup, WorkspacePermissionKey } from "@/modules/workspace/model";
import { Button, DrawerShell, FormField, TextInput } from "@/shared/ui";
import { ModulePicker } from "./module-picker";
import { PermissionPicker } from "./permission-picker";
import type { GroupDraft } from "./members-settings.model";
import { MODULE_META } from "./members-settings.model";

type GroupEditorSection = "info" | "allow" | "deny" | "modules";

export function AccessGroupEditorDrawer({
  catalog,
  group,
  onSave,
  onClose,
}: {
  catalog: WorkspacePermissionKey[];
  group?: WorkspaceAccessGroup;
  onSave: (draft: GroupDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GroupDraft>({
    name: group?.name ?? "",
    description: group?.description ?? "",
    allow: group?.allow ?? [],
    deny: group?.deny ?? [],
    allowedModules: group?.allowedModules ?? [],
    boardViewKeys: (group?.allowedBoardViewKeys ?? []).join(", "),
    ownCardsOnly: group?.ownCardsOnly === true,
  });
  const [section, setSection] = useState<GroupEditorSection>("info");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError("Informe um nome para o grupo.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave(draft);
    } catch {
      setError("NÃ£o foi possÃ­vel salvar o grupo.");
      setIsSaving(false);
    }
  };

  const SECTIONS: Array<{ id: GroupEditorSection; label: string }> = [
    { id: "info", label: "InformaÃ§Ãµes" },
    { id: "allow", label: "Permitir" },
    { id: "deny", label: "Bloquear" },
    { id: "modules", label: "MÃ³dulos" },
  ];

  const drawerNav = (
    <>
      {SECTIONS.map(s => (
        <button
          key={s.id}
          type="button"
          className={`ms-drawer__nav-btn${section === s.id ? " ms-drawer__nav-btn--active" : ""}`}
          onClick={() => setSection(s.id)}
        >
          {s.label}
          {s.id === "allow" && draft.allow.length > 0 && (
            <span className="ms-badge ms-badge--green">{draft.allow.length}</span>
          )}
          {s.id === "deny" && draft.deny.length > 0 && (
            <span className="ms-badge ms-badge--red">{draft.deny.length}</span>
          )}
          {s.id === "modules" && draft.allowedModules.length > 0 && (
            <span className="ms-badge ms-badge--blue">{draft.allowedModules.length}</span>
          )}
        </button>
      ))}
    </>
  );

  const drawerFooter = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
        Cancelar
      </Button>
      <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
        {isSaving ? "Salvando..." : group ? "Salvar alteraÃ§Ãµes" : "Criar grupo"}
      </Button>
    </>
  );
  return (
    <DrawerShell
      title={group ? `Editar grupo: ${group.name}` : "Novo grupo de acesso"}
      titleId="group-editor-title"
      subtitle="Defina permissÃµes e restriÃ§Ãµes para aplicar a mÃºltiplos membros"
      onClose={onClose}
      shellClassName="ms-drawer"
      headerClassName="ms-drawer__header"
      titleWrapperClassName="ms-drawer__header-info ms-drawer__header-info--full"
      closeButtonClassName="ms-drawer__close"
      closeButtonContent="Ã—"
      nav={drawerNav}
      navClassName="ms-drawer__nav"
      bodyClassName="ms-drawer__body"
      error={error}
      errorClassName="ms-drawer__error"
      footer={drawerFooter}
      footerClassName="ms-drawer__footer"
    >
        {section === "info" && (
          <div className="ms-drawer__section">
            <FormField label="Nome do grupo">
              <TextInput
                value={draft.name}
                placeholder="Ex: Time de Vendas"
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>
            <FormField label="DescriÃ§Ã£o (opcional)">
              <TextInput
                value={draft.description}
                placeholder="Descreva o propÃ³sito deste grupo..."
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>

            {(draft.allow.length > 0 || draft.deny.length > 0 || draft.allowedModules.length > 0) && (
              <div className="ms-group-preview">
                <p className="ms-group-preview__label">Preview do grupo</p>
                {draft.allow.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Permite:</span>
                    {draft.allow.slice(0, 5).map(p => (
                      <span key={p} className="ms-chip ms-chip--allow">{p}</span>
                    ))}
                    {draft.allow.length > 5 && (
                      <span className="ms-chip ms-chip--more">+{draft.allow.length - 5}</span>
                    )}
                  </div>
                )}
                {draft.deny.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Bloqueia:</span>
                    {draft.deny.slice(0, 5).map(p => (
                      <span key={p} className="ms-chip ms-chip--deny">{p}</span>
                    ))}
                    {draft.deny.length > 5 && (
                      <span className="ms-chip ms-chip--more">+{draft.deny.length - 5}</span>
                    )}
                  </div>
                )}
                {draft.allowedModules.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">MÃ³dulos:</span>
                    {draft.allowedModules.map(m => (
                      <span key={m} className="ms-chip ms-chip--module">{MODULE_META[m].label}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {section === "allow" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              PermissÃµes concedidas aos membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.allow}
              onChange={keys => setDraft(d => ({ ...d, allow: keys }))}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "deny" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              PermissÃµes bloqueadas para os membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.deny}
              onChange={keys => setDraft(d => ({ ...d, deny: keys }))}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "modules" && (
          <div className="ms-drawer__section">
            <FormField label="MÃ³dulos habilitados para este grupo">
              <ModulePicker
                selected={draft.allowedModules}
                onChange={keys => setDraft(d => ({ ...d, allowedModules: keys }))}
                disabled={isSaving}
              />
            </FormField>
            <FormField label="Views do board permitidas (separadas por vÃ­rgula)">
              <TextInput
                value={draft.boardViewKeys}
                placeholder="kanban, list, agenda..."
                onChange={e => setDraft(d => ({ ...d, boardViewKeys: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>
            <label className="ms-toggle-label">
              <input
                type="checkbox"
                checked={draft.ownCardsOnly}
                onChange={e => setDraft(d => ({ ...d, ownCardsOnly: e.target.checked }))}
                disabled={isSaving}
              />
              <span>Mostrar somente cards prÃ³prios</span>
            </label>
          </div>
        )}
    </DrawerShell>
  );
}



