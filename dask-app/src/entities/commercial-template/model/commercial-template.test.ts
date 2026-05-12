import { describe, expect, it } from "vitest";
import {
  commercialTemplateMigrations,
  getCommercialFieldDefinition,
  getCommercialTemplate,
  listCommercialFieldKeys
} from "./commercial-template";

describe("commercial template registry", () => {
  it("resolves versioned commercial fields from the official registry", () => {
    const workItemTemplate = getCommercialTemplate("workItem", 1);

    expect(workItemTemplate.version).toBe(1);
    expect(listCommercialFieldKeys("workItem")).toContain("customerName");
    expect(getCommercialFieldDefinition("workItem", "estimatedValue")?.type).toBe("currency");
  });

  it("declares a compatible Signal to WorkItem field migration", () => {
    const migration = commercialTemplateMigrations.find(
      (entry) => entry.fromTemplate === "signal" && entry.toTemplate === "workItem"
    );

    expect(migration?.fieldMap.customerName).toBe("customerName");
    expect(migration?.fieldMap.conversionStatus).toBe("conversionStatus");
  });
});
