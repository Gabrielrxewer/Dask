import { workspaceService } from "@/modules/workspace/api";
import type {
  CreateCustomerInput,
  CustomerStatus,
  ListWorkItemsInput,
  UpdateTaskInput
} from "@/modules/workspace";
import type {
  CommercialWorkItemFilters,
  CreateCommercialWorkItemInput,
  CustomerListFilters,
  UpdateCommercialWorkItemInput
} from "@/modules/leads/model/types";

function cleanWorkItemFilters(filters?: CommercialWorkItemFilters): Omit<ListWorkItemsInput, "cursor" | "typeSlug"> {
  return {
    limit: filters?.limit,
    search: filters?.search?.trim() || undefined,
    workflowStateId: filters?.workflowStateId || undefined,
    source: filters?.source?.trim() || undefined,
    responsibleId: filters?.responsibleId || undefined,
    customerId: filters?.customerId || undefined,
    converted: filters?.converted,
    createdAtFrom: filters?.createdAtFrom || undefined,
    createdAtTo: filters?.createdAtTo || undefined,
    updatedAtFrom: filters?.updatedAtFrom || undefined,
    updatedAtTo: filters?.updatedAtTo || undefined,
    sort: filters?.sort ?? "updated_desc"
  };
}

function cleanCustomerFilters(filters?: CustomerListFilters): { search?: string; status?: CustomerStatus; limit?: number } {
  return {
    search: filters?.search?.trim() || undefined,
    status: filters?.status,
    limit: filters?.limit
  };
}

export const leadsService = {
  // Fonte oficial: Lead e Signal sao WorkItems comerciais; este facade nao fala com a tabela Prisma Lead.
  listCommercialWorkItems(
    workspaceSlug: string,
    input: { typeSlug: string; filters?: CommercialWorkItemFilters; cursor?: string | null }
  ) {
    return workspaceService.listWorkItemsPage(workspaceSlug, {
      ...cleanWorkItemFilters(input.filters),
      typeSlug: input.typeSlug,
      cursor: input.cursor ?? null
    });
  },

  getCommercialWorkItem(workspaceSlug: string, workItemId: string) {
    return workspaceService.getSnapshot(workspaceSlug).then((snapshot) => {
      const item = snapshot.tasks.find((task) => task.id === workItemId);
      if (!item) {
        throw new Error("WorkItem comercial nao encontrado.");
      }
      return item;
    });
  },

  createCommercialWorkItem(workspaceSlug: string, input: CreateCommercialWorkItemInput) {
    return workspaceService.createTask(workspaceSlug, {
      type: input.typeSlug,
      title: input.title,
      description: input.description ?? "",
      priority: 2,
      statusId: input.stateSlug,
      fields: input.fields,
      customFieldValues: input.customFieldValues
    });
  },

  updateCommercialWorkItem(workspaceSlug: string, input: UpdateCommercialWorkItemInput) {
    const patch: UpdateTaskInput = {
      title: input.title,
      description: input.description,
      stateId: input.stateId,
      typeSlug: input.typeSlug,
      fields: input.fields,
      customFieldValues: input.customFieldValues
    };
    return workspaceService.updateTask(workspaceSlug, input.workItemId, patch);
  },

  moveCommercialWorkItem(
    workspaceSlug: string,
    input: { workItemId: string; stateSlug?: string; stateId?: string }
  ) {
    if (input.stateId) {
      return workspaceService.updateTask(workspaceSlug, input.workItemId, { stateId: input.stateId });
    }

    if (!input.stateSlug) {
      throw new Error("Estado de destino nao informado.");
    }

    return workspaceService.moveTask(workspaceSlug, input.workItemId, input.stateSlug);
  },

  listTransformations(workspaceSlug: string) {
    return workspaceService.listWorkItemTypeTransformations(workspaceSlug);
  },

  validateTransformation(
    workspaceSlug: string,
    workItemId: string,
    input: Parameters<typeof workspaceService.validateWorkItemTypeTransformation>[2]
  ) {
    return workspaceService.validateWorkItemTypeTransformation(workspaceSlug, workItemId, input);
  },

  transformWorkItemType(
    workspaceSlug: string,
    workItemId: string,
    input: Parameters<typeof workspaceService.transformWorkItemType>[2]
  ) {
    return workspaceService.transformWorkItemType(workspaceSlug, workItemId, input);
  },

  convertLeadToCustomer(
    workspaceSlug: string,
    workItemId: string,
    input: Parameters<typeof workspaceService.convertWorkItemToCustomer>[2]
  ) {
    return workspaceService.convertWorkItemToCustomer(workspaceSlug, workItemId, input);
  },

  listCustomers(workspaceSlug: string, filters?: CustomerListFilters, cursor?: string | null) {
    return workspaceService.listCustomersPage(workspaceSlug, {
      ...cleanCustomerFilters(filters),
      cursor: cursor ?? null
    });
  },

  createCustomer(workspaceSlug: string, input: CreateCustomerInput) {
    return workspaceService.createCustomer(workspaceSlug, input);
  },

  updateCustomer(workspaceSlug: string, customerId: string, input: Partial<CreateCustomerInput>) {
    return workspaceService.updateCustomer(workspaceSlug, customerId, input);
  }
};
