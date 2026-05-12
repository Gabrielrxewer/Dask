import type { ConnectPaymentOrder, ConnectPaymentOrderStatus } from "@/modules/billing";
import { AppSelect, Button, EmptyState, PageToolbar, ResourceTable, SectionHeader, StatusBadge, TextInput } from "@/shared/ui";
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
  historySearch: string;
  historyStatusFilter: ConnectPaymentOrderStatus | "ALL";
  focusedOrderId: string | null;
  historyActionOrderId: string | null;
  historyActionType: HistoryAction | null;
  historyPage: number;
  historyHasPrevious: boolean;
  historyHasNext: boolean;
  historyIsFetching: boolean;
  onHistorySearchChange: (value: string) => void;
  onHistoryStatusFilterChange: (value: ConnectPaymentOrderStatus | "ALL") => void;
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

const HISTORY_STATUS_ITEMS = [
  { value: "ALL", label: "Todos os status" },
  ...Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
    value: value as ConnectPaymentOrderStatus,
    label
  }))
];

export function BillingHistoryPanel({
  customerMode,
  paymentOrders,
  paginatedPaymentOrders,
  paymentOrdersLoadState,
  paymentOrdersError,
  historySearch,
  historyStatusFilter,
  focusedOrderId,
  historyActionOrderId,
  historyActionType,
  historyPage,
  historyHasPrevious,
  historyHasNext,
  historyIsFetching,
  onHistorySearchChange,
  onHistoryStatusFilterChange,
  onHistoryPrevious,
  onHistoryNext,
  onCreateFirstCharge,
  onCopyHistoryLink,
  onResendOrder,
  onCancelOrder
}: BillingHistoryPanelProps) {
  const hasHistoryPage = paymentOrders.length > 0 || historyHasPrevious || historyHasNext;
  const renderActions = (order: ConnectPaymentOrder) => (
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
            disabled={!canResendOrder(order) || (historyActionOrderId === order.id && historyActionType === "resend")}
          >
            {historyActionOrderId === order.id && historyActionType === "resend" ? "Reenviando..." : "Reenviar e-mail"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="billing-view__table-action billing-view__table-action--danger"
            onClick={() => onCancelOrder(order)}
            disabled={!canCancelOrder(order) || (historyActionOrderId === order.id && historyActionType === "cancel")}
          >
            {historyActionOrderId === order.id && historyActionType === "cancel" ? "Cancelando..." : "Cancelar"}
          </Button>
        </>
      ) : null}
    </div>
  );

  const emptyState = (
    <EmptyState
      variant="table"
      title={customerMode ? "Nenhuma cobranca vinculada ao seu e-mail ainda." : "Nenhuma cobranca criada ainda."}
      action={
        !customerMode ? (
          <Button type="button" variant="outline" onClick={onCreateFirstCharge}>
            Criar primeira cobranca
          </Button>
        ) : null
      }
    />
  );

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

      <PageToolbar
        compact
        ariaLabel="Filtros do historico de cobrancas"
        search={
          <label className="billing-catalog__search">
            <TextInput
              value={historySearch}
              onChange={(event) => onHistorySearchChange(event.target.value)}
              placeholder="Buscar por cliente, e-mail ou descricao"
              aria-label="Buscar cobranca"
            />
          </label>
        }
        filters={
          <AppSelect
            value={historyStatusFilter}
            onValueChange={(value) => onHistoryStatusFilterChange(value as ConnectPaymentOrderStatus | "ALL")}
            aria-label="Filtrar status da cobranca"
            className="billing-catalog__filter"
            items={HISTORY_STATUS_ITEMS}
          />
        }
      />

      <ResourceTable
        className="billing-view__table"
        data={paginatedPaymentOrders}
        rowKey="id"
        rowClassName={(order) => (order.id === focusedOrderId ? "billing-view__table-row--focused" : undefined)}
        loading={paymentOrdersLoadState === "loading" || paymentOrdersLoadState === "idle"}
        loadingState="Carregando cobrancas..."
        error={paymentOrdersLoadState === "error" ? paymentOrdersError ?? true : undefined}
        emptyState={emptyState}
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
          render: renderActions
        }}
        pagination={
          hasHistoryPage
            ? {
                page: historyPage,
                pageSize: 5,
                hasPrevious: historyHasPrevious,
                hasNext: historyHasNext,
                isLoading: historyIsFetching,
                label: "Paginacao do historico",
                onPrevious: onHistoryPrevious,
                onNext: onHistoryNext
              }
            : undefined
        }
        mobileCard={{
          render: (order) => (
            <>
              <div className="marketing-page__section-head">
                <div>
                  <strong>{order.description}</strong>
                  <p>{formatOrderCustomerLabel(order)}</p>
                </div>
                <StatusBadge tone={BADGE_TONE_BY_STATUS[mapOrderStatusTone(order.status)]}>
                  {ORDER_STATUS_LABEL[order.status]}
                </StatusBadge>
              </div>
              <div className="billing-catalog__stack-cell">
                <strong>{formatAmount(order.amount, order.currency)}</strong>
                <span>{formatOrderDate(order.createdAt)}</span>
              </div>
              {renderActions(order)}
            </>
          )
        }}
        responsiveMinWidth="100%"
        responsiveMinWidthMobile="100%"
      />
    </div>
  );
}
