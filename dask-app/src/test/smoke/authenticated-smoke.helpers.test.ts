import { describe, expect, it } from "vitest";
import {
  SmokeHttpError,
  assertPageResponse,
  classifySmokeError,
  formatSmokeConfigHelp,
  getMissingRequiredSmokeConfig,
  makeAiAgentPayload,
  makeBillingCatalogPayload,
  makeFiscalCompanyPayload,
  makeFiscalDraftPayload,
  readSmokeConfig,
  toWorkspaceSlug
} from "./authenticated-smoke.helpers";

describe("authenticated smoke helpers", () => {
  it("parses env with safe defaults and reports missing auth/workspace config", () => {
    const config = readSmokeConfig({});

    expect(config.apiUrl).toBe("http://localhost:3333/api/v1");
    expect(config.baseUrl).toBe("http://localhost:5173");
    expect(config.releaseSmoke).toBe(false);
    expect(config.runExternals).toBe(false);
    expect(getMissingRequiredSmokeConfig(config)).toEqual([
      "DASK_SMOKE_EMAIL",
      "DASK_SMOKE_PASSWORD",
      "DASK_SMOKE_WORKSPACE_ID or DASK_SMOKE_WORKSPACE_SLUG"
    ]);
    expect(formatSmokeConfigHelp(["DASK_SMOKE_EMAIL"])).toContain("DASK_SMOKE_EMAIL");
  });

  it("requires explicit URLs, credentials and workspace in release smoke mode", () => {
    const config = readSmokeConfig({ DASK_RELEASE_SMOKE: "1" });

    expect(config.releaseSmoke).toBe(true);
    expect(getMissingRequiredSmokeConfig(config)).toEqual([
      "DASK_SMOKE_BASE_URL",
      "DASK_SMOKE_API_URL",
      "DASK_SMOKE_EMAIL",
      "DASK_SMOKE_PASSWORD",
      "DASK_SMOKE_WORKSPACE_ID or DASK_SMOKE_WORKSPACE_SLUG"
    ]);
  });

  it("normalizes workspace slugs like the workspace service", () => {
    expect(toWorkspaceSlug({ id: "workspace-id", key: "Core Ops", name: "Ignored" })).toBe("core-ops");
    expect(toWorkspaceSlug({ id: "workspace-id", key: "", name: "Fiscal & Billing" })).toBe("fiscal-billing");
  });

  it("classifies external provider gaps without hiding real 500 errors", () => {
    expect(
      classifySmokeError(
        "billing",
        new SmokeHttpError(409, { message: "Stripe Connect account is not configured" })
      ).outcome
    ).toBe("environment_gap");

    expect(
      classifySmokeError(
        "fiscal",
        new SmokeHttpError(404, { message: "Focus company was not found" }),
        { external: true }
      ).outcome
    ).toBe("environment_gap");

    expect(
      classifySmokeError(
        "billing",
        new SmokeHttpError(500, { message: "Unexpected server error" })
      ).outcome
    ).toBe("failed");
  });

  it("validates cursor page shape", () => {
    expect(() => assertPageResponse({ items: [], nextCursor: null }, "items")).not.toThrow();
    expect(() => assertPageResponse({ items: [], nextCursor: "abc" }, "items")).not.toThrow();
    expect(() => assertPageResponse({ items: [], nextCursor: 10 }, "items")).toThrow("nextCursor");
    expect(() => assertPageResponse({ nextCursor: null }, "items")).toThrow("items array");
  });

  it("builds smoke payloads with explicit SMOKE markers and safe defaults", () => {
    expect(makeBillingCatalogPayload("abc").name).toContain("SMOKE_");
    expect(makeFiscalCompanyPayload("abc", "focus-token-value").stripePolicy).toBe("manual_review");
    expect(makeFiscalDraftPayload("abc").metadata).toMatchObject({ policy: "manual_review" });
    expect(makeAiAgentPayload("abc").name).toContain("SMOKE");
  });
});
