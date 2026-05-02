import { StatusBadge, WorkspaceActionButton, WorkspaceTopNavigation } from "@/shared/ui";
import { MARKETING_TABS, type MarketingTab } from "./marketing-page.model";
import { REFRESH_ICON } from "./marketing-page-icons";

interface MarketingTabsProps {
  tab: MarketingTab;
  onTabChange: (tab: MarketingTab) => void;
  onRefresh: () => void;
  isRefreshDisabled: boolean;
  signalUnreadCount: number;
}

export function MarketingTabs({
  tab,
  onTabChange,
  onRefresh,
  isRefreshDisabled,
  signalUnreadCount
}: MarketingTabsProps) {
  return (
    <WorkspaceTopNavigation<MarketingTab>
      value={tab}
      items={MARKETING_TABS}
      onChange={onTabChange}
      ariaLabel="Navegacao de marketing"
      className="marketing-top-nav"
      tabsClassName="marketing-page__tabs"
      actionsClassName="marketing-top-nav__actions"
      actions={
        <>
          <WorkspaceActionButton
            className="marketing-top-nav__btn"
            label="Atualizar marketing"
            icon={REFRESH_ICON}
            onClick={onRefresh}
            disabled={isRefreshDisabled}
          />
          {signalUnreadCount > 0 ? (
            <button
              type="button"
              className="marketing-top-nav__signal-badge"
              onClick={() => onTabChange("inbox")}
              title={`${signalUnreadCount} sinais nao lidos`}
            >
              <StatusBadge count={signalUnreadCount} size="sm" tone="danger" className="marketing-top-nav__signal-count" />
            </button>
          ) : null}
          <WorkspaceActionButton
            className="marketing-top-nav__btn"
            tone="accent"
            label="Nova campanha"
            icon="+"
            onClick={() => onTabChange("campaigns")}
          />
        </>
      }
    />
  );
}
