// These will be enriched by `prisma generate` but we define the union types here
// so the module compiles before migration runs.
export type SubscriptionPlan = 'PERSONAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED';

export const SUBSCRIPTION_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const satisfies SubscriptionPlan[];
export const LEGACY_SUBSCRIPTION_PLANS = ['PERSONAL'] as const;

export const PLAN_PRICE_IDS: Record<SubscriptionPlan, string> = {
  PERSONAL: process.env.STRIPE_PRICE_ID_PERSONAL_MONTHLY ?? '',
  BASIC: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY ?? '',
  PRO: process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? '',
  ENTERPRISE: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY ?? '',
  BUSINESS: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? ''
};

export const BUSINESS_WORKSPACE_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export const SELF_SERVICE_SUBSCRIPTION_PLANS = ['BASIC', 'PRO', 'BUSINESS'] as const;

export const SUBSCRIPTION_PLAN_CATALOG: Record<Exclude<SubscriptionPlan, 'PERSONAL'>, {
  name: string;
  description: string;
  amount: number;
  currency: 'brl';
  features: string[];
  selfService: boolean;
}> = {
  BASIC: {
    name: 'Basic',
    description: 'Para iniciar a operacao em workspace business com os fluxos essenciais do Dask.',
    amount: 14990,
    currency: 'brl',
    features: ['Workspace business', 'Boards, lista e agenda', 'Documentacao operacional', 'Cobranca mensal recorrente'],
    selfService: true
  },
  PRO: {
    name: 'Pro',
    description: 'Para times que precisam de mais automacao, visibilidade e continuidade entre comercial e entrega.',
    amount: 29990,
    currency: 'brl',
    features: ['Tudo do Basic', 'Automacoes e IA contextual', 'Comercial e documentacao integrados', 'Gestao de assinatura e billing'],
    selfService: true
  },
  BUSINESS: {
    name: 'Business',
    description: 'Para operacoes com governanca, fiscal, billing Connect e multiplas frentes de trabalho.',
    amount: 49990,
    currency: 'brl',
    features: ['Tudo do Pro', 'Fiscal e Stripe Connect', 'Permissoes e auditoria', 'Workspaces business para equipe'],
    selfService: true
  },
  ENTERPRISE: {
    name: 'Enterprise',
    description: 'Para operacoes com contrato, implantacao assistida e condicoes comerciais sob medida.',
    amount: 0,
    currency: 'brl',
    features: ['Tudo do Business', 'Condicoes negociadas', 'Suporte e onboarding assistido', 'Contrato empresarial'],
    selfService: false
  }
};

export function isBusinessWorkspacePlan(plan: SubscriptionPlan | string | null | undefined): boolean {
  return BUSINESS_WORKSPACE_PLANS.includes(plan as (typeof BUSINESS_WORKSPACE_PLANS)[number]);
}

/** Stripe statuses that grant full platform access */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

export function isSubscriptionActive(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.includes(status);
}

export interface BillingStatus {
  hasActiveSubscription: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canAccessPlatform: boolean;
  canCreateWorkspace: boolean;
  message: string | null;
}
