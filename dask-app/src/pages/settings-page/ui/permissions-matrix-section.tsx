import type { WorkspaceAccessControlSnapshot } from "@/modules/workspace/model";
import { Section } from "@/shared/ui";
import { PermissionsMatrix } from "./permissions-matrix";

interface PermissionsMatrixSectionProps {
  accessControl: WorkspaceAccessControlSnapshot | null;
}

export function PermissionsMatrixSection({ accessControl }: PermissionsMatrixSectionProps) {
  return (
    <Section
      title="Matriz de permissões"
      subtitle="Catálogo completo de permissões por role."
      className="ms-section"
    >
      {!accessControl ? (
        <p className="ms-hint">Matriz indisponível no momento.</p>
      ) : (
        <PermissionsMatrix accessControl={accessControl} />
      )}
    </Section>
  );
}
