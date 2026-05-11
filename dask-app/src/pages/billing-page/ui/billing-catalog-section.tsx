import { useMemo, type ReactNode } from "react";
import type { ConnectCatalogItem } from "@/modules/billing";
import {
  AppIcon,
  AppSelect,
  Button,
  EmptyState,
  PageToolbar,
  RegistrationList,
  StatusBadge,
  TextInput
} from "@/shared/ui";
import { BillingDataTable as ResourceTable, type BillingDataTableColumn as ResourceTableColumn } from "./billing-data-table";
import { BillingCatalogForm, type BillingCatalogFormProps } from "./billing-catalog-form";
import {
  CATALOG_BILLING_LABEL,
  CATALOG_KIND_LABEL,
  formatAmount,
  isRecurringCatalogBillingType,
  type CatalogBillingFilter,
  type CatalogKindFilter,
  type CatalogLoadState,
  type CatalogSort
} from "./billing-page.model";

interface BillingCatalogSectionProps {
  catalogItems: ConnectCatalogItem[];
  catalogLoadState: CatalogLoadState;
  catalogSearch: string;
  catalogKindFilter: CatalogKindFilter;
  catalogBillingFilter: CatalogBillingFilter;
  catalogSort: CatalogSort;
  catalogPage: number;
  catalogHasPrevious: boolean;
  catalogHasNext: boolean;
  catalogIsFetching: boolean;
  isCatalogFormOpen: boolean;
  deletingCatalogItemId: string | null;
  formProps: BillingCatalogFormProps;
  onCatalogSearchChange: (value: string) => void;
  onCatalogKindFilterChange: (value: CatalogKindFilter) => void;
  onCatalogBillingFilterChange: (value: CatalogBillingFilter) => void;
  onCatalogSortChange: (value: CatalogSort) => void;
  onCatalogPrevious: () => void;
  onCatalogNext: () => void;
  onOpenCatalogForm: () => void;
  onCloseCatalogForm: () => void;
  onChargeNow: () => void;
  onUseCatalogItem: (item: ConnectCatalogItem) => void;
  onEditCatalogItem: (item: ConnectCatalogItem) => void;
  onRequestDeleteCatalogItem: (item: ConnectCatalogItem) => void;
}

function metadataValue(item: ConnectCatalogItem, key: string): string {
  const value = item.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function formatBase(item: ConnectCatalogItem): string {
  return [metadataValue(item, "defaultQuantity"), metadataValue(item, "unit")].filter(Boolean).join(" ") || "-";
}

function formatRecurrence(item: ConnectCatalogItem): string {
  if (!isRecurringCatalogBillingType(item.billingType)) {
    return "Não recorrente";
  }

  const interval = item.recurringInterval ?? "MONTH";
  const count = item.recurringIntervalCount ?? 1;
  if (interval === "MONTH" && count === 1) return "Mensal";
  if (interval === "MONTH" && count === 6) return "Semestral";
  if (interval === "YEAR" && count === 1) return "Anual";
  if (interval === "WEEK" && count === 1) return "Semanal";
  if (interval === "DAY" && count === 1) return "Diária";

  const unit = interval === "DAY" ? "dias" : interval === "WEEK" ? "semanas" : interval === "YEAR" ? "anos" : "meses";
  return `A cada ${count} ${unit}`;
}

function formatTerms(item: ConnectCatalogItem): string {
  const deliveryTerms = metadataValue(item, "deliveryTerms");
  const contractTerm = metadataValue(item, "contractTerm");
  return [deliveryTerms, contractTerm].filter(Boolean).join(" · ") || "-";
}

function formatUpdatedAt(item: ConnectCatalogItem): number {
  const date = new Date(item.updatedAt || item.createdAt);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function CatalogSummaryItem({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="billing-catalog__summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function BillingCatalogSection({
  catalogItems,
  catalogLoadState,
  catalogSearch,
  catalogKindFilter,
  catalogBillingFilter,
  catalogSort,
  catalogPage,
  catalogHasPrevious,
  catalogHasNext,
  catalogIsFetching,
  isCatalogFormOpen,
  deletingCatalogItemId,
  formProps,
  onCatalogSearchChange,
  onCatalogKindFilterChange,
  onCatalogBillingFilterChange,
  onCatalogSortChange,
  onCatalogPrevious,
  onCatalogNext,
  onOpenCatalogForm,
  onCloseCatalogForm,
  onChargeNow,
  onUseCatalogItem,
  onEditCatalogItem,
  onRequestDeleteCatalogItem
}: BillingCatalogSectionProps) {
  const activeItems = useMemo(() => catalogItems.filter((item) => item.isActive), [catalogItems]);
  const recurringCount = useMemo(
    () => activeItems.filter((item) => isRecurringCatalogBillingType(item.billingType)).length,
    [activeItems]
  );
  const averageAmount = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.round(activeItems.reduce((sum, item) => sum + item.amount, 0) / activeItems.length);
  }, [activeItems]);

  const sortedItems = useMemo(() => {
    return [...catalogItems].sort((a, b) => {
      if (catalogSort === "amount-desc") return b.amount - a.amount;
      if (catalogSort === "amount-asc") return a.amount - b.amount;
      if (catalogSort === "name") return a.name.localeCompare(b.name, "pt-BR");
      return formatUpdatedAt(b) - formatUpdatedAt(a);
    });
  }, [catalogItems, catalogSort]);

  const hasCatalogItems = catalogItems.length > 0;
  const hasFilters = Boolean(catalogSearch.trim()) || catalogKindFilter !== "ALL" || catalogBillingFilter !== "ALL";
  const resetFilters = () => {
    onCatalogSearchChange("");
    onCatalogKindFilterChange("ALL");
    onCatalogBillingFilterChange("ALL");
    onCatalogSortChange("recent");
  };

  const columns = useMemo<Array<ResourceTableColumn<ConnectCatalogItem>>>(
    () => [
      {
        id: "item",
        header: "Produto / Serviço",
        width: "minmax(260px, 2.2fr)",
        render: (item) => (
          <div className="billing-catalog__item-cell">
            <strong>{item.name}</strong>
            <span>{item.description || "Sem descrição"}</span>
          </div>
        )
      },
      {
        id: "type",
        header: "Tipo",
        width: "minmax(112px, 0.75fr)",
        render: (item) => (
          <StatusBadge tone="muted" size="sm">
            {CATALOG_KIND_LABEL[item.kind]}
          </StatusBadge>
        )
      },
      {
        id: "price",
        header: "Preço",
        width: "minmax(130px, 0.85fr)",
        render: (item) => <strong className="billing-catalog__price">{formatAmount(item.amount, item.currency)}</strong>
      },
      {
        id: "model",
        header: "Modelo",
        width: "minmax(160px, 1fr)",
        render: (item) => (
          <div className="billing-catalog__stack-cell">
            <strong>{CATALOG_BILLING_LABEL[item.billingType]}</strong>
            <span>{formatRecurrence(item)}</span>
          </div>
        )
      },
      {
        id: "base",
        header: "Base",
        width: "minmax(130px, 0.85fr)",
        render: (item) => <span className="billing-catalog__muted-cell">{formatBase(item)}</span>
      },
      {
        id: "terms",
        header: "Prazo / Vigência",
        width: "minmax(190px, 1.25fr)",
        render: (item) => <span className="billing-catalog__muted-cell">{formatTerms(item)}</span>
      },
      {
        id: "status",
        header: "Status",
        width: "minmax(100px, 0.65fr)",
        render: (item) => (
          <StatusBadge tone={item.isActive ? "success" : "muted"} size="sm" dot>
            {item.isActive ? "Ativo" : "Inativo"}
          </StatusBadge>
        )
      }
    ],
    []
  );

  const emptyState = catalogLoadState === "error" ? (
    <EmptyState
      variant="error"
      title="Não foi possível carregar o catálogo."
      description="Tente novamente em instantes para voltar a gerenciar seus itens de cobrança."
    />
  ) : !hasCatalogItems ? (
    <EmptyState
      variant="table"
      title="Seu catálogo ainda está vazio."
      description="Cadastre produtos e serviços prontos para cobrar, orçar e contratar."
      icon={<AppIcon name="wallet" size={24} />}
      primaryAction={
        <Button type="button" size="sm" variant="primary" onClick={onOpenCatalogForm}>
          <AppIcon name="plus" size={14} />
          Novo item
        </Button>
      }
    />
  ) : (
    <EmptyState
      variant="table"
      title="Nenhum item encontrado."
      description="Ajuste a busca ou remova filtros para ver mais itens do catálogo."
      primaryAction={
        <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
          Limpar filtros
        </Button>
      }
    />
  );

  return (
    <div className="billing-view__panel billing-view__panel--catalog billing-catalog" role="tabpanel">
      <RegistrationList
        title="Catálogo"
        description="Produtos e serviços prontos para cobrar, orçar e contratar."
        actions={
          <Button type="button" variant="primary" onClick={onOpenCatalogForm} className="billing-catalog__primary-action">
            <AppIcon name="plus" size={15} />
            Novo item
          </Button>
        }
        summary={
          <>
            <CatalogSummaryItem label="Itens ativos" value={activeItems.length} detail="Disponíveis para novas cobranças" />
            <CatalogSummaryItem label="Recorrentes" value={recurringCount} detail="Modelos de assinatura no catálogo" />
            <CatalogSummaryItem label="Ticket médio" value={formatAmount(averageAmount, "brl")} detail="Média dos itens ativos" />
          </>
        }
        toolbar={
          <PageToolbar
            compact
            ariaLabel="Filtros do catálogo"
            search={
              <label className="billing-catalog__search">
                <AppIcon name="search" size={15} />
                <TextInput
                  value={catalogSearch}
                  onChange={(event) => onCatalogSearchChange(event.target.value)}
                  placeholder="Buscar por nome, descrição ou escopo"
                  aria-label="Buscar item do catálogo"
                />
              </label>
            }
            filters={
              <>
                <AppSelect
                  value={catalogKindFilter}
                  onValueChange={(value) => onCatalogKindFilterChange(value as CatalogKindFilter)}
                  aria-label="Filtrar por tipo"
                  className="billing-catalog__filter"
                  items={[
                    { value: "ALL", label: "Todos os tipos" },
                    { value: "SERVICE", label: "Serviços" },
                    { value: "PRODUCT", label: "Produtos" }
                  ]}
                />
                <AppSelect
                  value={catalogBillingFilter}
                  onValueChange={(value) => onCatalogBillingFilterChange(value as CatalogBillingFilter)}
                  aria-label="Filtrar por modelo"
                  className="billing-catalog__filter"
                  items={[
                    { value: "ALL", label: "Todos os modelos" },
                    { value: "ONE_TIME", label: "Avulso" },
                    { value: "ASSINATURA", label: "Assinatura" }
                  ]}
                />
                <AppSelect
                  value={catalogSort}
                  onValueChange={(value) => onCatalogSortChange(value as CatalogSort)}
                  aria-label="Ordenar catálogo"
                  className="billing-catalog__filter"
                  items={[
                    { value: "recent", label: "Mais recentes" },
                    { value: "name", label: "Nome" },
                    { value: "amount-desc", label: "Maior preço" },
                    { value: "amount-asc", label: "Menor preço" }
                  ]}
                />
              </>
            }
            end={
              hasFilters ? (
                <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                  Limpar
                </Button>
              ) : (
                <StatusBadge tone="muted" size="sm">{`${sortedItems.length} item${sortedItems.length === 1 ? "" : "s"}`}</StatusBadge>
              )
            }
          />
        }
      >
        <ResourceTable
          data={sortedItems}
          columns={columns}
          rowKey="id"
          className="billing-view__table billing-catalog__table"
          loading={catalogLoadState === "loading"}
          loadingState="Carregando catálogo..."
          emptyState={emptyState}
          responsiveMinWidth="1120px"
          responsiveMinWidthMobile="980px"
          actions={{
            header: "",
            width: "minmax(190px, 0.9fr)",
            cellClassName: "billing-catalog__actions-cell",
            render: (item) => (
              <div className="billing-catalog__row-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onUseCatalogItem(item);
                    onChargeNow();
                  }}
                  disabled={!item.isActive}
                >
                  <AppIcon name="receipt" size={14} />
                  Cobrar
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => onEditCatalogItem(item)}
                  disabled={!item.isActive || deletingCatalogItemId !== null}
                  aria-label={`Editar ${item.name}`}
                  title="Editar"
                >
                  <AppIcon name="pencil" size={14} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="billing-catalog__delete-action"
                  onClick={() => onRequestDeleteCatalogItem(item)}
                  disabled={!item.isActive || deletingCatalogItemId !== null}
                  aria-label={`Excluir ${item.name}`}
                  title={deletingCatalogItemId === item.id ? "Excluindo..." : "Excluir"}
                >
                  <AppIcon name="trash" size={14} />
                </Button>
              </div>
            )
          }}
        />
        {hasCatalogItems || catalogHasPrevious || catalogHasNext ? (
          <div className="billing-view__pagination">
            <span className="billing-view__pagination-label">Página {catalogPage}</span>
            <div className="billing-view__pagination-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCatalogPrevious}
                disabled={!catalogHasPrevious || catalogIsFetching}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCatalogNext}
                disabled={!catalogHasNext || catalogIsFetching}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </RegistrationList>

      {isCatalogFormOpen ? <BillingCatalogForm {...formProps} onCancel={onCloseCatalogForm} /> : null}
    </div>
  );
}
