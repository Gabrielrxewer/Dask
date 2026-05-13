import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Task } from "@/entities/task";
import type { Customer } from "@/modules/workspace";
import { CustomersListSection } from "./customers-list-section";
import type { PipelineMetrics } from "./commercial-page.model";

const customer: Customer = {
  id: "customer-1",
  workspaceId: "workspace-1",
  name: "Acme Ltda",
  legalName: "Acme Comercio Ltda",
  document: "12.345.678/0001-90",
  email: "financeiro@acme.test",
  phone: "(11) 99999-0000",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z"
};

const linkedTask: Task = {
  id: "task-1",
  title: "Oportunidade Acme",
  text: "",
  type: "commercial",
  status: "active",
  priority: 2,
  tags: [],
  assignee: "",
  checklist: { items: [] },
  due: "",
  customFields: {
    customerId: customer.id,
    proposalId: "proposal-1"
  }
};

const pipelineMetrics: PipelineMetrics = {
  totalPipelineValue: 0,
  wonValue: 0,
  avgDealSize: 0,
  activeWorkItems: 1,
  lostWorkItems: 0,
  totalWorkItems: 1,
  linkedCount: 1,
  proposals: 1,
  approvedProposals: 0,
  contracts: 0,
  customers: 1,
  activeCustomers: 1,
  conversionRate: 100,
  proposalWinRate: 0
};

describe("CustomersListSection", () => {
  it("renderiza clientes com DataTable compartilhada e preserva acoes por linha", () => {
    const html = renderToStaticMarkup(
      <CustomersListSection
        filteredCustomers={[customer]}
        commercialTasks={[linkedTask]}
        search=""
        pipelineMetrics={pipelineMetrics}
        onSearchChange={() => undefined}
        onOpenCustomerDetails={() => undefined}
        onNewCommercialWorkItem={() => undefined}
        totalCount={1}
      />
    );

    expect(html).toContain("shared-data-table");
    expect(html).toContain("Acme Comercio Ltda");
    expect(html).toContain("12.345.678/0001-90");
    expect(html).toContain("financeiro@acme.test");
    expect(html).toContain("Detalhes");
    expect(html).toContain("Novo WorkItem");
    expect(html).toContain("grid-template-columns:1.3fr 0.8fr 1.1fr 0.8fr 0.65fr 0.65fr 0.65fr 0.8fr 1.1fr");
  });

  it("mantem o estado vazio da DataTable compartilhada", () => {
    const html = renderToStaticMarkup(
      <CustomersListSection
        filteredCustomers={[]}
        commercialTasks={[]}
        search=""
        pipelineMetrics={{ ...pipelineMetrics, customers: 0, activeCustomers: 0 }}
        onSearchChange={() => undefined}
        onOpenCustomerDetails={() => undefined}
        onNewCommercialWorkItem={() => undefined}
        totalCount={0}
      />
    );

    expect(html).toContain("Nenhum cliente cadastrado.");
    expect(html).toContain("shared-data-table__row--empty");
  });
});
