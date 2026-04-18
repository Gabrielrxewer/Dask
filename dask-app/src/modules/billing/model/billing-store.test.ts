/**
 * BillingStore unit tests
 *
 * Covers: load, setStatus, reset, and subscription state transitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingStore } from "./billing-store";
import type { BillingStatus } from "./types";

vi.mock("../api/billing-service", () => ({
  billingService: {
    getStatus: vi.fn(),
    createCheckoutSession: vi.fn()
  }
}));

import { billingService } from "../api/billing-service";

function makeStatus(overrides: Partial<BillingStatus> = {}): BillingStatus {
  return {
    hasActiveSubscription: true,
    plan: "PERSONAL",
    status: "ACTIVE",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canAccessPlatform: true,
    canCreateWorkspace: true,
    message: null,
    ...overrides
  };
}

describe("BillingStore", () => {
  let store: BillingStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new BillingStore();
  });

  it("starts in idle state", () => {
    const snap = store.getSnapshot();
    expect(snap.loadState).toBe("idle");
    expect(snap.status).toBeNull();
  });

  it("transitions to loaded after successful fetch", async () => {
    (billingService.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeStatus());

    const listener = vi.fn();
    store.subscribe(listener);

    await store.load();

    const snap = store.getSnapshot();
    expect(snap.loadState).toBe("loaded");
    expect(snap.status?.canAccessPlatform).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("transitions to error state on failed fetch", async () => {
    (billingService.getStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    await store.load();

    expect(store.getSnapshot().loadState).toBe("error");
    expect(store.getSnapshot().error).toBeTruthy();
  });

  it("deduplicates concurrent load calls", async () => {
    (billingService.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeStatus());

    await Promise.all([store.load(), store.load(), store.load()]);

    expect(billingService.getStatus).toHaveBeenCalledTimes(1);
  });

  it("setStatus updates the store directly without fetch", () => {
    const status = makeStatus({ plan: "BUSINESS" });
    store.setStatus(status);

    const snap = store.getSnapshot();
    expect(snap.loadState).toBe("loaded");
    expect(snap.status?.plan).toBe("BUSINESS");
  });

  it("reset returns store to idle state", () => {
    store.setStatus(makeStatus());
    store.reset();

    const snap = store.getSnapshot();
    expect(snap.loadState).toBe("idle");
    expect(snap.status).toBeNull();
  });

  it("sets canAccessPlatform=false for CANCELED subscription", async () => {
    const blocked = makeStatus({
      hasActiveSubscription: false,
      status: "CANCELED",
      canAccessPlatform: false,
      canCreateWorkspace: false,
      message: "Assinatura cancelada."
    });
    (billingService.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue(blocked);

    await store.load();

    expect(store.getSnapshot().status?.canAccessPlatform).toBe(false);
  });
});
