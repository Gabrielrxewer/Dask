import type { ConnectCatalogItem } from "@/modules/billing";
import { ConfirmModal } from "@/shared/ui";
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
    <ConfirmModal
      titleId="billing-delete-catalog-item-title"
      eyebrow="Excluir item"
      title={`Remover "${item.name}"?`}
      description="Esse item ficará inativo e não poderá mais ser usado em novas cobranças. O histórico anterior continua preservado."
      icon={<IconAlertCircle />}
      confirmLabel={deletingCatalogItemId === item.id ? "Excluindo..." : "Excluir item"}
      isConfirming={deletingCatalogItemId !== null}
      tone="danger"
      onClose={onClose}
      onConfirm={() => onConfirm(item)}
    />
  );
}
