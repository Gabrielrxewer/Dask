import type {
  WorkspaceAccessControlMember,
  WorkspaceAccessControlSnapshot
} from "@/modules/workspace/model";
import { Button, ResourceSection, StatusBadge, UserAvatar } from "@/shared/ui";
import { getInitials, ROLE_LABELS, ROLE_TONES } from "./members-settings.model";

interface MembersListSectionProps {
  isLoadingAccessControl: boolean;
  members: WorkspaceAccessControlMember[];
  accessControl: WorkspaceAccessControlSnapshot | null;
  onEditMember: (member: WorkspaceAccessControlMember) => void;
}

export function MembersListSection({
  isLoadingAccessControl,
  members,
  accessControl,
  onEditMember,
}: MembersListSectionProps) {
  return (
    <ResourceSection
      title="Membros"
      subtitle="Gerencie o acesso de cada pessoa no workspace."
      className="ms-section"
      empty={!isLoadingAccessControl && members.length === 0}
      emptyTitle="Nenhum membro encontrado."
    >
      {isLoadingAccessControl ? (
        <p className="ms-hint">Carregando membros...</p>
      ) : (
        <div className="ms-member-list">
          {members.map(member => {
            const isOwner = member.role === "OWNER";
            const editableMember = accessControl?.members.find(m => m.userId === member.userId) ?? null;
            const groupCount = (member.overrides.groupIds ?? []).length;
            const moduleCount = (member.overrides.allowedModules ?? []).length;

            return (
              <div key={member.userId} className="ms-member-row">
                <UserAvatar
                  alt={member.name}
                  initials={getInitials(member.name)}
                  size="sm"
                />
                <div className="ms-member-row__info">
                  <strong>{member.name}</strong>
                  <span>{member.email || "Sem e-mail visível"}</span>
                </div>
                <div className="ms-member-row__meta">
                  <StatusBadge tone={ROLE_TONES[member.role] ?? "default"}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </StatusBadge>
                  {groupCount > 0 && (
                    <span className="ms-badge ms-badge--blue">
                      {groupCount} grupo{groupCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {moduleCount > 0 && (
                    <span className="ms-badge">
                      {moduleCount} módulo{moduleCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => editableMember && onEditMember(editableMember)}
                  disabled={isOwner || !editableMember}
                >
                  {isOwner ? "Proprietário" : "Editar acesso"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </ResourceSection>
  );
}
