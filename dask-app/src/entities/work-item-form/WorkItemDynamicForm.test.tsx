import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { WORK_ITEM_SCHEMA_VERSION, type WorkItemPublicSchema } from "@/entities/work-item-schema";
import { WorkItemDynamicForm } from "./WorkItemDynamicForm";
import { WorkItemFormProvider } from "./WorkItemFormProvider";
import type { WorkItemFormValues } from "./buildWorkItemDefaultValues";
import { resolveWorkItemFormFieldLayout } from "./workItemFormLayout";

const formFields = [
  { fieldId: "runtime-title", section: "main", order: 0, visible: true, display: { detailZone: "main" } },
  { fieldId: "contactName", section: "main", order: 1, visible: true, display: { detailZone: "main" } },
  { fieldId: "contactEmail", section: "main", order: 2, visible: true, display: { detailZone: "main" } },
  { fieldId: "description", section: "main", order: 3, visible: true, display: { detailZone: "main" } }
] satisfies WorkItemPublicSchema["layouts"]["form"]["fields"];

const schema: WorkItemPublicSchema = {
  schemaVersion: WORK_ITEM_SCHEMA_VERSION,
  id: "commercial-intake",
  workspaceId: "workspace",
  name: "Comercial",
  fields: [
    {
      id: "title",
      key: "title",
      label: "Titulo",
      type: "text",
      required: true,
      metadata: {
        runtimeFieldId: "runtime-title",
        storage: { kind: "item_property", property: "title" }
      }
    },
    {
      id: "contactName",
      key: "contactName",
      label: "Nome do contato",
      type: "text",
      required: false
    },
    {
      id: "contactEmail",
      key: "contactEmail",
      label: "Email do contato",
      type: "text",
      required: false
    },
    {
      id: "description",
      key: "description",
      label: "Descricao",
      type: "textarea",
      required: false,
      metadata: {
        storage: { kind: "item_property", property: "description" }
      }
    }
  ],
  layouts: {
    card: { surface: "card", fields: [] },
    detail: { surface: "detail", fields: formFields },
    form: { surface: "form", fields: formFields }
  },
  workflow: { stateIds: [] }
};

function StaticWorkItemDynamicForm() {
  const form = useForm<WorkItemFormValues>({
    defaultValues: {
      title: "",
      contactName: "",
      contactEmail: "",
      description: ""
    }
  });

  return (
    <WorkItemFormProvider form={form}>
      <WorkItemDynamicForm schema={schema} layoutZone="main" />
    </WorkItemFormProvider>
  );
}

describe("WorkItemDynamicForm", () => {
  it("renderiza campos na ordem do layout e aplica slots fluidos", () => {
    const html = renderToStaticMarkup(<StaticWorkItemDynamicForm />);

    expect(html.indexOf("Titulo")).toBeLessThan(html.indexOf("Nome do contato"));
    expect(html.indexOf("Nome do contato")).toBeLessThan(html.indexOf("Email do contato"));
    expect(html.indexOf("Email do contato")).toBeLessThan(html.indexOf("Descricao"));

    expect(html).toContain('data-field-id="title"');
    expect(html).toContain('data-field-id="contactName"');
    expect(html).toContain('data-form-zone="main"');
    expect(html).toContain('data-form-span="wide"');
    expect(html).toContain('data-form-span="compact"');
    expect(html).toContain("work-item-form-slot--wide");
    expect(html).toContain("work-item-form-slot--compact");
    expect(html).toContain("shared-input");
    expect(html).toContain("shared-textarea");
  });

  it("trata campos sistemicos de titulo e descricao como largura total", () => {
    expect(resolveWorkItemFormFieldLayout({
      id: "title",
      key: "sys_title",
      label: "Titulo",
      type: "text",
      required: true,
      metadata: { cardArea: "title" }
    }, undefined, "main").span).toBe("wide");

    expect(resolveWorkItemFormFieldLayout({
      id: "description",
      key: "sys_description",
      label: "Descricao",
      type: "text",
      required: false,
      metadata: { cardArea: "description" }
    }, undefined, "main").span).toBe("wide");
  });
});
