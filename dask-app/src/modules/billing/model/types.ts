export type SubscriptionPlan = 'PERSONAL' | 'BUSINESS';
export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED';

export interface BillingStatus {
  hasActiveSubscription: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canAccessPlatform: boolean;
  canCreateWorkspace: boolean;
  message: string | null;
}

export type BillingLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface BillingState {
  loadState: BillingLoadState;
  status: BillingStatus | null;
  error: string | null;
}

export const PLAN_DISPLAY: Record<SubscriptionPlan, { name: string; price: string; description: string }> = {
  PERSONAL: {
    name: 'Pessoal',
    price: 'R$ 19,90',
    description: 'Para uso individual, organizar tarefas, projetos e fluxos pessoais.'
  },
  BUSINESS: {
    name: 'Business',
    price: 'R$ 99,00',
    description: 'Para equipes e operacoes corporativas com recursos avancados.'
  }
};
