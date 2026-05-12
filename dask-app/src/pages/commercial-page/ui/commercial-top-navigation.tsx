import { ModuleTabs, PageToolbar, WorkspaceActionButton } from "@/shared/ui";
import { IconRefresh, IconTrendUp, IconUsers } from "./commercial-page-icons";
import { TABS, type CommercialTab } from "./commercial-page.model";

export function CommercialTopNavigation({
  tab,
  isAuxLoading,
  isSubmitting,
  onChangeTab,
  onRefresh,
  onNewCustomer,
  onNewCommercialWorkItem,
  onNewSignal,
  canCreateCommercialWorkItem = true,
  canCreateSignal = true
}: {
  tab: CommercialTab;
  isAuxLoading: boolean;
  isSubmitting: boolean;
  onChangeTab: (tab: CommercialTab) => void;
  onRefresh: () => void;
  onNewCustomer: () => void;
  onNewCommercialWorkItem: () => void;
  onNewSignal: () => void;
  canCreateCommercialWorkItem?: boolean;
  canCreateSignal?: boolean;
}) {
  return (
    <section className="commercial-top-nav" aria-label="Navegação comercial">
      <ModuleTabs<CommercialTab> value={tab} items={TABS} onChange={onChangeTab} className="commercial-page__tabs" variant="underline" />
      <PageToolbar
        className="commercial-top-nav__actions"
        compact
        ariaLabel="Acoes comerciais"
        end={
          <>
            <WorkspaceActionButton className="commercial-top-nav__btn" label="Atualizar" icon={<IconRefresh />} onClick={onRefresh} disabled={isAuxLoading || isSubmitting} />
            <WorkspaceActionButton className="commercial-top-nav__btn commercial-top-nav__btn--customer" label="Novo cliente" icon={<IconUsers />} onClick={onNewCustomer} />
            <WorkspaceActionButton className="commercial-top-nav__btn" label="Novo signal" icon={<IconTrendUp />} onClick={onNewSignal} disabled={!canCreateSignal || isSubmitting} />
            <WorkspaceActionButton className="commercial-top-nav__btn commercial-top-nav__btn--workItem" tone="accent" label="Novo WorkItem" icon={<IconTrendUp />} onClick={onNewCommercialWorkItem} disabled={!canCreateCommercialWorkItem || isSubmitting} />
          </>
        }
      />
    </section>
  );
}
