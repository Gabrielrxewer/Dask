import { describe, expect, it } from "vitest";
import {
  commercialTemplateMigrations,
  getCommercialFieldDefinition,
  getCommercialTemplate,
  listCommercialFieldKeys
} from "./commercial-template";

describe("commercial template registry", () => {
  it("resolves versioned commercial fields from the official registry", () => {
    const leadTemplate = getCommercialTemplate("lead", 1);

    expect(leadTemplate.version).toBe(1);
    expect(listCommercialFieldKeys("lead")).toContain("customerName");
    expect(getCommercialFieldDefinition("lead", "estimatedValue")?.type).toBe("currency");
  });

  it("declares a compatible Signal to Lead field migration", () => {
    const migration = commercialTemplateMigrations.find(
      (entry) => entry.fromTemplate === "signal" && entry.toTemplate === "lead"
    );

    expect(migration?.fieldMap.customerName).toBe("customerName");
    expect(migration?.fieldMap.conversionStatus).toBe("conversionStatus");
  });
});
