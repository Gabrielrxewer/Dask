export type SmokeFlow =
  | "auth"
  | "workspace"
  | "dashboard"
  | "list"
  | "agenda"
  | "board"
  | "marketing"
  | "automation"
  | "documentation"
  | "billing"
  | "fiscal"
  | "ai";
export type SmokeOutcome = "passed" | "failed" | "environment_gap" | "skipped";

export interface SmokeConfig {
  releaseSmoke: boolean;
  baseUrl: string;
  apiUrl: string;
  hasExplicitBaseUrl: boolean;
  hasExplicitApiUrl: boolean;
  email?: string;
  password?: string;
  workspaceSlug?: string;
  workspaceId?: string;
  runExternals: boolean;
  skipStripe: boolean;
  skipFocus: boolean;
  skipAi: boolean;
  createFiscalCompany: boolean;
  createFiscalDraft: boolean;
  focusToken?: string;
  fiscalCompanyId?: string;
}

export interface SmokeStepResult {
  flow: SmokeFlow;
  name: string;
  outcome: SmokeOutcome;
  status?: number;
  message?: string;
}

export interface SmokeWorkspace {
  id: string;
  name?: string;
  key?: string;
  slug: string;
  role?: string;
}

export interface SmokeResponse<T = unknown> {
  status: number;
  ok: boolean;
  payload: T;
  headers: Headers;
}

export class SmokeHttpError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  public constructor(status: number, payload: unknown, message?: string) {
    super(message ?? readMessage(payload) ?? `HTTP ${status}`);
    this.name = "SmokeHttpError";
    this.status = status;
    this.payload = payload;
  }
}

type SmokeEnv = Record<string, string | undefined>;

const DEFAULT_BASE_URL = "http://localhost:5173";
const DEFAULT_API_URL = "http://localhost:3333/api/v1";

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function readSmokeConfig(env: SmokeEnv): SmokeConfig {
  const explicitBaseUrl = trimOptional(env.DASK_SMOKE_BASE_URL);
  const explicitApiUrl = trimOptional(env.DASK_SMOKE_API_URL);

  return {
    releaseSmoke: readBoolean(env.DASK_RELEASE_SMOKE),
    baseUrl: normalizeUrl(explicitBaseUrl ?? DEFAULT_BASE_URL),
    apiUrl: normalizeUrl(explicitApiUrl ?? DEFAULT_API_URL),
    hasExplicitBaseUrl: Boolean(explicitBaseUrl),
    hasExplicitApiUrl: Boolean(explicitApiUrl),
    email: trimOptional(env.DASK_SMOKE_EMAIL),
    password: trimOptional(env.DASK_SMOKE_PASSWORD),
    workspaceSlug: trimOptional(env.DASK_SMOKE_WORKSPACE_SLUG),
    workspaceId: trimOptional(env.DASK_SMOKE_WORKSPACE_ID),
    runExternals: readBoolean(env.DASK_SMOKE_RUN_EXTERNALS),
    skipStripe: readBoolean(env.DASK_SMOKE_SKIP_STRIPE),
    skipFocus: readBoolean(env.DASK_SMOKE_SKIP_FOCUS),
    skipAi: readBoolean(env.DASK_SMOKE_SKIP_AI),
    createFiscalCompany: readBoolean(env.DASK_SMOKE_CREATE_FISCAL_COMPANY),
    createFiscalDraft: readBoolean(env.DASK_SMOKE_CREATE_FISCAL_DRAFT),
    focusToken: trimOptional(env.DASK_SMOKE_FOCUS_TOKEN),
    fiscalCompanyId: trimOptional(env.DASK_SMOKE_FISCAL_COMPANY_ID)
  };
}

export function getMissingRequiredSmokeConfig(config: SmokeConfig): string[] {
  const missing: string[] = [];
  if (config.releaseSmoke && !config.hasExplicitBaseUrl) missing.push("DASK_SMOKE_BASE_URL");
  if (config.releaseSmoke && !config.hasExplicitApiUrl) missing.push("DASK_SMOKE_API_URL");
  if (!config.email) missing.push("DASK_SMOKE_EMAIL");
  if (!config.password) missing.push("DASK_SMOKE_PASSWORD");
  if (!config.workspaceId && !config.workspaceSlug) {
    missing.push("DASK_SMOKE_WORKSPACE_ID or DASK_SMOKE_WORKSPACE_SLUG");
  }
  return missing;
}

export function formatSmokeConfigHelp(missing: string[]): string {
  return [
    "[smoke] Authenticated smoke skipped: required environment is missing.",
    `Missing: ${missing.join(", ")}`,
    "Set DASK_SMOKE_API_URL, DASK_SMOKE_EMAIL, DASK_SMOKE_PASSWORD and either DASK_SMOKE_WORKSPACE_ID or DASK_SMOKE_WORKSPACE_SLUG.",
    "External Stripe/Focus/AI calls stay disabled unless DASK_SMOKE_RUN_EXTERNALS=true and the specific skip flag is false."
  ].join("\n");
}

export function formatReleaseSmokeConfigError(missing: string[]): string {
  return [
    "[smoke] Release authenticated smoke failed: required environment is missing.",
    `Missing: ${missing.join(", ")}`,
    "Set DASK_RELEASE_SMOKE=1 only in release/staging gates with DASK_SMOKE_BASE_URL, DASK_SMOKE_API_URL, DASK_SMOKE_EMAIL, DASK_SMOKE_PASSWORD and either DASK_SMOKE_WORKSPACE_ID or DASK_SMOKE_WORKSPACE_SLUG.",
    "Secrets are intentionally not printed."
  ].join("\n");
}

function readMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEnvironmentMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    "connect",
    "stripe",
    "focus",
    "provider",
    "not configured",
    "nao configur",
    "não configur",
    "capability",
    "account",
    "automation runtime"
  ].some((part) => normalized.includes(part));
}

export function classifySmokeError(
  flow: SmokeFlow,
  error: unknown,
  options: { external?: boolean } = {}
): SmokeStepResult {
  if (!(error instanceof SmokeHttpError)) {
    return {
      flow,
      name: "unexpected error",
      outcome: "failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  const message = error.message;
  if (error.status === 401) {
    return {
      flow,
      name: "authenticated request",
      outcome: flow === "auth" ? "failed" : "environment_gap",
      status: error.status,
      message: flow === "auth"
        ? "Authentication failed with the provided smoke credentials."
        : "Protected route rejected the current smoke session."
    };
  }

  if (flow === "billing" && [404, 409, 422, 424].includes(error.status) && isEnvironmentMessage(message)) {
    return { flow, name: "Stripe/Connect environment", outcome: "environment_gap", status: error.status, message };
  }

  if (flow === "fiscal" && [401, 404, 409, 422, 424, 503].includes(error.status) && (options.external || isEnvironmentMessage(message))) {
    return { flow, name: "Focus Fiscal environment", outcome: "environment_gap", status: error.status, message };
  }

  if (flow === "ai" && [400, 409, 422, 424, 503].includes(error.status) && isEnvironmentMessage(message)) {
    return { flow, name: "AI provider/runtime environment", outcome: "environment_gap", status: error.status, message };
  }

  return { flow, name: "contract error", outcome: "failed", status: error.status, message };
}

export function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${label} response must be an object.`);
  }
}

export function assertPageResponse(value: unknown, label: string): asserts value is { items: unknown[]; nextCursor?: string | null } {
  assertRecord(value, label);
  if (!Array.isArray(value.items)) {
    throw new Error(`${label} response must include items array.`);
  }
  if ("nextCursor" in value && value.nextCursor !== null && typeof value.nextCursor !== "string") {
    throw new Error(`${label} nextCursor must be string or null.`);
  }
}

export function assertArrayResponse(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} response must be an array.`);
  }
}

export function toWorkspaceSlug(workspace: Pick<SmokeWorkspace, "id" | "key" | "name">): string {
  const preferred = workspace.key || workspace.name || workspace.id;
  return preferred
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeSmokeId(now = new Date()): string {
  return `${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeBillingCatalogPayload(smokeId: string) {
  return {
    kind: "SERVICE",
    billingType: "ONE_TIME",
    name: `SMOKE_Catalog_${smokeId}`,
    description: `SMOKE contract item ${smokeId}`,
    amount: 1234,
    currency: "brl",
    metadata: {
      unit: "service",
      defaultQuantity: "1",
      scope: "Smoke validation scope",
      deliverables: "Smoke validation deliverable",
      deliveryTerms: "Delivered during smoke validation",
      paymentTerms: "Due on checkout",
      proposalValidity: "7 days",
      contractTerm: "One-off",
      cancellationTerms: "Smoke data can be archived",
      clientResponsibilities: "Provide smoke context",
      acceptanceCriteria: "HTTP contract remains compatible"
    }
  };
}

export function makeFiscalCompanyPayload(smokeId: string, focusToken: string) {
  return {
    displayName: `SMOKE Fiscal ${smokeId}`,
    legalName: `SMOKE Fiscal ${smokeId} LTDA`,
    cnpj: "00000000000191",
    focusToken,
    focusEnvironment: "homologacao",
    emitAutomatically: false,
    stripePolicy: "manual_review",
    metadata: { smoke: "true", smokeId }
  };
}

export function makeFiscalDraftPayload(smokeId: string, companyConfigId?: string | null) {
  return {
    companyConfigId: companyConfigId ?? null,
    internalReference: `SMOKE_${smokeId}`,
    direction: "OUTBOUND",
    documentType: "NFSE",
    origin: "MANUAL_SERVICE",
    sourceSystem: "INTERNAL",
    amountSubtotal: "12.34",
    amountTotal: "12.34",
    currency: "BRL",
    metadata: { smoke: "true", smokeId, policy: "manual_review" },
    items: [
      {
        itemType: "SERVICE",
        name: `SMOKE service ${smokeId}`,
        quantity: "1",
        unit: "service",
        unitPrice: "12.34",
        totalAmount: "12.34",
        metadata: { smoke: "true" }
      }
    ],
    parties: [
      {
        role: "EMITTER",
        name: "SMOKE Emitter",
        cnpjCpf: "00000000000191"
      },
      {
        role: "TAKER",
        name: "SMOKE Taker",
        cnpjCpf: "00000000000191",
        email: "smoke@example.invalid"
      }
    ]
  };
}

export function makeAiAgentPayload(smokeId: string) {
  return {
    key: `smoke-${smokeId.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48)}`,
    name: `SMOKE Agent ${smokeId}`,
    description: "SMOKE agent for authenticated contract validation.",
    model: "gpt-4.1-mini",
    temperature: 0.1,
    systemPrompt: "Answer smoke-test instructions briefly without exposing sensitive data.",
    config: {
      tools: { enabled: false, allowed: [] },
      rag: {
        enabled: false,
        source: "none",
        includeSemanticContext: false,
        includeLinkedDocuments: false,
        topKContextDocs: 1
      },
      guardrails: { redactSensitive: true }
    },
    isActive: true
  };
}

export class SmokeHttpClient {
  private accessToken: string | null = null;

  public constructor(private readonly apiUrl: string) {}

  public setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  public async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown; auth?: boolean } = {}
  ): Promise<SmokeResponse<T>> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.apiUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      throw new SmokeHttpError(response.status, payload);
    }

    return {
      status: response.status,
      ok: response.ok,
      payload: payload as T,
      headers: response.headers
    };
  }
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : undefined;
}
