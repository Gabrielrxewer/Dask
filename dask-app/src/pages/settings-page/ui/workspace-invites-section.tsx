import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { WorkspaceInvite } from "@/modules/workspace/model";
import { formatDate } from "@/shared/lib/date";
import { AppForm, AppFormField, Button, Section, StatusBadge, TextInput } from "@/shared/ui";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLE_TONES,
  workspaceInviteFormSchema,
  type WorkspaceInviteFormInput,
  type WorkspaceInviteFormValues
} from "./members-settings.model";

const inviteFormDefaultValues: WorkspaceInviteFormInput = {
  email: "",
  role: "MEMBER"
};

interface WorkspaceInvitesSectionProps {
  canInviteMembers: boolean;
  isSubmittingInvite: boolean;
  isLoadingInvites: boolean;
  pendingInvites: WorkspaceInvite[];
  isResendingInviteId: string | null;
  isRevokingInviteId: string | null;
  onInvite: (values: WorkspaceInviteFormValues) => Promise<boolean>;
  onResendInvite: (inviteId: string) => Promise<void>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
}

export function WorkspaceInvitesSection({
  canInviteMembers,
  isSubmittingInvite,
  isLoadingInvites,
  pendingInvites,
  isResendingInviteId,
  isRevokingInviteId,
  onInvite,
  onResendInvite,
  onRevokeInvite,
}: WorkspaceInvitesSectionProps) {
  const inviteForm = useForm<WorkspaceInviteFormInput, unknown, WorkspaceInviteFormValues>({
    resolver: zodResolver(workspaceInviteFormSchema),
    defaultValues: inviteFormDefaultValues,
    mode: "onChange"
  });

  const handleInvite = async (values: WorkspaceInviteFormValues) => {
    const didInvite = await onInvite(values);
    if (didInvite) {
      inviteForm.reset(inviteFormDefaultValues);
    }
  };

  return (
    <Section
      title="Convites"
      subtitle="Adicione novos membros e gerencie convites enviados."
      className="ms-section"
    >
      <AppForm
        form={inviteForm}
        onSubmit={handleInvite}
        className="ms-invite-form"
        disabled={!canInviteMembers}
        loading={isSubmittingInvite}
      >
        <AppFormField label="E-mail" error={inviteForm.formState.errors.email?.message}>
          <TextInput
            {...inviteForm.register("email")}
            placeholder="nome@empresa.com"
            disabled={!canInviteMembers || isSubmittingInvite}
            aria-invalid={inviteForm.formState.errors.email ? true : undefined}
          />
        </AppFormField>
        <Controller
          control={inviteForm.control}
          name="role"
          render={({ field }) => (
            <AppFormField label="Role inicial" error={inviteForm.formState.errors.role?.message}>
              <div className="ms-role-row">
                {ASSIGNABLE_ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`ms-role-chip${field.value === r.value ? " ms-role-chip--active" : ""}`}
                    onClick={() => field.onChange(r.value)}
                    disabled={!canInviteMembers || isSubmittingInvite}
                    title={r.description}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </AppFormField>
          )}
        />
        <div className="ms-invite-form__action">
          <Button
            type="submit"
            disabled={!canInviteMembers || isSubmittingInvite}
          >
            {isSubmittingInvite ? "Enviando..." : "Enviar convite"}
          </Button>
        </div>
      </AppForm>

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
                      isRevokingInviteId === invite.id ||
                      !canInviteMembers
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
                      isRevokingInviteId === invite.id ||
                      !canInviteMembers
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
