import type { Dispatch, SetStateAction } from "react";
import type { ConnectPaymentOrder } from "@/modules/billing";
import { Button, EmptyState, InlineAlert, ResourceTable, SectionHeader, StatusBadge } from "@/shared/ui";
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
      <SectionHeader
        title={customerMode ? "Portal do cliente" : "Historico de cobrancas"}
        description={
          customerMode
            ? "Acompanhe cobrancas, vencimentos, status de pagamento, assinatura e documentos fiscais."
            : "Ultimas 30 cobrancas criadas neste workspace."
        }
        badge={<StatusBadge>{paymentOrders.length} itens</StatusBadge>}
      />

      {paymentOrdersLoadState === "error" ? (
        <InlineAlert tone="danger">{paymentOrdersError}</InlineAlert>
      ) : null}
      {paymentOrdersLoadState === "loaded" && paymentOrders.length === 0 ? (
        <EmptyState
          title={customerMode ? "Nenhuma cobranca vinculada ao seu e-mail ainda." : "Nenhuma cobranca criada ainda."}
          action={!customerMode ? (
            <Button type="button" variant="outline" onClick={onCreateFirstCharge}>
              Criar primeira cobranca
            </Button>
          ) : null}
        />
      ) : null}
      {paymentOrdersLoadState === "loaded" && paymentOrders.length > 0 ? (
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
              header: "Acoes",
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
                    {historyCopiedOrderId === order.id ? "Copiado!" : "Copiar link"}
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
            <span className="billing-view__pagination-label">
              Pagina {historyPage} de {historyTotalPages}
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
                Proxima
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
