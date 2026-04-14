import { billingService } from "../api/billing-service";
import type { BillingState, BillingStatus } from "./types";

type BillingListener = () => void;

const initialState: BillingState = {
  loadState: "idle",
  status: null,
  error: null
};

export class BillingStore {
  private state: BillingState = initialState;
  private readonly listeners = new Set<BillingListener>();
  private fetchInFlight: Promise<void> | null = null;

  subscribe(listener: BillingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): BillingState {
    return this.state;
  }

  async load(): Promise<void> {
    if (this.fetchInFlight) return this.fetchInFlight;

    this.setState({ loadState: "loading", error: null });

    const run = billingService
      .getStatus()
      .then((status) => {
        this.setState({ loadState: "loaded", status, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Erro ao carregar status da assinatura.";
        this.setState({ loadState: "error", error: message });
      })
      .finally(() => {
        this.fetchInFlight = null;
      });

    this.fetchInFlight = run;
    return run;
  }

  setStatus(status: BillingStatus): void {
    this.setState({ loadState: "loaded", status, error: null });
  }

  reset(): void {
    this.setState(initialState);
  }

  private setState(partial: Partial<BillingState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }
}

export const billingStore = new BillingStore();
