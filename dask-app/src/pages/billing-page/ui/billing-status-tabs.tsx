import { StatusBadge, Tabs, WorkspaceTopNavigation, type TabsItem } from "@/shared/ui";
import type { ActiveTab } from "./billing-page.model";

interface BillingNavigationProps {
  activeTab: ActiveTab;
  pendingCount: number;
  catalogCount: number;
  paymentOrderCount: number;
  canCreateCheckout: boolean;
  onTabChange: (tab: ActiveTab) => void;
}

function buildBillingTabs({
  pendingCount,
  catalogCount,
  paymentOrderCount,
  canCreateCheckout,
  badgeClassName,
  countClassName,
  lockedClassName
}: Pick<BillingNavigationProps, "pendingCount" | "catalogCount" | "paymentOrderCount" | "canCreateCheckout"> & {
  badgeClassName: string;
  countClassName: string;
  lockedClassName?: string;
}): Array<TabsItem<ActiveTab>> {
  return [
    {
      id: "conta",
      label: "Conta",
      badge: pendingCount > 0 ? <StatusBadge count={pendingCount} size="sm" tone="warning" className={badgeClassName} /> : undefined,
      badgeClassName
    },
    {
      id: "catalogo",
      label: "Cat\u00e1logo",
      badge: catalogCount > 0 ? <StatusBadge count={catalogCount} size="sm" tone="info" className={countClassName} /> : undefined,
      badgeClassName: countClassName
    },
    {
      id: "cobrar",
      label: "Cobrar",
      locked: !canCreateCheckout,
      className: !canCreateCheckout ? lockedClassName : undefined
    },
    {
      id: "historico",
      label: "Hist\u00f3rico",
      badge: paymentOrderCount > 0 ? <StatusBadge count={paymentOrderCount} size="sm" tone="muted" className={countClassName} /> : undefined,
      badgeClassName: countClassName
    }
  ];
}

export function BillingTopNavigation({
  activeTab,
  pendingCount,
  catalogCount,
  paymentOrderCount,
  canCreateCheckout,
  onTabChange
}: BillingNavigationProps) {
  return (
    <WorkspaceTopNavigation
      value={activeTab}
      items={buildBillingTabs({
        pendingCount,
        catalogCount,
        paymentOrderCount,
        canCreateCheckout,
        badgeClassName: "billing-top-nav__badge",
        countClassName: "billing-top-nav__count",
        lockedClassName: "billing-top-nav__tab--locked"
      })}
      onChange={onTabChange}
      ariaLabel="Navegacao de cobranca"
      className="billing-top-nav"
      tabsClassName="billing-top-nav__tabs"
      labelClassName="billing-top-nav__tab-copy"
    />
  );
}

export function BillingStatusTabs({
  activeTab,
  pendingCount,
  catalogCount,
  paymentOrderCount,
  canCreateCheckout,
  onTabChange
}: BillingNavigationProps) {
  return (
    <Tabs
      value={activeTab}
      items={buildBillingTabs({
        pendingCount,
        catalogCount,
        paymentOrderCount,
        canCreateCheckout,
        badgeClassName: "billing-view__tab-badge",
        countClassName: "billing-view__tab-count"
      })}
      onChange={onTabChange}
      ariaLabel="Abas de cobranca"
      className="billing-view__tabs"
      itemClassName="billing-view__tab"
      activeItemClassName="is-active"
      lockedItemClassName="is-locked"
    />
  );
}
