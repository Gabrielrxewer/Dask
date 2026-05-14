import { expect, test, type Page, type Route } from "@playwright/test";

const workspaceSlug = "smoke";
const now = "2026-05-12T12:00:00.000Z";

const appFlows = [
  { name: "Settings", path: `/w/${workspaceSlug}/settings`, visibleText: "Settings" },
  { name: "List", path: `/w/${workspaceSlug}/list`, visibleText: "List" },
  { name: "Agenda", path: `/w/${workspaceSlug}/agenda`, visibleText: "Agenda" },
  { name: "Marketing Journey", path: `/w/${workspaceSlug}/marketing`, visibleText: "Marketing" },
  { name: "Automations FlowCanvas", path: `/w/${workspaceSlug}/automations`, visibleText: "Workflow Smoke" },
  { name: "Billing", path: `/w/${workspaceSlug}/billing`, visibleText: "Cobranca" },
  { name: "Fiscal", path: `/w/${workspaceSlug}/fiscal`, visibleText: "Fiscal" }
];

const publicFlows = [
  { name: "Public Proposal invalid token", path: "/proposals/public/invalid-smoke-token", visibleText: "Link invalido" },
  { name: "Public Document invalid token", path: "/documents/public/invalid-smoke-token", visibleText: "Link invalido" },
  { name: "Public Billing missing token", path: "/portal/billing", visibleText: "Link invalido" },
  { name: "Public Billing expired token", path: "/portal/billing?token=expired-smoke-token", visibleText: "Link invalido" }
];

test.describe("visual/mobile/a11y smoke", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  for (const flow of appFlows) {
    test(`${flow.name} renders without visual smoke regressions`, async ({ page }, testInfo) => {
      await openAndCheck(page, flow.path, flow.visibleText);

      if (flow.name === "Marketing Journey") {
        await openMarketingJourney(page);
      }

      if (flow.name === "Automations FlowCanvas") {
        await exerciseAutomationCanvas(page);
      }

      if (flow.name === "Settings") {
        await exerciseSettingsToast(page);
      }

      if (flow.name === "Billing") {
        await exerciseBillingModal(page);
      }

      await expectNoHorizontalOverflow(page);
      await expectKeyboardReachableControl(page);
      await saveEvidence(page, testInfo, flow.name);
    });
  }

  for (const flow of publicFlows) {
    test(`${flow.name} renders handled public state`, async ({ page }, testInfo) => {
      await openAndCheck(page, flow.path, flow.visibleText);
      await expectNoHorizontalOverflow(page);
      await expectKeyboardReachableControl(page);
      await saveEvidence(page, testInfo, flow.name);
    });
  }
});

async function openAndCheck(page: Page, path: string, visibleText: string) {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${sanitizeLog(message.text())}`);
    }
  });

  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toContainText(visibleText);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("text=/vite|webpack|react error overlay/i")).toHaveCount(0);
  expect(consoleMessages.filter(isRelevantConsoleMessage), consoleMessages.join("\n")).toEqual([]);
}

async function openMarketingJourney(page: Page) {
  const overviewShortcut = page.getByRole("button", { name: /Jornadas.*ativas/i });
  if (await overviewShortcut.count()) {
    await overviewShortcut.click();
  } else {
    const journeysTab = page.getByRole("tab", { name: "Jornadas" });
    await journeysTab.focus();
    await page.keyboard.press("Enter");
    if ((await journeysTab.getAttribute("aria-selected")) !== "true") {
      await journeysTab.click();
    }
  }
  await expect(page.locator("body")).toContainText("Jornadas");
  await openFlowPalette(page);
}

async function exerciseAutomationCanvas(page: Page) {
  await expect(page.locator("body")).toContainText("Workflow Smoke");
  await openFlowPalette(page);
}

async function openFlowPalette(page: Page) {
  const toggle = page.getByRole("button", { name: "Abrir painel de nos" });
  if (await toggle.count()) {
    await toggle.click();
    await expect(page.locator("body")).toContainText(/Gatilho|Acao|Ação|Jornada|Node|No/);
  }
}

async function exerciseSettingsToast(page: Page) {
  const switches = page.getByRole("switch");
  if ((await switches.count()) === 0) return;
  await switches.first().click();
  await expect(page.locator("body")).toContainText(/Modulo|Modulos|atualizado|atualizados/i);
}

async function exerciseBillingModal(page: Page) {
  const candidates = [
    page.getByRole("button", { name: "Novo item" }),
    page.getByRole("button", { name: "Adicionar item" }),
    page.getByRole("button", { name: "Nova cobranca" }),
    page.getByRole("button", { name: "Nova cobrança" })
  ];
  for (const candidate of candidates) {
    if ((await candidate.count()) === 1) {
      await candidate.click();
      await expect(page.locator("[role='dialog'], .billing-catalog-form")).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      await page.keyboard.press("Escape");
      return;
    }
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowAmount = Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right - document.documentElement.clientWidth > 2;
      })
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: String(element.className || ""),
        text: (element.textContent || "").trim().slice(0, 80)
      }));
    return { overflowAmount, offenders };
  });

  expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({ overflowAmount: expect.any(Number) });
  expect(overflow.overflowAmount, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(2);
}

async function expectKeyboardReachableControl(page: Page) {
  const focusedSeed = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    );
    const firstVisible = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    firstVisible?.focus();
    return Boolean(firstVisible);
  });
  expect(focusedSeed).toBe(true);
  await page.keyboard.press("Tab");
  const focusedSummary = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body || element === document.documentElement) {
      return { visible: false, name: "" };
    }
    const rect = element.getBoundingClientRect();
    const name = (
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent ||
      element.getAttribute("placeholder") ||
      element.tagName
    ).trim();
    return {
      visible: rect.width > 0 && rect.height > 0,
      name
    };
  });
  expect(focusedSummary.visible, JSON.stringify(focusedSummary)).toBe(true);
  expect(focusedSummary.name.length, JSON.stringify(focusedSummary)).toBeGreaterThan(0);
}

async function saveEvidence(page: Page, testInfo: { outputPath: (name: string) => string }, name: string) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await page.screenshot({ path: testInfo.outputPath(`${safeName}.png`), fullPage: false });
}

function sanitizeLog(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/gi, "accessToken=[redacted]")
    .replace(/token=([A-Za-z0-9._-]+)/gi, "token=[redacted]");
}

function isRelevantConsoleMessage(message: string) {
  return !/Download the React DevTools|React Router Future Flag|Failed to load resource: the server responded with a status of 404/.test(message);
}

async function installApiMocks(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "") || "/";
    const method = route.request().method();
    const body = await mockResponse(path, method, route);
    await fulfillJson(route, body.payload, body.status);
  });
}

async function mockResponse(path: string, method: string, route: Route): Promise<{ status: number; payload: unknown }> {
  if (path === "/auth/refresh") return ok({ accessToken: "smoke-access-token" });
  if (path === "/auth/me") return ok(smokeUser);
  if (path === "/billing/status") return ok(billingStatus);
  if (path === "/billing/plans") return ok({ items: billingPlans });
  if (path === "/workspaces") return ok([workspaceSummary]);
  if (path === `/workspaces/${workspaceSlug}`) return ok(workspaceProfile);
  if (path === "/workspaces/templates-catalog") return ok(workspaceTemplates);
  if (path.includes("/snapshot")) return ok(workspaceSnapshot);
  if (path.includes("/preferences")) return ok(workspaceSnapshot.preferences);
  if (path.includes("/work-item-list-configs")) return ok(workspaceSnapshot.preferences);
  if (path.includes("/work-items")) return ok(workItemsPage);
  if (path.includes(`/workspaces/${workspaceSlug}/customers`)) return ok(customers);
  if (path.includes("/board-columns")) return ok(workspaceSnapshot.boardColumns);
  if (path.includes("/workflow-states")) return ok(workspaceSnapshot.workflowStates);
  if (path.includes("/item-types")) return ok(workspaceSnapshot.itemTypes);
  if (path.includes("/custom-fields")) return ok(workspaceSnapshot.customFieldDefinitions);
  if (path.includes("/access-control")) return ok(accessControl);
  if (path.includes("/invites")) return ok([]);
  if (path.includes("/audit/")) return ok(auditEvents);
  if (path.includes("/documents/public/")) return publicDocumentResponse(path);
  if (path.includes("/documents")) return ok(documentsPage);
  if (path.includes("/document-folders")) return ok([]);
  if (path.includes("/portal/onboard")) return portalOnboardResponse(route);
  if (path.includes("/billing/connect/")) return billingConnectResponse(path, method);
  if (path.includes("/fiscal/workspaces/")) return fiscalResponse(path);
  if (path.includes("/marketing/workspaces/")) return marketingResponse(path, method);
  if (path.includes("/automation/workspaces/") || path.includes("/automation-")) return automationResponse(path, method);
  return ok({ items: [], nextCursor: null });
}

function publicDocumentResponse(path: string) {
  if (path.includes("invalid") || path.includes("expired")) {
    return { status: 404, payload: { message: "Link invalido" } };
  }
  return ok(publicDocument);
}

async function portalOnboardResponse(route: Route) {
  const postData = route.request().postDataJSON() as { billingToken?: string; docToken?: string } | null;
  if (postData?.billingToken?.includes("expired") || postData?.docToken?.includes("expired")) {
    return { status: 404, payload: { message: "Link invalido" } };
  }
  return ok({ workspaceSlug, workspaceName: "Smoke Workspace", orderId: "order-smoke" });
}

function billingConnectResponse(path: string, method: string) {
  if (path.includes("/account")) return ok(connectAccount);
  if (path.includes("/catalog-items") && method === "GET") return ok({ items: catalogItems, nextCursor: null });
  if (path.includes("/payment-orders") && method === "GET") return ok({ items: paymentOrders, nextCursor: null });
  if (path.includes("/checkout-session")) return ok({ url: "https://example.invalid/checkout", sessionId: "session-smoke", orderId: "order-smoke" });
  if (path.includes("/portal-token")) return ok({ url: "https://example.invalid/portal", expiresAt: now, scopes: ["view", "pay"] });
  return ok({ ok: true, ...connectAccount });
}

function fiscalResponse(path: string) {
  if (path.includes("/dashboard")) return ok(fiscalDashboard);
  if (path.includes("/companies")) return ok({ items: fiscalCompanies, nextCursor: null });
  if (path.includes("/received")) return ok({ items: receivedDocuments, nextCursor: null });
  if (path.includes("/drafts")) return ok({ items: fiscalDrafts, nextCursor: null });
  if (path.includes("/sync-runs")) return ok({ items: fiscalSyncRuns, nextCursor: null });
  if (path.includes("/catalog/profiles")) return ok({ items: [] });
  if (path.includes("/operation-templates")) return ok({ items: [] });
  return ok({ items: fiscalDocuments, nextCursor: null });
}

function marketingResponse(path: string, method: string) {
  if (path.includes("/dashboard")) return ok(marketingDashboard);
  if (path.includes("/campaigns/campaign-1") && method === "GET") return ok(campaignDetails);
  if (path.includes("/campaigns") && method === "GET") return ok({ items: campaigns });
  if (path.includes("/audience/contacts")) return ok({ items: audienceContacts });
  if (path.includes("/audience/segments")) return ok({ items: segments });
  if (path.includes("/templates")) return ok({ items: templates });
  if (path.includes("/automations/flows")) return ok({ items: marketingFlows });
  if (path.includes("/signals/inbox")) return ok({ items: marketingSignals, unreadCount: 1 });
  return ok({ providerKey: "mock", providerMessageId: "message-smoke", items: [] });
}

function automationResponse(path: string, method: string) {
  if (path.includes("/capabilities")) return ok(automationCapabilities);
  if (path.includes("/automation-workflows/workflow-smoke/versions") && method === "GET") return ok({ items: [automationVersion] });
  if (path.includes("/automation-workflows") && method === "GET") return ok({ items: [automationWorkflow] });
  if (path.includes("/runs")) return ok({ items: automationRuns });
  if (path.includes("/communication/inbox")) return ok({ items: conversations });
  if (path.includes("/communication/templates")) return ok({ items: communicationTemplates });
  if (path.includes("/communication/whatsapp/consents")) return ok({ items: consents });
  if (path.includes("/automation-approvals")) return ok({ items: approvals });
  if (path.includes("/views")) return ok({ items: [] });
  return ok({ items: [], ...automationWorkflow });
}

function ok(payload: unknown) {
  return { status: 200, payload };
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

const smokeUser = {
  id: "user-smoke",
  email: "smoke@example.invalid",
  name: "Smoke User",
  avatarUrl: null,
  isPlatformAdmin: true,
  createdAt: now,
  updatedAt: now
};

const workspaceSummary = {
  id: workspaceSlug,
  organizationId: null,
  kind: "CORPORATE",
  name: "Smoke Workspace",
  key: "Smoke",
  slug: workspaceSlug,
  role: "OWNER"
};

const workspaceProfile = {
  ...workspaceSummary,
  info: {
    description: "Workspace para smoke visual",
    company: "Smoke LTDA",
    website: "https://example.invalid"
  },
  createdAt: now,
  updatedAt: now
};

const workflowStates = [
  { id: "todo", workspaceId: workspaceSlug, name: "A fazer", slug: "todo", color: "#64748b", order: 1, category: "todo", isTerminal: false, isEditable: true, isActive: true },
  { id: "doing", workspaceId: workspaceSlug, name: "Em andamento", slug: "doing", color: "#2563eb", order: 2, category: "doing", isTerminal: false, isEditable: true, isActive: true },
  { id: "done", workspaceId: workspaceSlug, name: "Concluido", slug: "done", color: "#16a34a", order: 3, category: "done", isTerminal: true, isEditable: true, isActive: true }
];

const itemTypes = [
  { id: "task", name: "Tarefa", slug: "task", color: "#2563eb", icon: null, description: "Item operacional", isActive: true },
  { id: "commercial", name: "Comercial", slug: "commercial", color: "#9333ea", icon: null, description: "Oportunidade comercial", isActive: true }
];

const customFields = [
  { id: "company", definitionId: "company", name: "Empresa", slug: "company", type: "text", required: false, isSystem: false, isEditable: true, isRemovable: true, isActive: true, order: 1, options: [] },
  { id: "value", definitionId: "value", name: "Valor", slug: "value", type: "number", required: false, isSystem: false, isEditable: true, isRemovable: true, isActive: true, order: 2, options: [] }
];

const tasks = [
  {
    id: "task-1",
    title: "Revisar proposta smoke",
    text: "Validar fluxo publico e cobranca",
    type: "task",
    status: "todo",
    position: 1,
    priority: 3,
    tags: ["smoke"],
    assignee: "user-smoke",
    checklist: { items: [{ id: "check-1", label: "Conferir modal", done: false }] },
    due: "2026-05-13",
    plannedStartAt: "2026-05-13T13:00:00.000Z",
    plannedEndAt: "2026-05-13T14:00:00.000Z",
    customFields: { company: "Cliente Smoke", value: 12500 },
    customFieldValuesById: { company: "Cliente Smoke", value: 12500 }
  },
  {
    id: "task-2",
    title: "Emitir documento fiscal",
    text: "Conferir fiscal antes da emissao",
    type: "commercial",
    status: "doing",
    position: 2,
    priority: 2,
    tags: ["fiscal"],
    assignee: "user-smoke",
    checklist: { items: [] },
    due: "2026-05-14",
    plannedStartAt: "2026-05-14T15:00:00.000Z",
    plannedEndAt: "2026-05-14T16:00:00.000Z",
    customFields: { company: "Acme Smoke", value: 9400 },
    customFieldValuesById: { company: "Acme Smoke", value: 9400 }
  }
];

const workspaceSnapshot = {
  id: workspaceSlug,
  name: "Smoke Workspace",
  key: "Smoke",
  currentUserId: "user-smoke",
  membersById: {
    "user-smoke": { id: "user-smoke", name: "Smoke User", email: "smoke@example.invalid", avatarUrl: null }
  },
  tasks,
  tags: [{ id: "tag-smoke", name: "Smoke", slug: "smoke", color: "#2563eb", isActive: true }],
  boardConfig: {
    statuses: workflowStates.map((state) => ({ id: state.id, label: state.name, dot: state.color, category: state.category, isTerminal: state.isTerminal })),
    taskTypes: itemTypes.map((type) => ({ id: type.slug, label: type.name, background: type.color, border: type.color, text: "#ffffff" })),
    fieldDefinitions: customFields.map((field) => ({ id: field.id, definitionId: field.definitionId, label: field.name, name: field.name, slug: field.slug, type: field.type, options: field.options, required: field.required, isActive: field.isActive })),
    fieldBindings: [],
    cardLayout: { visibleFieldIds: ["company", "value"], visibleFieldIdsByType: {}, detailVisibleFieldIdsByType: {} },
    perspectives: [
      { id: "default", label: "Operacao", statuses: workflowStates.map((state) => ({ id: state.id, label: state.name, dot: state.color })), statusSource: { kind: "workflow_state" } }
    ]
  },
  itemTypes,
  workflowStates,
  boardColumns: [
    { id: "col-todo", name: "A fazer", slug: "todo", order: 1, wipLimit: null, isActive: true, stateIds: ["todo"] },
    { id: "col-doing", name: "Em andamento", slug: "doing", order: 2, wipLimit: null, isActive: true, stateIds: ["doing"] },
    { id: "col-done", name: "Concluido", slug: "done", order: 3, wipLimit: null, isActive: true, stateIds: ["done"] }
  ],
  customFieldDefinitions: customFields,
  automations: [{ id: "auto-1", title: "Follow-up automatico", status: "active", trigger: "WorkItem comercial atualizado", action: "Enviar email" }],
  preferences: {
    defaultBoardMode: "default",
    dateFormat: "dd/mm/yyyy",
    visibleCardFieldIds: ["company", "value"],
    settings: {
      companyProfile: { name: "Smoke LTDA", legalName: "Smoke LTDA", document: "00.000.000/0001-00" }
    }
  },
  access: {
    role: "OWNER",
    isClient: false,
    customerIds: [],
    ownCardsOnly: false,
    allowedModules: ["dashboard", "board", "automation", "documentation", "billing", "ai", "settings", "fiscal", "commercial", "marketing"],
    moduleEntitlements: { dashboard: true, board: true, automation: true, documentation: true, billing: true, ai: true, settings: true, fiscal: true, commercial: true, marketing: true },
    allowedBoardViewKeys: null
  }
};

const workItemsPage = {
  items: tasks,
  total: tasks.length,
  totalCount: tasks.length,
  nextCursor: null,
  hasMore: false,
  columnCounts: { "col-todo": 1, "col-doing": 1 },
  workflowStateCounts: { todo: 1, doing: 1 },
  countsByState: { todo: 1, doing: 1 },
  countsByType: { task: 1, commercial: 1 }
};

const workspaceTemplates = [
  { key: "operations_kanban", name: "Operacoes", description: "Quadro operacional para smoke visual" },
  { key: "commercial_crm", name: "CRM Comercial", description: "Pipeline comercial para smoke visual" }
];

const customers = [
  { id: "customer-1", workspaceId: workspaceSlug, name: "Cliente Smoke", email: "cliente@example.invalid", status: "active", createdAt: now, updatedAt: now }
];

const accessControl = {
  catalog: ["workspace.read", "workspace.manage", "billing.read", "billing.manage", "fiscal.read", "marketing.view", "automation.workflows.read"],
  moduleCatalog: ["dashboard", "board", "automation", "documentation", "billing", "ai", "settings", "fiscal", "commercial", "marketing"],
  moduleEntitlements: workspaceSnapshot.access.moduleEntitlements,
  groups: [],
  rolePresets: { OWNER: [], ADMIN: [], MEMBER: [], VIEWER: [], CLIENT: [], MANAGER: [], GUEST: [] },
  members: []
};

const auditEvents = [
  { id: "audit-1", eventName: "workspace.updated", severity: "INFO", actorId: "user-smoke", workspaceId: workspaceSlug, metadata: { smoke: true }, happenedAt: now }
];

const billingStatus = { hasActiveSubscription: true, plan: "BUSINESS", status: "ACTIVE", currentPeriodEnd: now, cancelAtPeriodEnd: false, canAccessPlatform: true, canCreateWorkspace: true, message: null };
const billingPlans = [
  { code: "BASIC", name: "Basic", description: "Plano smoke Basic", amount: 14990, currency: "BRL", interval: "month", intervalCount: 1, features: ["Workspace business"], isActive: true },
  { code: "PRO", name: "Pro", description: "Plano smoke Pro", amount: 29990, currency: "BRL", interval: "month", intervalCount: 1, features: ["Automacoes", "IA contextual"], isActive: true },
  { code: "BUSINESS", name: "Business", description: "Plano smoke Business", amount: 49990, currency: "BRL", interval: "month", intervalCount: 1, features: ["Workspace", "Billing"], isActive: true },
  { code: "ENTERPRISE", name: "Enterprise", description: "Plano sob consulta", amount: 0, currency: "BRL", interval: null, intervalCount: null, features: ["Contrato empresarial"], isActive: true }
];
const connectAccount = { workspaceId: workspaceSlug, stripeAccountId: "acct_smoke", controllerType: "express", dashboardType: "express", requirementCollection: null, disabledReason: null, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true, cardPaymentsStatus: "active", pixPaymentsStatus: "active", boletoPaymentsStatus: "inactive", capabilities: {}, onboardingComplete: true, requirementsDue: [], requirementsPastDue: [], requirementsEventuallyDue: [], requirementsPendingVerification: [] };
const catalogItems = [{ id: "catalog-1", kind: "SERVICE", billingType: "ONE_TIME", recurringInterval: null, recurringIntervalCount: null, name: "Diagnostico Smoke", description: "Servico de teste", amount: 12500, currency: "BRL", stripeConnectAccountId: "acct_smoke", stripeProductId: "prod_smoke", stripePriceId: "price_smoke", isActive: true, metadata: null, createdAt: now, updatedAt: now }];
const paymentOrders = [{ id: "order-smoke", status: "CHECKOUT_OPEN", customerStatus: "pending", amount: 12500, currency: "BRL", description: "Diagnostico Smoke", customerId: "customer-1", customerName: "Cliente Smoke", customerEmail: "cliente@example.invalid", customerDocument: null, customerPhone: null, stripeCheckoutSessionId: "session-smoke", stripePaymentIntentId: null, checkoutUrl: "https://example.invalid/checkout", customerPortalUrl: null, createdAt: now, updatedAt: now, paidAt: null, failedAt: null, canceledAt: null, refundedAt: null }];

const fiscalDashboard = { counters: { issuedToday: 1, pending: 2, rejected: 0, received: 3, pendingReview: 1 }, latestSyncAt: now, recentSyncRuns: [{ id: "sync-1", syncType: "NFE_MDE", status: "SUCCESS", startedAt: now, finishedAt: now }] };
const fiscalCompanies = [{ id: "company-1", workspaceId: workspaceSlug, workspaceBusinessId: null, provider: "focus", displayName: "Smoke LTDA", legalName: "Smoke LTDA", cnpj: "00000000000100", stateRegistration: null, municipalRegistration: null, taxRegime: "simples", focusToken: "redacted", focusEnvironment: "sandbox", focusCompanyReference: null, focusWebhookSecret: null, emitAutomatically: false, stripePolicy: "manual_review", defaultSerie: null, defaultNatureOperation: null, fallbackRules: null, syncConfig: null, metadata: null, createdByUserId: "user-smoke", createdAt: now, updatedAt: now }];
const fiscalDocuments = [{ id: "fiscal-1", workspaceId: workspaceSlug, workspaceBusinessId: null, companyConfigId: "company-1", internalReference: "SMOKE-1", provider: "focus", direction: "OUTBOUND", documentType: "NFSE", origin: "MANUAL_SERVICE", sourceSystem: "INTERNAL", status: "READY_TO_ISSUE", issueStatus: "NOT_STARTED", focusStatus: null, operationStatus: null, customerId: "customer-1", supplierId: null, saleId: null, stripeSessionId: null, stripePaymentIntentId: null, stripeChargeId: null, stripeAccountId: null, focusReference: null, focusDocumentId: null, number: null, series: null, amountSubtotal: "125.00", amountDiscount: null, amountTotal: "125.00", currency: "BRL", issuedAt: null, authorizedAt: null, cancelledAt: null, xmlUrl: null, pdfUrl: null, xmlStorageRef: null, pdfStorageRef: null, requestPayloadSnapshot: null, responsePayloadSnapshot: null, providerPayloadRaw: null, metadata: null, lastSyncAt: null, lastError: null, createdByUserId: "user-smoke", updatedByUserId: null, createdAt: now, updatedAt: now }];
const receivedDocuments = [{ id: "received-1", workspaceId: workspaceSlug, workspaceBusinessId: null, companyConfigId: "company-1", type: "NFE_MDE", status: "RECEIVED", manifestationStatus: null, externalKey: "NFE-SMOKE", providerReference: null, focusReference: null, issuerName: "Fornecedor Smoke", issuerDocument: "00000000000100", recipientDocument: "00000000000100", amountTotal: "80.00", issuedAt: now, receivedAt: now, xmlUrl: null, pdfUrl: null, payload: null, supplierId: null, costCenterId: null, categoryId: null, financialEntryId: null, purchaseId: null, mappedDocumentId: null, lastSyncAt: now, lastError: null, metadata: null, createdAt: now, updatedAt: now }];
const fiscalDrafts = [{ id: "draft-1", workspaceId: workspaceSlug, workspaceBusinessId: null, companyConfigId: "company-1", status: "READY", documentType: "NFSE", origin: "MANUAL_SERVICE", saleId: null, stripeSessionId: null, stripePaymentIntentId: null, emitAfterPayment: false, autoIssueEligible: true, payload: null, suggestion: null, createdByUserId: "user-smoke", issuedDocumentId: null, createdAt: now, updatedAt: now }];
const fiscalSyncRuns = [{ id: "sync-1", workspaceId: workspaceSlug, companyConfigId: "company-1", syncType: "NFE_MDE", trigger: "MANUAL", status: "SUCCESS", processedCount: 3, createdCount: 1, updatedCount: 2, failedCount: 0, lastError: null, startedAt: now, finishedAt: now, createdAt: now, updatedAt: now }];

const marketingDashboard = { activeCampaigns: 1, scheduledCampaigns: 1, openRate: 0.42, clickRate: 0.18, conversionRate: 0.1, influencedWorkItems: 4, influencedCustomers: 2, influencedRevenue: 12500, automationsRunning: 1, sendsQueuedToday: 8 };
const campaigns = [{ id: "campaign-1", workspaceId: workspaceSlug, name: "Nutricao Smoke", objective: "COMMERCIAL_NURTURE", status: "ACTIVE", channel: "EMAIL", scheduledAt: null, launchedAt: now, createdAt: now, updatedAt: now, segmentId: "segment-1", templateId: "template-1", senderProfileId: null }];
const campaignDetails = {
  campaign: campaigns[0],
  variants: [{ id: "variant-1", campaignId: "campaign-1", name: "Controle", subject: "Smoke", preheader: null, bodyMarkdown: "Mensagem smoke", bodyHtml: null, isControl: true, weight: 100 }],
  segment: null,
  template: null,
  senderProfile: null,
  recentEvents: [],
  sends: []
};
const audienceContacts = [{ contact: { id: "contact-1", workItemId: "task-1", fullName: "Cliente Smoke", email: "cliente@example.invalid", companyName: "Cliente Smoke", status: "commercial_intake", score: 72, captureSource: "site", updatedAt: now }, preference: { consentStatus: "OPT_IN", allowEmail: true, allowNewsletter: true, allowBilling: true }, lastEventAt: now }];
const segments = [{ id: "segment-1", name: "Oportunidades quentes", description: "Segmento smoke", kind: "DYNAMIC", isActive: true, estimatedContacts: 12, filters: { logic: "AND", rules: [{ field: "score", operator: "gte", value: 70 }] } }];
const templates = [{ id: "template-1", name: "Follow-up", slug: "follow-up", category: "nurture", objective: "COMMERCIAL_NURTURE", funnelStage: "consideration", subject: "Vamos avancar?", bodyMarkdown: "Mensagem smoke", bodyHtml: null, isArchived: false }];
const marketingFlows = [{ id: "flow-1", name: "Jornada Smoke", description: "Fluxo de teste", status: "DRAFT", triggerDefinition: { nodes: [], edges: [] }, steps: [], enrollments: [], updatedAt: now }];
const marketingSignals = [{ id: "signal-1", type: "EMAIL_CLICKED", headline: "Cliente abriu email", description: "Sinal de engajamento", payload: null, occurredAt: now, seenAt: null, dismissedAt: null, workItemId: "task-1", campaignId: "campaign-1", workItem: { id: "task-1", title: "Revisar proposta smoke", contactName: "Cliente Smoke", email: "cliente@example.invalid", companyName: "Cliente Smoke", customerId: "customer-1", score: 72, status: "commercial_intake" }, campaign: { id: "campaign-1", name: "Nutricao Smoke", objective: "COMMERCIAL_NURTURE" } }];

const automationCapabilities = {
  nodeCatalog: [
    { type: "trigger.manual", label: "Gatilho manual", description: "Inicia manualmente", category: "trigger", icon: "play", defaultConfig: {} },
    { type: "action.email", label: "Enviar email", description: "Envia uma mensagem", category: "action", icon: "mail", defaultConfig: { subject: "Smoke" } }
  ],
  defaultGraph: {
    version: 1,
    nodes: [{ id: "node-1", type: "trigger.manual", label: "Gatilho manual", config: {}, position: { x: 120, y: 120 } }],
    edges: [],
    metadata: { smoke: true }
  },
  recipes: [{ id: "recipe-1", label: "Follow-up simples", description: "Cria uma jornada basica", nodes: [], edges: [] }],
  fieldOptions: {
    boardColumns: workspaceSnapshot.boardColumns,
    workflowStates,
    customFields,
    itemTypes
  }
};
const automationVersion = { id: "version-1", workflowId: "workflow-smoke", workspaceId: workspaceSlug, version: 1, status: "draft", definitionJson: {}, graphNodesJson: [{ id: "node-1", type: "trigger.manual", label: "Gatilho manual", config: {}, position: { x: 120, y: 120 } }], graphEdgesJson: [], publishedAt: null, publishedById: null, createdAt: now };
const automationWorkflow = { id: "workflow-smoke", workspaceId: workspaceSlug, name: "Workflow Smoke", description: "Fluxo versionado", status: "draft", currentVersionId: "version-1", createdById: "user-smoke", createdAt: now, updatedAt: now, currentVersion: automationVersion };
const automationRuns = [{ runId: "run-1", workspaceId: workspaceSlug, workflowId: "workflow-smoke", workflowName: "Workflow Smoke", workflowStatus: "draft", workflowVersionId: "version-1", workflowVersion: 1, workflowVersionStatus: "draft", status: "SUCCESS", triggerType: "manual", triggerRefId: null, startedAt: now, finishedAt: now, cancelledAt: null, createdAt: now, updatedAt: now, durationMs: 120, stepsCount: 1, failedStepsCount: 0, sideEffectsCount: 0, eventsCount: 1, lastEvent: null, error: null }];
const conversations = [{ conversationId: "conversation-1", contactName: "Cliente Smoke", contactMasked: "cliente@example.invalid", channel: "email", status: "open", priority: "normal", assignedTo: null, workItemTitle: "Revisar proposta smoke", workItemId: "task-1", lastMessagePreview: "Retorno recebido", lastMessageAt: now, unreadCount: 1, hasPendingApproval: false, hasFailedMessage: false }];
const communicationTemplates = [{ id: "template-auto-1", workspaceId: workspaceSlug, name: "WhatsApp Smoke", key: "smoke", channel: "whatsapp", category: "marketing", status: "active", description: null, providerTemplateName: null, providerTemplateId: null, language: "pt_BR", approvalStatus: "approved", createdById: "user-smoke", createdAt: now, updatedAt: now, archivedAt: null, versions: [] }];
const consents = [{ id: "consent-1", workspaceId: workspaceSlug, contactType: "customer", contactId: "customer-1", channel: "whatsapp", address: "+5500000000000", status: "opt_in", source: "manual", reason: null, optInAt: now, optOutAt: null, createdAt: now, updatedAt: now }];
const approvals = [{ approvalId: "approval-1", type: "send_message", status: "pending", title: "Enviar follow-up", channel: "email", contactMasked: "cliente@example.invalid", contactName: "Cliente Smoke", workflowId: "workflow-smoke", workflowName: "Workflow Smoke", runId: "run-1", stepRunId: "step-1", createdAt: now, requestedAt: now, expiresAt: null, lastEvent: null }];

const documentsPage = { items: [{ id: "doc-1", workspaceId: workspaceSlug, title: "Proposta Smoke", content: "# Proposta Smoke\n\nConteudo de teste.", kind: "proposal", tags: ["smoke"], metadata: { status: "sent", publicToken: "valid-token" }, position: 1, createdBy: "user-smoke", updatedBy: null, createdAt: now, updatedAt: now }], total: 1, totalCount: 1, nextCursor: null, hasMore: false, pageInfo: { page: 1, pageSize: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false, nextCursor: null } };
const publicDocument = { title: "Proposta Smoke", content: "# Proposta Smoke\n\nConteudo publico.", kind: "proposal", status: "sent", workspaceName: "Smoke Workspace", customerName: "Cliente Smoke", metadata: { proposalCode: "SMOKE-1" } };
