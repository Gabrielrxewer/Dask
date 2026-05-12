import { describe, expect, it } from "vitest";
import { buildNodeConfigZodSchema } from "@/shared/flow-node-config";
import {
  buildDefaultNodeConfig,
  createAutomationNodeConfigDescriptor
} from "./automation-node-registry";

const descriptorInput = {
  boardColumns: [],
  workflowStates: [],
  customFields: [],
  itemTypes: []
};

describe("automation node config descriptors", () => {
  it("validates required structured fields for automation nodes", () => {
    const descriptor = createAutomationNodeConfigDescriptor({
      ...descriptorInput,
      nodeType: "create_followup_task",
      nodeLabel: "Criar follow-up"
    });
    const schema = buildNodeConfigZodSchema(descriptor);

    expect(schema.safeParse({
      itemIdPath: "event.payload.itemId",
      title: "",
      description: "Acompanhar retorno."
    }).success).toBe(false);

    expect(schema.safeParse({
      itemIdPath: "event.payload.itemId",
      title: "Follow-up comercial",
      description: "Acompanhar retorno."
    }).success).toBe(true);
  });

  it("uses structured key-value config fields instead of raw JSON text", () => {
    const descriptor = createAutomationNodeConfigDescriptor({
      ...descriptorInput,
      nodeType: "register_card_activity",
      nodeLabel: "Registrar atividade"
    });
    const schema = buildNodeConfigZodSchema(descriptor);
    const baseConfig = buildDefaultNodeConfig("register_card_activity");

    expect(schema.safeParse({
      ...baseConfig,
      payload: { severity: "info" }
    }).success).toBe(true);

    expect(descriptor.fields.find((field) => field.name === "payload")).toMatchObject({
      type: "key-value-list"
    });
    expect(schema.safeParse({
      ...baseConfig,
      payload: "{ invalid"
    }).success).toBe(false);
  });
});
