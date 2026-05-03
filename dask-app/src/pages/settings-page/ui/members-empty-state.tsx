import { Section } from "@/shared/ui";

interface MembersLoadingStateProps {
  variant: "loading" | "personal";
}

export function MembersEmptyState({ variant }: MembersLoadingStateProps) {
  if (variant === "loading") {
    return (
      <div className="ms">
        <Section title="Pessoas e acesso" subtitle="Carregando configurações do workspace...">
          <p className="ms-hint">Aguarde enquanto carregamos os dados.</p>
        </Section>
      </div>
    );
  }

  return (
    <div className="ms">
      <Section
        title="Pessoas e acesso"
        subtitle="Convites, roles e permissões disponíveis apenas em workspaces corporativos."
      >
        <p className="ms-hint">
          Este workspace é pessoal e já está configurado para uso individual.
        </p>
      </Section>
    </div>
  );
}
