import { ModuleTabs, PageToolbar, WorkspaceActionButton } from "@/shared/ui";
import { IconRefresh, IconTrendUp, IconUsers } from "./leads-page-icons";
import { TABS, type LeadsTab } from "./leads-page.model";

export function LeadsTopNavigation({
  tab,
  isAuxLoading,
  isSubmitting,
  onChangeTab,
  onRefresh,
  onNewCustomer,
  onNewLead
}: {
  tab: LeadsTab;
  isAuxLoading: boolean;
  isSubmitting: boolean;
  onChangeTab: (tab: LeadsTab) => void;
  onRefresh: () => void;
  onNewCustomer: () => void;
  onNewLead: () => void;
}) {
  return (
    <section className="leads-top-nav" aria-label="Navegação comercial">
      <ModuleTabs<LeadsTab> value={tab} items={TABS} onChange={onChangeTab} className="leads-page__tabs" variant="underline" />
      <PageToolbar
        className="leads-top-nav__actions"
        compact
        ariaLabel="Acoes comerciais"
        end={
          <>
            <WorkspaceActionButton className="leads-top-nav__btn" label="Atualizar" icon={<IconRefresh />} onClick={onRefresh} disabled={isAuxLoading || isSubmitting} />
            <WorkspaceActionButton className="leads-top-nav__btn leads-top-nav__btn--customer" label="Novo cliente" icon={<IconUsers />} onClick={onNewCustomer} />
            <WorkspaceActionButton className="leads-top-nav__btn leads-top-nav__btn--lead" tone="accent" label="Novo lead" icon={<IconTrendUp />} onClick={onNewLead} />
          </>
        }
      />
    </section>
  );
}
