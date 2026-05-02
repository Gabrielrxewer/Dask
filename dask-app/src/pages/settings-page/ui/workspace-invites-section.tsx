import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceInvite } from "@/modules/workspace/model";
import { formatDate } from "@/shared/lib/date";
import { Button, FormField, Section, StatusBadge, TextInput } from "@/shared/ui";
import type { WorkspaceRole } from "./members-settings.model";
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_TONES } from "./members-settings.model";

interface WorkspaceInvitesSectionProps {
  inviteEmail: string;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  inviteRole: WorkspaceRole;
  setInviteRole: Dispatch<SetStateAction<WorkspaceRole>>;
  isSubmittingInvite: boolean;
  isLoadingInvites: boolean;
  pendingInvites: WorkspaceInvite[];
  isResendingInviteId: string | null;
  isRevokingInviteId: string | null;
  onInvite: () => Promise<void>;
  onResendInvite: (inviteId: string) => Promise<void>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
}

export function WorkspaceInvitesSection({
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  isSubmittingInvite,
  isLoadingInvites,
  pendingInvites,
  isResendingInviteId,
  isRevokingInviteId,
  onInvite,
  onResendInvite,
  onRevokeInvite,
}: WorkspaceInvitesSectionProps) {
  return (
    <Section
      title="Convites"
      subtitle="Adicione novos membros e gerencie convites enviados."
      className="ms-section"
    >
      <div className="ms-invite-form">
        <FormField label="E-mail">
          <TextInput
            value={inviteEmail}
            placeholder="nome@empresa.com"
            onChange={e => setInviteEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Role inicial">
          <div className="ms-role-row">
            {ASSIGNABLE_ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                className={`ms-role-chip${inviteRole === r.value ? " ms-role-chip--active" : ""}`}
                onClick={() => setInviteRole(r.value)}
                disabled={isSubmittingInvite}
                title={r.description}
              >
                {r.label}
              </button>
            ))}
          </div>
        </FormField>
        <div className="ms-invite-form__action">
          <Button
            type="button"
            onClick={() => void onInvite()}
            disabled={isSubmittingInvite}
          >
            {isSubmittingInvite ? "Enviando..." : "Enviar convite"}
          </Button>
        </div>
      </div>

      <div className="ms-invite-list">
        {isLoadingInvites ? (
          <p className="ms-hint">Carregando convites...</p>
        ) : pendingInvites.length === 0 ? (
          <p className="ms-hint">Nenhum convite pendente no momento.</p>
        ) : (
          <>
            <p className="ms-section-label">
              Convites pendentes ({pendingInvites.length})
            </p>
            {pendingInvites.map(invite => (
              <div key={invite.id} className="ms-invite-row">
                <div className="ms-invite-row__avatar">
                  {invite.email[0].toUpperCase()}
                </div>
                <div className="ms-invite-row__info">
                  <strong>{invite.email}</strong>
                  <span>Enviado em {formatDate(invite.sentAt, { options: { day: "2-digit", month: "short", year: "numeric" } })}</span>
                </div>
                <StatusBadge tone={ROLE_TONES[invite.role] ?? "default"}>
                  {ROLE_LABELS[invite.role] ?? invite.role}
                </StatusBadge>
                <div className="ms-invite-row__actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onResendInvite(invite.id)}
                    disabled={
                      isResendingInviteId === invite.id ||
                      isRevokingInviteId === invite.id
                    }
                  >
                    {isResendingInviteId === invite.id ? "Reenviando..." : "Reenviar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onRevokeInvite(invite.id)}
                    disabled={
                      isResendingInviteId === invite.id ||
                      isRevokingInviteId === invite.id
                    }
                  >
                    {isRevokingInviteId === invite.id ? "Removendo..." : "Remover"}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Section>
  );
}
