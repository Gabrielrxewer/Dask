import type { ConnectAccountStatus } from "./types";

export type OnboardingStepKey =
  | "business_profile"
  | "legal_entity"
  | "bank_account"
  | "identity_verification"
  | "tax_information";

export interface OnboardingChecklistItem {
  key: OnboardingStepKey;
  title: string;
  description: string;
  done: boolean;
  pendingReasons: string[];
}

const STEP_DEFS: Array<{
  key: OnboardingStepKey;
  title: string;
  description: string;
  patterns: RegExp[];
}> = [
  {
    key: "business_profile",
    title: "Dados do negocio",
    description: "Nome comercial, atividade e informacoes publicas da empresa.",
    patterns: [/business_profile/i, /company\.name/i, /individual\.business_profile/i]
  },
  {
    key: "legal_entity",
    title: "Dados legais da conta",
    description: "Endereco, representante e informacoes legais do titular.",
    patterns: [/company\./i, /individual\./i, /representative/i, /address/i, /dob/i]
  },
  {
    key: "bank_account",
    title: "Conta para recebimento",
    description: "Conta bancaria para repasse dos valores recebidos.",
    patterns: [/external_account/i, /bank_account/i, /iban/i, /routing_number/i]
  },
  {
    key: "identity_verification",
    title: "Verificacao de identidade",
    description: "Documentos e validacoes exigidas para compliance.",
    patterns: [/verification/i, /document/i, /id_number/i]
  },
  {
    key: "tax_information",
    title: "Informacoes fiscais",
    description: "Dados tributarios exigidos para operar com cobranca.",
    patterns: [/tax/i, /vat/i, /tin/i]
  }
];

function pickPendingReasons(requirementsDue: string[], patterns: RegExp[]): string[] {
  return requirementsDue.filter((item) => patterns.some((pattern) => pattern.test(item)));
}

export function buildOnboardingChecklist(status: ConnectAccountStatus | null): OnboardingChecklistItem[] {
  if (!status) {
    return STEP_DEFS.map((step) => ({
      key: step.key,
      title: step.title,
      description: step.description,
      done: false,
      pendingReasons: []
    }));
  }

  return STEP_DEFS.map((step) => {
    const pendingReasons = pickPendingReasons(status.requirementsDue, step.patterns);
    return {
      key: step.key,
      title: step.title,
      description: step.description,
      done: pendingReasons.length === 0,
      pendingReasons
    };
  });
}

export function getNextOnboardingAction(
  status: ConnectAccountStatus | null,
  checklist: OnboardingChecklistItem[]
): string {
  if (!status) {
    return "Iniciar cadastro da conta Connect";
  }

  if (!status.detailsSubmitted) {
    return "Completar formulario de cadastro no Stripe Connect";
  }

  const nextPending = checklist.find((item) => !item.done);
  if (nextPending) {
    return `Concluir etapa: ${nextPending.title}`;
  }

  if (!status.chargesEnabled) {
    return "Aguardar liberacao de cobrancas pela Stripe";
  }

  if (!status.payoutsEnabled) {
    return "Cadastrar ou validar conta para repasses";
  }

  return "Conta pronta para cobrar e receber";
}
