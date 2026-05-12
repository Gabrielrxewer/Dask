import type { WorkspaceAccessGroup } from "@/modules/workspace/model";
import { Button, Section } from "@/shared/ui";
import { MODULE_META } from "./members-settings.model";

interface AccessGroupsSectionProps {
  groups: WorkspaceAccessGroup[];
  canManageGroups: boolean;
  isDeletingGroupId: string | null;
  onCreateGroup: () => void;
  onEditGroup: (group: WorkspaceAccessGroup) => void;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

export function AccessGroupsSection({
  groups,
  canManageGroups,
  isDeletingGroupId,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: AccessGroupsSectionProps) {
  return (
    <Section
      title="Grupos de acesso"
      subtitle="Conjuntos reutilizáveis de permissões para aplicar a múltiplos membros."
      className="ms-section"
    >
      <div className="ms-section-top-action">
        <Button type="button" onClick={onCreateGroup} disabled={!canManageGroups}>
          Criar grupo
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="ms-hint">Nenhum grupo de acesso criado ainda.</p>
      ) : (
        <div className="ms-group-list">
          {groups.map(group => (
            <div key={group.id} className="ms-group-card">
              <div className="ms-group-card__head">
                <div className="ms-group-card__info">
                  <strong>{group.name}</strong>
                  {group.description && <span>{group.description}</span>}
                </div>
                <div className="ms-group-card__actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEditGroup(group)}
                    disabled={!canManageGroups}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onDeleteGroup(group.id)}
                    disabled={!canManageGroups || isDeletingGroupId === group.id}
                  >
                    {isDeletingGroupId === group.id ? "Removendo..." : "Remover"}
                  </Button>
                </div>
              </div>
              <div className="ms-group-card__preview">
                {(group.allow ?? []).length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Permite:</span>
                    {(group.allow ?? []).slice(0, 4).map(p => (
                      <span key={p} className="ms-chip ms-chip--allow">{p}</span>
                    ))}
                    {(group.allow ?? []).length > 4 && (
                      <span className="ms-chip ms-chip--more">
                        +{(group.allow ?? []).length - 4}
                      </span>
                    )}
                  </div>
                )}
                {(group.deny ?? []).length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Bloqueia:</span>
                    {(group.deny ?? []).slice(0, 4).map(p => (
                      <span key={p} className="ms-chip ms-chip--deny">{p}</span>
                    ))}
                    {(group.deny ?? []).length > 4 && (
                      <span className="ms-chip ms-chip--more">
                        +{(group.deny ?? []).length - 4}
                      </span>
                    )}
                  </div>
                )}
                {(group.allowedModules ?? []).length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    {(group.allowedModules ?? []).map(m => (
                      <span key={m} className="ms-chip ms-chip--module">
                        {MODULE_META[m]?.label ?? m}
                      </span>
                    ))}
                  </div>
                )}
                {(group.allow ?? []).length === 0 &&
                  (group.deny ?? []).length === 0 &&
                  (group.allowedModules ?? []).length === 0 && (
                    <span className="ms-hint">Sem restrições configuradas.</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
