import { describe, expect, it } from "vitest";
import {
  SmokeHttpClient,
  assertArrayResponse,
  assertPageResponse,
  assertRecord,
  classifySmokeError,
  formatSmokeConfigHelp,
  formatReleaseSmokeConfigError,
  getMissingRequiredSmokeConfig,
  makeAiAgentPayload,
  makeBillingCatalogPayload,
  makeFiscalCompanyPayload,
  makeFiscalDraftPayload,
  makeSmokeId,
  readSmokeConfig,
  toWorkspaceSlug,
  type SmokeConfig,
  type SmokeFlow,
  type SmokeStepResult,
  type SmokeWorkspace
} from "./authenticated-smoke.helpers";

const processEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const config = readSmokeConfig(processEnv);
const missingConfig = getMissingRequiredSmokeConfig(config);

function pass(flow: SmokeFlow, name: string, message?: string): SmokeStepResult {
  return { flow, name, outcome: "passed", message };
}

function skip(flow: SmokeFlow, name: string, message: string): SmokeStepResult {
  return { flow, name, outcome: "skipped", message };
}

function optionalNotRun(flow: SmokeFlow, name: string, message: string): SmokeStepResult {
  return config.releaseSmoke
    ? pass(flow, name, `Not run by non-destructive release smoke policy: ${message}`)
    : skip(flow, name, message);
}

function logResults(results: SmokeStepResult[]): void {
  console.info("\n[smoke] authenticated smoke results");
  for (const result of results) {
    const status = result.status ? ` HTTP ${result.status}` : "";
    const message = result.message ? ` - ${result.message}` : "";
    console.info(`[${result.outcome}] ${result.flow} :: ${result.name}${status}${message}`);
  }
}

function assertNoFailures(results: SmokeStepResult[]): void {
  const failures = results.filter((result) => result.outcome === "failed");
  expect(failures).toEqual([]);
}

function assertReleaseGate(results: SmokeStepResult[]): void {
  const nonPassed = results.filter((result) => result.outcome !== "passed");
  if (nonPassed.length > 0) {
    const summary = nonPassed
      .map((result) => {
        const status = result.status ? ` HTTP ${result.status}` : "";
        const message = result.message ? ` - ${result.message}` : "";
        return `[${result.outcome}] ${result.flow} :: ${result.name}${status}${message}`;
      })
      .join("\n");
    throw new Error(`[smoke] Release smoke requires every step to pass. Non-passed steps:\n${summary}`);
  }
}

async function runStep(
  results: SmokeStepResult[],
  flow: SmokeFlow,
  name: string,
  action: () => Promise<string | void>,
  options: { external?: boolean } = {}
): Promise<void> {
  try {
    const message = await action();
    results.push(pass(flow, name, typeof message === "string" ? message : undefined));
  } catch (error) {
    const classified = classifySmokeError(flow, error, options);
    results.push({ ...classified, name });
  }
}

async function authenticate(client: SmokeHttpClient, smokeConfig: SmokeConfig, results: SmokeStepResult[]): Promise<void> {
  await runStep(results, "auth", "login", async () => {
    const response = await client.request("/auth/login", {
      method: "POST",
      auth: false,
      body: {
        email: smokeConfig.email,
        password: smokeConfig.password
      }
    });
    assertRecord(response.payload, "login");
    const accessToken = response.payload.accessToken;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("login response must include accessToken.");
    }
    client.setAccessToken(accessToken);
  });

  await runStep(results, "auth", "me", async () => {
    const response = await client.request("/auth/me");
    assertRecord(response.payload, "me");
  });
}

async function resolveWorkspace(
  client: SmokeHttpClient,
  smokeConfig: SmokeConfig,
  results: SmokeStepResult[]
): Promise<SmokeWorkspace | null> {
  let resolved: SmokeWorkspace | null = null;
  await runStep(results, "workspace", "list workspaces and resolve smoke workspace", async () => {
    const response = await client.request("/workspaces");
    assertArrayResponse(response.payload, "workspaces");
    const workspaces = response.payload
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item) => ({
        id: String(item.id ?? ""),
        name: typeof item.name === "string" ? item.name : undefined,
        key: typeof item.key === "string" ? item.key : undefined,
        role: typeof item.role === "string" ? item.role : undefined,
        slug: toWorkspaceSlug({
          id: String(item.id ?? ""),
          key: typeof item.key === "string" ? item.key : "",
          name: typeof item.name === "string" ? item.name : ""
        })
      }))
      .filter((workspace) => workspace.id.length > 0);

    resolved =
      workspaces.find((workspace) => smokeConfig.workspaceId && workspace.id === smokeConfig.workspaceId) ??
      workspaces.find((workspace) => smokeConfig.workspaceSlug && workspace.slug === smokeConfig.workspaceSlug) ??
      null;

    if (!resolved) {
      throw new Error("Smoke workspace was not found in /workspaces response.");
    }

    return `${resolved.name ?? resolved.id} (${resolved.id})`;
  });

  return resolved;
}

async function smokeCriticalProductSurfaces(client: SmokeHttpClient, workspace: SmokeWorkspace, results: SmokeStepResult[]): Promise<void> {
  const now = new Date();
  const startAt = new Date(now);
  startAt.setDate(now.getDate() - 7);
  const endAt = new Date(now);
  endAt.setDate(now.getDate() + 30);

  await runStep(results, "workspace", "load workspace profile", async () => {
    const response = await client.request(`/workspaces/${workspace.id}`);
    assertRecord(response.payload, "workspace profile");
  });

  await runStep(results, "dashboard", "load overview", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/dashboard/overview`);
    assertRecord(response.payload, "dashboard overview");
  });

  await runStep(results, "dashboard", "load widgets", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/dashboard/widgets`);
    assertRecord(response.payload, "dashboard widgets");
  });

  await runStep(results, "board", "load workspace snapshot", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/snapshot?limit=25`);
    assertRecord(response.payload, "workspace snapshot");
    if (!Array.isArray(response.payload.tasks)) {
      throw new Error("workspace snapshot must include tasks array.");
    }
  });

  await runStep(results, "list", "load paged work items", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/work-items?paged=true&pageSize=10&sort=updated_desc`);
    assertPageResponse(response.payload, "work items list");
  });

  await runStep(results, "agenda", "load planned work item window", async () => {
    const query = new URLSearchParams({
      paged: "true",
      pageSize: "10",
      plannedWindowFrom: startAt.toISOString(),
      plannedWindowTo: endAt.toISOString(),
      sortBy: "plannedStartAt",
      sortDirection: "asc"
    });
    const response = await client.request(`/workspaces/${workspace.id}/work-items?${query.toString()}`);
    assertPageResponse(response.payload, "agenda work items");
  });

  await runStep(results, "marketing", "load dashboard", async () => {
    const response = await client.request(`/marketing/workspaces/${workspace.id}/dashboard`);
    assertRecord(response.payload, "marketing dashboard");
  });

  await runStep(results, "marketing", "load campaigns", async () => {
    const response = await client.request(`/marketing/workspaces/${workspace.id}/campaigns?limit=10`);
    assertPageResponse(response.payload, "marketing campaigns");
  });

  await runStep(results, "marketing", "load journey flows", async () => {
    const response = await client.request(`/marketing/workspaces/${workspace.id}/automations/flows`);
    assertPageResponse(response.payload, "marketing automation flows");
  });

  await runStep(results, "automation", "load capabilities", async () => {
    const response = await client.request(`/automation/workspaces/${workspace.id}/capabilities`);
    assertRecord(response.payload, "automation capabilities");
  });

  await runStep(results, "automation", "load workflows", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/automation-workflows?limit=10`);
    assertPageResponse(response.payload, "automation workflows");
  });

  await runStep(results, "automation", "load runs", async () => {
    const response = await client.request(`/automation/workspaces/${workspace.id}/runs?limit=10`);
    assertArrayResponse(response.payload, "automation runs");
  });

  await runStep(results, "documentation", "load documents", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/documents?paged=true&pageSize=10&sort=updated_desc`);
    assertPageResponse(response.payload, "workspace documents");
  });

  await runStep(results, "documentation", "load folders", async () => {
    const response = await client.request(`/workspaces/${workspace.id}/document-folders`);
    assertArrayResponse(response.payload, "workspace document folders");
  });
}

async function smokeBilling(client: SmokeHttpClient, workspace: SmokeWorkspace, results: SmokeStepResult[]): Promise<void> {
  const smokeId = makeSmokeId();
  let catalogItemId: string | null = null;
  let checkoutSessionId: string | null = null;
  let orderId: string | null = null;

  await runStep(results, "billing", "load platform subscription", async () => {
    const response = await client.request("/billing/status");
    assertRecord(response.payload, "billing status");
  });

  await runStep(results, "billing", "load plan catalog", async () => {
    const response = await client.request("/billing/plans", { auth: false });
    assertPageResponse(response.payload, "billing plans");
  });

  await runStep(results, "billing", "load Connect account", async () => {
    const response = await client.request(`/billing/connect/workspaces/${workspace.id}/account`);
    assertRecord(response.payload, "connect account");
  });

  await runStep(results, "billing", "load catalog page", async () => {
    const response = await client.request(`/billing/connect/workspaces/${workspace.id}/catalog-items?pageSize=2&includeInactive=true`);
    assertPageResponse(response.payload, "billing catalog");
    const nextCursor = response.payload.nextCursor;
    if (nextCursor) {
      const next = await client.request(`/billing/connect/workspaces/${workspace.id}/catalog-items?pageSize=2&includeInactive=true&cursor=${encodeURIComponent(nextCursor)}`);
      assertPageResponse(next.payload, "billing catalog next page");
    }
  });

  await runStep(results, "billing", "create catalog item", async () => {
    const response = await client.request(`/billing/connect/workspaces/${workspace.id}/catalog-items`, {
      method: "POST",
      body: makeBillingCatalogPayload(smokeId)
    });
    assertRecord(response.payload, "created catalog item");
    catalogItemId = typeof response.payload.id === "string" ? response.payload.id : null;
    if (!catalogItemId) {
      throw new Error("created catalog item response must include id.");
    }
  });

  if (catalogItemId) {
    await runStep(results, "billing", "update catalog item", async () => {
      const response = await client.request(`/billing/connect/workspaces/${workspace.id}/catalog-items/${catalogItemId}`, {
        method: "PATCH",
        body: {
          ...makeBillingCatalogPayload(smokeId),
          name: `SMOKE_Catalog_${smokeId}_updated`
        }
      });
      assertRecord(response.payload, "updated catalog item");
    });

    await runStep(results, "billing", "create Connect checkout", async () => {
      const response = await client.request(`/billing/connect/workspaces/${workspace.id}/checkout-session`, {
        method: "POST",
        body: {
          catalogItemId,
          customerEmail: "smoke@example.invalid",
          customerName: `SMOKE Customer ${smokeId}`,
          sendEmail: false,
          hasProposalOrContract: true,
          successUrl: `${config.baseUrl}/w/${workspace.slug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${config.baseUrl}/w/${workspace.slug}/billing?checkout=cancel`,
          metadata: { smoke: "true", smokeId }
        }
      });
      assertRecord(response.payload, "checkout session");
      checkoutSessionId = typeof response.payload.sessionId === "string" ? response.payload.sessionId : null;
      orderId = typeof response.payload.orderId === "string" ? response.payload.orderId : null;
    });
  } else {
    results.push(skip("billing", "update/create checkout", "Catalog item was not created; Connect environment is probably incomplete."));
  }

  await runStep(results, "billing", "load payment orders", async () => {
    const response = await client.request(`/billing/connect/workspaces/${workspace.id}/payment-orders?pageSize=2`);
    assertPageResponse(response.payload, "payment orders");
  });

  if (checkoutSessionId) {
    await runStep(results, "billing", "sync post-checkout", async () => {
      const response = await client.request(
        `/billing/connect/workspaces/${workspace.id}/payment-orders/sync?sessionId=${encodeURIComponent(checkoutSessionId!)}`,
        { method: "POST", body: {} }
      );
      assertRecord(response.payload, "post-checkout sync");
    });
  } else {
    results.push(optionalNotRun("billing", "sync post-checkout", "No checkout session was created."));
  }

  await runStep(results, "billing", "request boleto capability", async () => {
    const response = await client.request(`/billing/connect/workspaces/${workspace.id}/payment-capability`, {
      method: "POST",
      body: { paymentMethod: "boleto" }
    });
    assertRecord(response.payload, "payment capability");
  });

  if (orderId) {
    await runStep(results, "billing", "resend Connect email", async () => {
      const response = await client.request(`/billing/connect/workspaces/${workspace.id}/payment-orders/${orderId}/resend-email`, {
        method: "POST",
        body: {}
      });
      assertRecord(response.payload, "resend email");
    });

    await runStep(results, "billing", "create portal token", async () => {
      const response = await client.request(`/billing/connect/workspaces/${workspace.id}/payment-orders/${orderId}/portal-token`, {
        method: "POST",
        body: { expiresInSeconds: 600 }
      });
      assertRecord(response.payload, "portal token");
    });
  } else {
    results.push(optionalNotRun("billing", "resend email/portal token", "No payment order was created."));
  }

  if (catalogItemId) {
    await runStep(results, "billing", "archive catalog item", async () => {
      const response = await client.request(`/billing/connect/workspaces/${workspace.id}/catalog-items/${catalogItemId}`, {
        method: "DELETE"
      });
      assertRecord(response.payload, "archived catalog item");
    });
  }
}

async function smokeFiscal(client: SmokeHttpClient, smokeConfig: SmokeConfig, workspace: SmokeWorkspace, results: SmokeStepResult[]): Promise<void> {
  const smokeId = makeSmokeId();
  let companyId = smokeConfig.fiscalCompanyId ?? null;
  let draftDocumentId: string | null = null;

  await runStep(results, "fiscal", "load dashboard", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/dashboard`);
    assertRecord(response.payload, "fiscal dashboard");
  });

  await runStep(results, "fiscal", "load companies page", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/companies?pageSize=2`);
    assertPageResponse(response.payload, "fiscal companies");
    const firstCompany = response.payload.items.find((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown> | undefined;
    companyId = companyId ?? (typeof firstCompany?.id === "string" ? firstCompany.id : null);
    if (companyId) {
      return `company=${companyId}`;
    }
  });

  await runStep(results, "fiscal", "load issued documents page", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/documents?pageSize=2&direction=OUTBOUND`);
    assertPageResponse(response.payload, "issued documents");
    const nextCursor = response.payload.nextCursor;
    if (nextCursor) {
      const next = await client.request(`/fiscal/workspaces/${workspace.id}/documents?pageSize=2&direction=OUTBOUND&cursor=${encodeURIComponent(nextCursor)}`);
      assertPageResponse(next.payload, "issued documents next page");
    }
  });

  await runStep(results, "fiscal", "load received documents page", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/received?pageSize=2`);
    assertPageResponse(response.payload, "received documents");
  });

  await runStep(results, "fiscal", "load drafts page", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/drafts?pageSize=2`);
    assertPageResponse(response.payload, "fiscal drafts");
  });

  await runStep(results, "fiscal", "load sync runs page", async () => {
    const response = await client.request(`/fiscal/workspaces/${workspace.id}/sync-runs?pageSize=2`);
    assertPageResponse(response.payload, "sync runs");
  });

  if (smokeConfig.createFiscalCompany && smokeConfig.focusToken) {
    await runStep(results, "fiscal", "create fiscal company", async () => {
      const response = await client.request(`/fiscal/workspaces/${workspace.id}/companies`, {
        method: "POST",
        body: makeFiscalCompanyPayload(smokeId, smokeConfig.focusToken!)
      });
      assertRecord(response.payload, "created fiscal company");
      companyId = typeof response.payload.id === "string" ? response.payload.id : companyId;
      const policy = response.payload.stripePolicy;
      if (policy !== "manual_review") {
        throw new Error("created fiscal company must default stripePolicy to manual_review.");
      }
    });
  } else {
    results.push(optionalNotRun("fiscal", "create fiscal company", "Set DASK_SMOKE_CREATE_FISCAL_COMPANY=true and DASK_SMOKE_FOCUS_TOKEN to create one."));
  }

  if (companyId) {
    await runStep(results, "fiscal", "validate fiscal company", async () => {
      const response = await client.request(`/fiscal/workspaces/${workspace.id}/companies/${companyId}/validate`, {
        method: "POST",
        body: {}
      });
      assertRecord(response.payload, "fiscal company validation");
    }, { external: true });
  } else {
    results.push(optionalNotRun("fiscal", "validate fiscal company", "No fiscal company id available."));
  }

  if (smokeConfig.createFiscalDraft) {
    await runStep(results, "fiscal", "create fiscal draft/document", async () => {
      const response = await client.request(`/fiscal/workspaces/${workspace.id}/documents`, {
        method: "POST",
        body: makeFiscalDraftPayload(smokeId, companyId)
      });
      assertRecord(response.payload, "created fiscal draft");
      draftDocumentId = typeof response.payload.id === "string" ? response.payload.id : null;
    });
  } else {
    results.push(optionalNotRun("fiscal", "create fiscal draft/document", "Set DASK_SMOKE_CREATE_FISCAL_DRAFT=true to create persistent fiscal smoke data."));
  }

  if (smokeConfig.runExternals && !smokeConfig.skipFocus && draftDocumentId) {
    await runStep(results, "fiscal", "issue fiscal document via Focus", async () => {
      const response = await client.request(`/fiscal/workspaces/${workspace.id}/documents/${draftDocumentId}/issue`, {
        method: "POST",
        body: {}
      });
      assertRecord(response.payload, "issued fiscal document");
    }, { external: true });
  } else {
    results.push(optionalNotRun("fiscal", "issue/retry/sync Focus", "Focus external calls require DASK_SMOKE_RUN_EXTERNALS=true, DASK_SMOKE_SKIP_FOCUS=false and a created draft."));
  }

  if (smokeConfig.runExternals && !smokeConfig.skipFocus && companyId) {
    await runStep(results, "fiscal", "sync received documents via Focus", async () => {
      const response = await client.request(`/fiscal/workspaces/${workspace.id}/received/sync`, {
        method: "POST",
        body: { companyConfigId: companyId, type: "NFE_MDE", trigger: "MANUAL" }
      });
      assertRecord(response.payload, "received sync");
    }, { external: true });
  }
}

async function smokeAi(client: SmokeHttpClient, smokeConfig: SmokeConfig, workspace: SmokeWorkspace, results: SmokeStepResult[]): Promise<void> {
  if (smokeConfig.skipAi) {
    results.push(skip("ai", "AI smoke", "DASK_SMOKE_SKIP_AI=true."));
    return;
  }

  const smokeId = makeSmokeId();
  let agentId: string | null = null;

  await runStep(results, "ai", "load capabilities", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/capabilities`);
    assertRecord(response.payload, "AI capabilities");
  });

  await runStep(results, "ai", "list agents", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents`);
    assertArrayResponse(response.payload, "AI agents");
  });

  await runStep(results, "ai", "create agent", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents`, {
      method: "POST",
      body: makeAiAgentPayload(smokeId)
    });
    assertRecord(response.payload, "created AI agent");
    agentId = typeof response.payload.id === "string" ? response.payload.id : null;
    if (!agentId) {
      throw new Error("created AI agent response must include id.");
    }
  });

  if (!agentId) {
    results.push(skip("ai", "update/validate/publish/run/archive agent", "Agent was not created."));
    return;
  }

  await runStep(results, "ai", "update agent", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}`, {
      method: "PATCH",
      body: { description: "SMOKE agent updated by authenticated smoke." }
    });
    assertRecord(response.payload, "updated AI agent");
  });

  await runStep(results, "ai", "validate agent", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}/validate`, {
      method: "POST",
      body: {}
    });
    assertRecord(response.payload, "AI validation");
    if (response.payload.valid !== true) {
      throw new Error(`AI validation returned invalid: ${JSON.stringify(response.payload.issues ?? [])}`);
    }
  });

  await runStep(results, "ai", "verify invalid config error", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}`, {
      method: "PATCH",
      body: { temperature: 3 }
    });
    assertRecord(response.payload, "invalid AI config response");
    throw new Error("Invalid AI config unexpectedly succeeded.");
  });
  const invalidConfigStep = results[results.length - 1];
  if (invalidConfigStep?.outcome === "failed" && invalidConfigStep.status === 400) {
    invalidConfigStep.outcome = "passed";
    invalidConfigStep.message = "Invalid config was rejected with HTTP 400.";
  }

  await runStep(results, "ai", "publish agent", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}/publish`, {
      method: "POST",
      body: { activateWorkflow: true }
    });
    assertRecord(response.payload, "published AI agent");
  });

  if (smokeConfig.runExternals) {
    await runStep(results, "ai", "run agent", async () => {
      const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}/run`, {
        method: "POST",
        body: {
          instruction: "Return a short smoke acknowledgement.",
          context: { smoke: true }
        }
      });
      assertRecord(response.payload, "AI run");
    }, { external: true });
  } else {
    results.push(optionalNotRun("ai", "run agent", "Set DASK_SMOKE_RUN_EXTERNALS=true to exercise the runtime/provider path."));
  }

  await runStep(results, "ai", "load runs", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/runs?limit=5`);
    assertArrayResponse(response.payload, "AI runs");
  });

  await runStep(results, "ai", "archive agent", async () => {
    const response = await client.request(`/ai/workspaces/${workspace.id}/agents/${agentId}/archive`, {
      method: "POST",
      body: {}
    });
    assertRecord(response.payload, "archived AI agent");
  });
}

describe("authenticated contract smoke", () => {
  if (missingConfig.length > 0) {
    it(config.releaseSmoke ? "fails release smoke when required environment is missing" : "prints useful setup guidance when credentials are missing", () => {
      const message = config.releaseSmoke
        ? formatReleaseSmokeConfigError(missingConfig)
        : formatSmokeConfigHelp(missingConfig);
      console.info(message);
      if (config.releaseSmoke) {
        throw new Error(message);
      }
      expect(message).toContain("Authenticated smoke skipped");
    });
    return;
  }

  it("validates Billing, Fiscal and AI contracts against an authenticated workspace", async () => {
    const results: SmokeStepResult[] = [];
    const client = new SmokeHttpClient(config.apiUrl);

    try {
      await authenticate(client, config, results);
      const workspace = await resolveWorkspace(client, config, results);
      if (!workspace) {
        throw new Error("Smoke workspace could not be resolved.");
      }

      await smokeCriticalProductSurfaces(client, workspace, results);

      if (config.skipStripe) {
        results.push(skip("billing", "Billing smoke", "DASK_SMOKE_SKIP_STRIPE=true."));
      } else {
        await smokeBilling(client, workspace, results);
      }

      await smokeFiscal(client, config, workspace, results);
      await smokeAi(client, config, workspace, results);
    } finally {
      logResults(results);
    }

    assertNoFailures(results);
    if (config.releaseSmoke) {
      assertReleaseGate(results);
    }
  }, 120_000);
});
