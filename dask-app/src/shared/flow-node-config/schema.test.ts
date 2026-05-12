import { describe, expect, it } from "vitest";
import {
  createDelayNodeConfigDescriptor,
  createTriggerNodeConfigDescriptor
} from "./common-node-descriptors";
import { buildNodeConfigZodSchema } from "./schema";
import type { NodeConfigDescriptor } from "./types";

describe("buildNodeConfigZodSchema", () => {
  it("validates required descriptor fields", () => {
    const descriptor: NodeConfigDescriptor = {
      type: "send_message",
      label: "Send message",
      fields: [
        { name: "channel", label: "Channel", type: "select", required: true },
        { name: "body", label: "Body", type: "textarea", required: true }
      ]
    };

    const result = buildNodeConfigZodSchema(descriptor).safeParse({ channel: "email", body: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["body"]);
    }
  });

  it("supports requiredAny validation groups", () => {
    const descriptor: NodeConfigDescriptor = {
      type: "lookup",
      label: "Lookup",
      fields: [
        { name: "email", label: "Email", type: "text" },
        { name: "phone", label: "Phone", type: "text" }
      ],
      validation: {
        requiredAny: [["email", "phone"]]
      }
    };

    expect(buildNodeConfigZodSchema(descriptor).safeParse({ email: "", phone: "" }).success).toBe(false);
    expect(buildNodeConfigZodSchema(descriptor).safeParse({ email: "user@dask.test" }).success).toBe(true);
  });

  it("validates AI node-like select and numeric constraints", () => {
    const descriptor: NodeConfigDescriptor = {
      type: "llm",
      label: "LLM",
      fields: [
        { name: "model", label: "Modelo", type: "model-selector", required: true },
        { name: "temperature", label: "Temperatura", type: "number", min: 0, max: 2 }
      ]
    };
    const schema = buildNodeConfigZodSchema(descriptor);

    expect(schema.safeParse({ model: "", temperature: 0.2 }).success).toBe(false);
    expect(schema.safeParse({ model: "gpt-4.1-mini", temperature: 3 }).success).toBe(false);
    expect(schema.safeParse({ model: "gpt-4.1-mini", temperature: 0.2 }).success).toBe(true);
  });

  it("validates structured key-value records without accepting raw JSON text", () => {
    const descriptor: NodeConfigDescriptor = {
      type: "activity",
      label: "Activity",
      fields: [
        { name: "payload", label: "Payload", type: "key-value-list" }
      ]
    };
    const schema = buildNodeConfigZodSchema(descriptor);

    expect(schema.safeParse({ payload: { severity: "info" } }).success).toBe(true);
    expect(schema.safeParse({ payload: "{ invalid" }).success).toBe(false);
  });

  it("validates shared trigger and delay descriptors", () => {
    const trigger = createTriggerNodeConfigDescriptor({
      type: "trigger",
      label: "Trigger",
      eventFieldName: "event",
      triggerOptions: [{ value: "manual", label: "Manual" }]
    });
    const delay = createDelayNodeConfigDescriptor({
      type: "delay",
      label: "Delay",
      amountFieldName: "delayFor.amount",
      unitFieldName: "delayFor.unit"
    });

    expect(buildNodeConfigZodSchema(trigger).safeParse({ event: "" }).success).toBe(false);
    expect(buildNodeConfigZodSchema(trigger).safeParse({ event: "manual" }).success).toBe(true);
    expect(buildNodeConfigZodSchema(delay).safeParse({ delayFor: { amount: 0, unit: "days" } }).success).toBe(false);
    expect(buildNodeConfigZodSchema(delay).safeParse({ delayFor: { amount: 1, unit: "days" } }).success).toBe(true);
  });
});
