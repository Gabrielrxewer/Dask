import type { WorkspaceAccessControlSnapshot } from "@/modules/workspace/model";
import { Section } from "@/shared/ui";
import { PermissionsMatrix } from "./permissions-matrix";

interface PermissionsMatrixSectionProps {
  accessControl: WorkspaceAccessControlSnapshot | null;
}

export function PermissionsMatrixSection({ accessControl }: PermissionsMatrixSectionProps) {
  return (
    <Section
      title="Matriz de permissÃµes"
      subtitle="CatÃ¡logo completo de permissÃµes por role."
      className="ms-section"
    >
      {!accessControl ? (
        <p className="ms-hint">Matriz indisponÃ­vel no momento.</p>
      ) : (
        <PermissionsMatrix accessControl={accessControl} />
      )}
    </Section>
  );
}
