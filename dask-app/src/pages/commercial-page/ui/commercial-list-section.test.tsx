import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Task, TaskStatus } from "@/entities/task";
import { CommercialListSection } from "./commercial-list-section";

const prospect = {
  id: "prospect-1",
  type: "prospect",
  status: "prospect",
  title: "ACME",
  text: "Contato inicial",
  customFields: {
    companyName: "ACME",
    contactName: "Ana",
    source: "Inbound"
  }
} as unknown as Task;

const boardStatuses = [
  { id: "prospect", label: "Prospect", dot: "#2563eb" }
] as TaskStatus[];

function renderCommercialList(overrides?: Partial<Parameters<typeof CommercialListSection>[0]>) {
  return renderToStaticMarkup(
    <CommercialListSection
      filteredTasks={[prospect]}
      filteredWorkItemMetrics={{
        totalValue: 0,
        activeCount: 1,
        unlinkedCount: 1,
        proposalCount: 0,
        billingCount: 0,
        openValue: 0,
        nextStepsCount: 1,
        avgValue: 0
      }}
      search=""
      customersById={new Map()}
      documentsById={new Map()}
      boardStatuses={boardStatuses}
      statusLabelById={new Map([["prospect", "Prospect"]])}
      resolveCatalogLabel={() => ""}
      onSearchChange={vi.fn()}
      onOpenCustomerDetails={vi.fn()}
      onOpenCustomerFromWorkItem={vi.fn()}
      onOpenLinkCustomer={vi.fn()}
      onCreateCharge={vi.fn()}
      onTransformSignal={vi.fn()}
      onOpenFlow={vi.fn()}
      onOpenDocs={vi.fn()}
      onOpenBoard={vi.fn()}
      signalTypeIds={["prospect"]}
      {...overrides}
    />
  );
}

describe("CommercialListSection", () => {
  it("shows the Prospect conversion action as Transformar em Lead", () => {
    const html = renderCommercialList();

    expect(html).toContain("Transformar em Lead");
    expect(html).not.toContain("Transformar em WorkItem");
  });

  it("keeps the Prospect card rendered before any backend confirmation", () => {
    const html = renderCommercialList();

    expect(html).toContain("ACME");
    expect(html).toContain("Prospect");
  });
});
