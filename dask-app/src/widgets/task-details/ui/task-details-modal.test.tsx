import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTaskInputFromFieldDrafts, type TaskFieldDefinition } from "@/entities/task";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import {
  buildTaskDetailsOfficialFormValues,
  createTaskDetailsInitialFieldDrafts,
  mergeTaskDetailsFieldDraft,
  TaskDetailsModal
} from "./task-details-modal";

vi.mock("@radix-ui/react-dialog", async () => {
  const React = await import("react");

  return {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    Content: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    Title: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
    Description: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
    Close: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
    Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

function renderTaskDetailsModal(open: boolean) {
  if (!open) {
    return renderToStaticMarkup(null);
  }

  return renderToStaticMarkup(
    <TaskDetailsModal
      mode="create"
      statuses={factoryBoardConfig.statuses}
      initialStatusId="backlog"
      initialTypeId="task"
      membersById={{}}
      boardConfig={factoryBoardConfig}
      onCreateTask={() => undefined}
      onClose={() => undefined}
    />
  );
}

const commercialFields = [
  {
    id: "field-title",
    definitionId: "def-title",
    label: "Titulo",
    slug: "title",
    variableKey: "title",
    type: "text",
    required: true,
    storage: { kind: "item_property", property: "title" }
  },
  {
    id: "field-description",
    definitionId: "def-description",
    label: "Descricao",
    slug: "description",
    variableKey: "description",
    type: "long_text",
    storage: { kind: "item_property", property: "description" }
  },
  {
    id: "field-contact-name",
    definitionId: "def-contact-name",
    label: "Nome do contato",
    slug: "contactName",
    variableKey: "contactName",
    type: "text"
  },
  {
    id: "field-contact-email",
    definitionId: "def-contact-email",
    label: "Email do contato",
    slug: "contactEmail",
    variableKey: "contactEmail",
    type: "text"
  },
  {
    id: "field-contact-phone",
    definitionId: "def-contact-phone",
    label: "Telefone do contato",
    slug: "contactPhone",
    variableKey: "contactPhone",
    type: "text"
  },
  {
    id: "field-company",
    definitionId: "def-company",
    label: "Empresa",
    slug: "companyName",
    variableKey: "companyName",
    type: "text"
  },
  {
    id: "field-source",
    definitionId: "def-source",
    label: "Origem",
    slug: "source",
    variableKey: "source",
    type: "select",
    options: [
      { id: "website", label: "Website", value: "website" },
      { id: "referral", label: "Indicacao", value: "referral" }
    ]
  },
  {
    id: "field-status",
    definitionId: "def-status",
    label: "Status",
    slug: "status",
    variableKey: "status",
    type: "status",
    storage: { kind: "item_property", property: "stateSlug" }
  },
  {
    id: "field-assignee",
    definitionId: "def-assignee",
    label: "Responsavel",
    slug: "assigneeId",
    variableKey: "assigneeId",
    type: "user",
    storage: { kind: "item_property", property: "assigneeId" }
  },
  {
    id: "field-due-date",
    definitionId: "def-due-date",
    label: "Previsao de fechamento",
    slug: "dueDate",
    variableKey: "dueDate",
    type: "date",
    storage: { kind: "item_property", property: "dueDate" }
  }
] satisfies TaskFieldDefinition[];

function getCommercialField(id: string): TaskFieldDefinition {
  const field = commercialFields.find((candidate) => candidate.id === id);
  if (!field) {
    throw new Error(`Missing test field ${id}`);
  }
  return field;
}

function createCommercialDrafts() {
  return createTaskDetailsInitialFieldDrafts({
    task: null,
    fields: commercialFields,
    isCreateMode: true,
    initialStatusId: "new",
    selectedTypeId: "commercial"
  });
}

describe("TaskDetailsModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the create modal shell and can be absent when closed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const openHtml = renderTaskDetailsModal(true);
    const closedHtml = renderTaskDetailsModal(false);

    expect(openHtml).toContain("app-dialog__content shared-dialog-shell");
    expect(openHtml).toContain("shared-modal-overlay");
    expect(openHtml).toContain("task-details__surface");
    expect(openHtml).toContain("Criar work item");
    expect(openHtml).toContain('aria-label="Fechar editor"');
    expect(closedHtml).toBe("");
  });

  it("preserva titulo e descricao enquanto o usuario digita", () => {
    let drafts = createCommercialDrafts();

    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-title"), "Projeto ACME");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-description"), "Descricao da oportunidade");

    const formValues = buildTaskDetailsOfficialFormValues(commercialFields, drafts);

    expect(formValues.title).toBe("Projeto ACME");
    expect(formValues.description).toBe("Descricao da oportunidade");
  });

  it("preserva campos de contato ao preencher outros campos", () => {
    let drafts = createCommercialDrafts();

    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-name"), "Ana Souza");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-email"), "ana@example.com");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-phone"), "+55 11 99999-0000");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-company"), "ACME Ltda");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-title"), "Nova proposta");

    const formValues = buildTaskDetailsOfficialFormValues(commercialFields, drafts);

    expect(formValues.contactName).toBe("Ana Souza");
    expect(formValues.contactEmail).toBe("ana@example.com");
    expect(formValues.contactPhone).toBe("+55 11 99999-0000");
    expect(formValues.companyName).toBe("ACME Ltda");
    expect(formValues.title).toBe("Nova proposta");
  });

  it("preserva origem, status e responsavel apos novas mudancas no formulario", () => {
    let drafts = createCommercialDrafts();

    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-source"), "website");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-status"), "qualified");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-assignee"), "member-1");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-due-date"), "2026-06-30");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-description"), "Texto digitado depois dos selects");

    const formValues = buildTaskDetailsOfficialFormValues(commercialFields, drafts);

    expect(formValues.source).toBe("website");
    expect(formValues.status).toBe("qualified");
    expect(formValues.assigneeId).toBe("member-1");
    expect(formValues.dueDate).toBe("2026-06-30");
    expect(formValues.description).toBe("Texto digitado depois dos selects");
  });

  it("nao limpa o formulario ao recalcular defaults com drafts atuais", () => {
    let drafts = createCommercialDrafts();

    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-title"), "Titulo persistente");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-name"), "Contato persistente");

    const recalculatedDrafts = createTaskDetailsInitialFieldDrafts({
      task: null,
      fields: commercialFields,
      isCreateMode: true,
      initialStatusId: "new",
      selectedTypeId: "commercial",
      currentDrafts: drafts
    });
    const formValues = buildTaskDetailsOfficialFormValues(commercialFields, recalculatedDrafts);

    expect(formValues.title).toBe("Titulo persistente");
    expect(formValues.contactName).toBe("Contato persistente");
  });

  it("envia no payload os valores preenchidos no submit", () => {
    let drafts = createCommercialDrafts();

    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-title"), "Projeto ACME");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-description"), "Descricao enviada");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-name"), "Ana Souza");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-email"), "ana@example.com");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-contact-phone"), "+55 11 99999-0000");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-company"), "ACME Ltda");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-source"), "website");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-status"), "qualified");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-assignee"), "member-1");
    drafts = mergeTaskDetailsFieldDraft(drafts, getCommercialField("field-due-date"), "2026-06-30");

    expect(buildTaskInputFromFieldDrafts(commercialFields, drafts)).toEqual({
      title: "Projeto ACME",
      description: "Descricao enviada",
      stateId: "qualified",
      statusId: "qualified",
      assigneeId: "member-1",
      dueDate: "2026-06-30",
      customFieldValues: {
        "def-contact-name": "Ana Souza",
        "def-contact-email": "ana@example.com",
        "def-contact-phone": "+55 11 99999-0000",
        "def-company": "ACME Ltda",
        "def-source": "website"
      }
    });
  });
});
