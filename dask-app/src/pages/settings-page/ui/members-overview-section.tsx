interface MembersOverviewSectionProps {
  membersCount: number;
  pendingInvitesCount: number;
  activeModulesCount: number;
  groupsCount: number;
}

export function MembersOverviewSection({
  membersCount,
  pendingInvitesCount,
  activeModulesCount,
  groupsCount,
}: MembersOverviewSectionProps) {
  return (
    <div className="ms-summary">
      <div className="ms-summary__copy">
        <span>Pessoas e acesso</span>
        <h2>Resumo do workspace</h2>
        <p>Controle membros, convites, modulos e grupos de acesso em um unico lugar.</p>
      </div>
      <div className="ms-summary__grid">
        <span><strong>{membersCount}</strong> membros</span>
        <span><strong>{pendingInvitesCount}</strong> convites pendentes</span>
        <span><strong>{activeModulesCount}</strong> modulos ativos</span>
        <span><strong>{groupsCount}</strong> grupos de acesso</span>
      </div>
    </div>
  );
}
