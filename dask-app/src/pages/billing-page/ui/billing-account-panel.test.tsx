import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConnectAccountStatus } from "@/modules/billing";
import { BillingAccountPanel } from "./billing-account-panel";

function makeConnectStatus(overrides: Partial<ConnectAccountStatus> = {}): ConnectAccountStatus {
  return {
    workspaceId: "workspace-1",
    stripeAccountId: "acct_1",
    controllerType: "express",
    dashboardType: "express",
    requirementCollection: null,
    disabledReason: null,
    detailsSubmitted: true,
    chargesEnabled: false,
    payoutsEnabled: false,
    cardPaymentsStatus: "active",
    pixPaymentsStatus: "active",
    boletoPaymentsStatus: "inactive",
    capabilities: {},
    onboardingComplete: false,
    requirementsDue: ["business_profile.url"],
    requirementsPastDue: [],
    requirementsEventuallyDue: [],
    requirementsPendingVerification: [],
    ...overrides
  };
}

function renderPanel(canManageSensitiveConnectSettings: boolean) {
  return renderToStaticMarkup(
    <BillingAccountPanel
      statusCards={[]}
      canCreateCheckout={false}
      onboardingSummary={{ title: "Cadastro incompleto", subtitle: "Falta completar.", progress: 50 }}
      currentOnboardingStage="Cadastro"
      connectStatus={makeConnectStatus()}
      pendingItems={[]}
      completedItems={[]}
      connectError={null}
      isOpeningOnboarding={false}
      canManageSensitiveConnectSettings={canManageSensitiveConnectSettings}
      requestingCapability={null}
      onOpenOnboarding={vi.fn()}
      onRequestPaymentCapability={vi.fn()}
    />
  );
}

describe("BillingAccountPanel", () => {
  it("disables sensitive Connect actions and explains permission for non-owner roles", () => {
    const html = renderPanel(false);

    expect(html).toContain("Apenas o proprietario do workspace pode alterar onboarding e formas de pagamento do Stripe Connect.");
    expect(html).toContain("Completar cadastro");
    expect(html).toContain("Habilitar boleto");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps sensitive Connect actions enabled for owners", () => {
    const html = renderPanel(true);

    expect(html).not.toContain("Apenas o proprietario do workspace pode alterar onboarding");
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(0);
  });
});
