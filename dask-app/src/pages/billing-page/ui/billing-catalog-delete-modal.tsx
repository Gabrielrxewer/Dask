import type { ConnectCatalogItem } from "@/modules/billing";
import { Button, ModalShell } from "@/shared/ui";
import { IconAlertCircle } from "./billing-page-icons";

interface BillingCatalogDeleteModalProps {
  item: ConnectCatalogItem;
  deletingCatalogItemId: string | null;
  onClose: () => void;
  onConfirm: (item: ConnectCatalogItem) => void;
}

export function BillingCatalogDeleteModal({
  item,
  deletingCatalogItemId,
  onClose,
  onConfirm
}: BillingCatalogDeleteModalProps) {
  return (
    <ModalShell
      titleId="billing-delete-catalog-item-title"
      className="billing-view__delete-modal"
      onClose={() => {
        if (deletingCatalogItemId) return;
        onClose();
      }}
    >
      <>
        <div className="billing-view__delete-modal-head">
          <span className="billing-view__delete-modal-icon" aria-hidden="true">
            <IconAlertCircle />
          </span>
          <div className="billing-view__delete-modal-copy">
          <span className="billing-view__delete-modal-eyebrow">Excluir item</span>
          <h2 id="billing-delete-catalog-item-title">Remover "{item.name}"?</h2>
          <p>
            Esse item ficará inativo e não poderá mais ser usado em novas cobranças. O histórico anterior
            continua preservado.
          </p>
          </div>
        </div>
        <div className="billing-view__delete-modal-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deletingCatalogItemId !== null}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="billing-view__delete-modal-confirm"
            onClick={() => onConfirm(item)}
            disabled={deletingCatalogItemId !== null}
          >
            {deletingCatalogItemId === item.id ? "Excluindo..." : "Excluir item"}
          </Button>
        </div>
      </>
    </ModalShell>
  );
}
