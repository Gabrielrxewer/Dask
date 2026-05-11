import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppDialog, AppForm, AppFormActions, AppTextField, Button } from "@/shared/ui";

const folderFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da pasta.").max(120, "Use ate 120 caracteres.")
});

type FolderFormValues = z.infer<typeof folderFormSchema>;

interface DocumentationFolderDialogProps {
  mode: "create" | "rename";
  initialName?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

export function DocumentationFolderDialog({
  mode,
  initialName = "",
  isSubmitting = false,
  onClose,
  onSubmit
}: DocumentationFolderDialogProps) {
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: { name: initialName }
  });

  async function submit(values: FolderFormValues) {
    await onSubmit(values.name.trim());
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={mode === "create" ? "Nova pasta" : "Renomear pasta"}
      description="Organize documentos sem sair do fluxo de edicao."
      className="documentation-folder-dialog app-dialog--form"
    >
      <AppForm<FolderFormValues, FolderFormValues>
        form={form}
        disabled={isSubmitting}
        className="documentation-folder-dialog__form"
        onSubmit={submit}
      >
        <AppTextField name="name" label="Nome" autoFocus />
        <AppFormActions className="documentation-send-modal__footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : mode === "create" ? "Criar pasta" : "Salvar"}
          </Button>
        </AppFormActions>
      </AppForm>
    </AppDialog>
  );
}
