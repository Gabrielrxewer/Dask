import type { Dispatch, SetStateAction } from "react";
import type { ConnectPaymentOrder } from "@/modules/billing";
import {
  Button,
  ResourceTable,
  StatusBadge
} from "@/shared/ui";
import type { HistoryAction, PaymentOrdersLoadState } from "./billing-page.model";
import {
  BADGE_TONE_BY_STATUS,
  canCancelOrder,
  canResendOrder,
  formatAmount,
  formatOrderCustomerLabel,
  formatOrderDate,
  mapOrderStatusTone,
  ORDER_STATUS_LABEL
} from "./billing-page.model";

interface BillingHistoryPanelProps {
  paymentOrders: ConnectPaymentOrder[];
  paginatedPaymentOrders: ConnectPaymentOrder[];
  paymentOrdersLoadState: PaymentOrdersLoadState;
  paymentOrdersError: string | null;
  historyCopiedOrderId: string | null;
  historyActionOrderId: string | null;
  historyActionType: HistoryAction | null;
  historyPage: number;
  historyTotalPages: number;
  setHistoryPage: Dispatch<SetStateAction<number>>;
  onCreateFirstCharge: () => void;
  onCopyHistoryLink: (order: ConnectPaymentOrder) => void;
  onResendOrder: (order: ConnectPaymentOrder) => void;
  onCancelOrder: (order: ConnectPaymentOrder) => void;
}

export function BillingHistoryPanel({
  paymentOrders,
  paginatedPaymentOrders,
  paymentOrdersLoadState,
  paymentOrdersError,
  historyCopiedOrderId,
  historyActionOrderId,
  historyActionType,
  historyPage,
  historyTotalPages,
  setHistoryPage,
  onCreateFirstCharge,
  onCopyHistoryLink,
  onResendOrder,
  onCancelOrder
}: BillingHistoryPanelProps) {
  return (
    <div className="billing-view__panel" role="tabpanel">
      <div className="billing-view__panel-head">
        <div>
          <h3 className="billing-view__panel-title">Histórico de cobranças</h3>
          <p className="billing-view__panel-subtitle">Últimas 30 cobranças criadas neste workspace.</p>
        </div>
        <StatusBadge>{paymentOrders.length} itens</StatusBadge>
      </div>

      {paymentOrdersLoadState === "error" ? (
        <p className="billing-view__error">{paymentOrdersError}</p>
      ) : null}
      {paymentOrdersLoadState === "loaded" && paymentOrders.length === 0 ? (
        <div className="billing-view__history-empty">
          <p>Nenhuma cobrança criada ainda.</p>
          <Button type="button" variant="outline" onClick={onCreateFirstCharge}>
            Criar primeira cobrança →
          </Button>
        </div>
      ) : null}
      {paymentOrdersLoadState === "loaded" && paymentOrders.length > 0 ? (
        <>
          <ResourceTable
            className="billing-view__table"
            data={paginatedPaymentOrders}
            rowKey="id"
            columns={[
              {
                id: "status",
                header: "Status",
                width: "0.8fr",
                render: (order) => (
                  <StatusBadge tone={BADGE_TONE_BY_STATUS[mapOrderStatusTone(order.status)]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </StatusBadge>
                )
              },
              {
                id: "amount",
                header: "Valor",
                width: "0.9fr",
                render: (order) => formatAmount(order.amount, order.currency)
              },
              { id: "description", header: "Descrição", width: "1.1fr", accessor: "description" },
              {
                id: "customer",
                header: "Cliente",
                width: "1fr",
                render: formatOrderCustomerLabel
              },
              {
                id: "created",
                header: "Criada em",
                width: "0.95fr",
                render: (order) => formatOrderDate(order.createdAt)
              }
            ]}
            actions={{
              header: "Ações",
              width: "1.35fr",
              render: (order) => (
                <div className="billing-view__table-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="billing-view__table-action"
                    onClick={() => onCopyHistoryLink(order)}
                    disabled={!order.checkoutUrl}
                  >
                    {historyCopiedOrderId === order.id ? "Copiado!" : "Copiar link"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="billing-view__table-action"
                    onClick={() => onResendOrder(order)}
                    disabled={
                      !canResendOrder(order) ||
                      (historyActionOrderId === order.id && historyActionType === "resend")
                    }
                  >
                    {historyActionOrderId === order.id && historyActionType === "resend"
                      ? "Reenviando..."
                      : "Reenviar e-mail"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="billing-view__table-action billing-view__table-action--danger"
                    onClick={() => onCancelOrder(order)}
                    disabled={
                      !canCancelOrder(order) ||
                      (historyActionOrderId === order.id && historyActionType === "cancel")
                    }
                  >
                    {historyActionOrderId === order.id && historyActionType === "cancel"
                      ? "Cancelando..."
                      : "Cancelar"}
                  </Button>
                </div>
              )
            }}
            responsiveMinWidth="100%"
            responsiveMinWidthMobile="100%"
          />
          <div className="billing-view__pagination">
            <span className="billing-view__pagination-label">
              Página {historyPage} de {historyTotalPages}
            </span>
            <div className="billing-view__pagination-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                disabled={historyPage === 1}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))}
                disabled={historyPage === historyTotalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
