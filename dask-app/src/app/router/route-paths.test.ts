import { describe, expect, it } from "vitest";
import {
  buildWorkspaceCommercialLeadsAliasPath,
  buildWorkspaceCommercialPath,
  routePaths
} from "@/app/router/route-paths";

describe("workspace route aliases", () => {
  it("keeps /leads only as a product alias for the commercial route", () => {
    expect(routePaths.commercialLeadsAlias).toBe("/w/:workspaceSlug/leads");
    expect(routePaths.commercial).toBe("/w/:workspaceSlug/commercial");
    expect(buildWorkspaceCommercialLeadsAliasPath("Acme")).toBe("/w/acme/leads");
    expect(buildWorkspaceCommercialPath("Acme")).toBe("/w/acme/commercial");
    expect("legacyLeads" in routePaths).toBe(false);
  });
});
