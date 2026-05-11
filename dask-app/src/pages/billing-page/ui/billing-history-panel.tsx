import type { ConnectPaymentOrder } from "@/modules/billing";
import { Button, EmptyState, InlineAlert, SectionHeader, StatusBadge } from "@/shared/ui";
import { BillingDataTable as ResourceTable } from "./billing-data-table";
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
  customerMode: boolean;
  paymentOrders: ConnectPaymentOrder[];
  paginatedPaymentOrders: ConnectPaymentOrder[];
  paymentOrdersLoadState: PaymentOrdersLoadState;
  paymentOrdersError: string | null;
  focusedOrderId: string | null;
  historyActionOrderId: string | null;
  historyActionType: HistoryAction | null;
  historyPage: number;
  historyHasPrevious: boolean;
  historyHasNext: boolean;
  historyIsFetching: boolean;
  onHistoryPrevious: () => void;
  onHistoryNext: () => void;
  onCreateFirstCharge: () => void;
  onCopyHistoryLink: (order: ConnectPaymentOrder) => void;
  onResendOrder: (order: ConnectPaymentOrder) => void;
  onCancelOrder: (order: ConnectPaymentOrder) => void;
}

const CUSTOMER_TERMINAL_STATUSES = new Set([
  "PAID",
  "REFUNDED",
  "CANCELED",
  "SUBSCRIPTION_ACTIVE",
  "SUBSCRIPTION_CANCELED"
]);

export function BillingHistoryPanel({
  customerMode,
  paymentOrders,
  paginatedPaymentOrders,
  paymentOrdersLoadState,
  paymentOrdersError,
  focusedOrderId,
  historyActionOrderId,
  historyActionType,
  historyPage,
  historyHasPrevious,
  historyHasNext,
  historyIsFetching,
  onHistoryPrevious,
  onHistoryNext,
  onCreateFirstCharge,
  onCopyHistoryLink,
  onResendOrder,
  onCancelOrder
}: BillingHistoryPanelProps) {
  const hasHistoryPage = paymentOrders.length > 0 || historyHasPrevious || historyHasNext;

  return (
    <div className="billing-view__panel" role="tabpanel">
      <SectionHeader
        title={customerMode ? "Portal do cliente" : "Historico de cobrancas"}
        description={
          customerMode
            ? "Acompanhe cobrancas, vencimentos, status de pagamento, assinatura e documentos fiscais."
            : "Cobrancas criadas neste workspace com paginacao server-side."
        }
        badge={<StatusBadge>{paymentOrders.length} itens</StatusBadge>}
      />

      {paymentOrdersLoadState === "error" ? (
        <InlineAlert tone="danger">{paymentOrdersError}</InlineAlert>
      ) : null}
      {paymentOrdersLoadState === "loaded" && !hasHistoryPage ? (
        <EmptyState
          title={customerMode ? "Nenhuma cobranca vinculada ao seu e-mail ainda." : "Nenhuma cobranca criada ainda."}
          action={!customerMode ? (
            <Button type="button" variant="outline" onClick={onCreateFirstCharge}>
              Criar primeira cobranca
            </Button>
          ) : null}
        />
      ) : null}
      {paymentOrdersLoadState === "loaded" && hasHistoryPage ? (
        <>
          <ResourceTable
            className="billing-view__table"
            data={paginatedPaymentOrders}
            rowKey="id"
            rowClassName={(order) => (order.id === focusedOrderId ? "billing-view__table-row--focused" : undefined)}
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
              { id: "description", header: "Descricao", width: "1.1fr", accessor: "description" },
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
              },
              {
                id: "due",
                header: "Vencimento",
                width: "0.9fr",
                render: (order) => (order.paidAt ? "Pago" : order.canceledAt ? "Cancelado" : "Em aberto")
              }
            ]}
            actions={{
              header: "Ações",
              width: customerMode ? "1fr" : "1.35fr",
              render: (order) => (
                <div className="billing-view__table-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="billing-view__table-action"
                    onClick={() => onCopyHistoryLink(order)}
                    disabled={!order.customerPortalUrl && !order.checkoutUrl}
                  >
                    Copiar link
                  </Button>
                  {customerMode && order.checkoutUrl && !CUSTOMER_TERMINAL_STATUSES.has(order.status) ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="billing-view__table-action"
                      onClick={() => window.location.assign(order.checkoutUrl ?? "")}
                    >
                      Pagar
                    </Button>
                  ) : null}
                  {!customerMode ? (
                    <>
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
                    </>
                  ) : null}
                </div>
              )
            }}
            responsiveMinWidth="100%"
            responsiveMinWidthMobile="100%"
          />
          <div className="billing-view__pagination">
            <span className="billing-view__pagination-label">Página {historyPage}</span>
            <div className="billing-view__pagination-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onHistoryPrevious}
                disabled={!historyHasPrevious || historyIsFetching}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onHistoryNext}
                disabled={!historyHasNext || historyIsFetching}
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
