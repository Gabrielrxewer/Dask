import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { WorkspaceAccessGroup, WorkspacePermissionKey } from "@/modules/workspace/model";
import { AppForm, AppFormField, Button, DrawerShell, Tabs, TextInput } from "@/shared/ui";
import { ModulePicker } from "./module-picker";
import { PermissionPicker } from "./permission-picker";
import type { GroupDraft } from "./members-settings.model";
import { accessGroupFormSchema, MODULE_META } from "./members-settings.model";

type GroupEditorSection = "info" | "allow" | "deny" | "modules";
const ACCESS_GROUP_FORM_ID = "access-group-editor-form";

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
  const form = useForm<GroupDraft, unknown, GroupDraft>({
    resolver: zodResolver(accessGroupFormSchema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      allow: group?.allow ?? [],
      deny: group?.deny ?? [],
      allowedModules: group?.allowedModules ?? [],
      boardViewKeys: (group?.allowedBoardViewKeys ?? []).join(", "),
      ownCardsOnly: group?.ownCardsOnly === true,
    },
    mode: "onChange"
  });
  const [section, setSection] = useState<GroupEditorSection>("info");
  const [error, setError] = useState("");

  const draft = form.watch();
  const isSaving = form.formState.isSubmitting;

  const handleSave = async (values: GroupDraft) => {
    setError("");
    try {
      await onSave(values);
    } catch {
      setError("Nao foi possivel salvar o grupo.");
    }
  };

  const SECTIONS: Array<{ id: GroupEditorSection; label: string }> = [
    { id: "info", label: "Informações" },
    { id: "allow", label: "Permitir" },
    { id: "deny", label: "Bloquear" },
    { id: "modules", label: "Módulos" },
  ];

  const drawerNav = (
    <Tabs<GroupEditorSection>
      value={section}
      onChange={setSection}
      ariaLabel="Secoes do grupo de acesso"
      className="ms-drawer__nav-tabs"
      itemClassName="ms-drawer__nav-btn"
      activeItemClassName="ms-drawer__nav-btn--active"
      items={SECTIONS.map((s) => ({
        id: s.id,
        label: s.label,
        badge:
          s.id === "allow" && draft.allow.length > 0 ? (
            <span className="ms-badge ms-badge--green">{draft.allow.length}</span>
          ) : s.id === "deny" && draft.deny.length > 0 ? (
            <span className="ms-badge ms-badge--red">{draft.deny.length}</span>
          ) : s.id === "modules" && draft.allowedModules.length > 0 ? (
            <span className="ms-badge ms-badge--blue">{draft.allowedModules.length}</span>
          ) : null
      }))}
    />
  );

  const drawerFooter = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
        Cancelar
      </Button>
      <Button type="submit" form={ACCESS_GROUP_FORM_ID} disabled={isSaving}>
        {isSaving ? "Salvando..." : group ? "Salvar alterações" : "Criar grupo"}
      </Button>
    </>
  );
  return (
    <DrawerShell
      title={group ? `Editar grupo: ${group.name}` : "Novo grupo de acesso"}
      titleId="group-editor-title"
      subtitle="Defina permissões e restrições para aplicar a múltiplos membros"
      onClose={onClose}
      shellClassName="ms-drawer"
      headerClassName="ms-drawer__header"
      titleWrapperClassName="ms-drawer__header-info ms-drawer__header-info--full"
      closeButtonClassName="ms-drawer__close"
      closeButtonContent="×"
      nav={drawerNav}
      navClassName="ms-drawer__nav"
      bodyClassName="ms-drawer__body"
      error={error}
      errorClassName="ms-drawer__error"
      footer={drawerFooter}
      footerClassName="ms-drawer__footer"
    >
      <AppForm
        id={ACCESS_GROUP_FORM_ID}
        form={form}
        onSubmit={handleSave}
        className="ms-drawer__form"
        loading={isSaving}
      >
        {section === "info" && (
          <div className="ms-drawer__section">
            <AppFormField label="Nome do grupo" error={form.formState.errors.name?.message}>
              <TextInput
                {...form.register("name")}
                placeholder="Ex: Time de Vendas"
                disabled={isSaving}
              />
            </AppFormField>
            <AppFormField label="Descricao (opcional)" error={form.formState.errors.description?.message}>
              <TextInput
                {...form.register("description")}
                placeholder="Descreva o propósito deste grupo..."
                disabled={isSaving}
              />
            </AppFormField>

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
                    <span className="ms-perm-source__label">Módulos:</span>
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
              Permissões concedidas aos membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.allow}
              onChange={keys => form.setValue("allow", keys, { shouldDirty: true, shouldValidate: true })}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "deny" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Permissões bloqueadas para os membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.deny}
              onChange={keys => form.setValue("deny", keys, { shouldDirty: true, shouldValidate: true })}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "modules" && (
          <div className="ms-drawer__section">
            <AppFormField label="Modulos habilitados para este grupo" error={form.formState.errors.allowedModules?.message}>
              <ModulePicker
                selected={draft.allowedModules}
                onChange={keys => form.setValue("allowedModules", keys, { shouldDirty: true, shouldValidate: true })}
                disabled={isSaving}
              />
            </AppFormField>
            <AppFormField label="Views do board permitidas (separadas por virgula)" error={form.formState.errors.boardViewKeys?.message}>
              <TextInput
                {...form.register("boardViewKeys")}
                placeholder="kanban, list, agenda..."
                disabled={isSaving}
              />
            </AppFormField>
            <Controller
              control={form.control}
              name="ownCardsOnly"
              render={({ field }) => (
                <label className="ms-toggle-label">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={event => field.onChange(event.target.checked)}
                    disabled={isSaving}
                  />
                  <span>Mostrar somente cards proprios</span>
                </label>
              )}
            />
          </div>
        )}
      </AppForm>
    </DrawerShell>
  );
}



