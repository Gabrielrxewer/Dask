import type { BoardLeadOperationalMetadata, Task } from "@/entities/task";
import type {
  CreateCustomerInput,
  Customer,
  CustomerStatus,
  CustomersPage,
  WorkItemTypeTransformationPayload,
  WorkItemTypeTransformationSummary,
  WorkItemTypeTransformationValidation,
  WorkItemsPage
} from "@/modules/workspace";

export type CommercialWorkItem = Task;
export type LeadWorkItem = CommercialWorkItem;
export type SignalWorkItem = CommercialWorkItem;

export interface CommercialWorkItemFilters {
  search?: string;
  workflowStateId?: string;
  source?: string;
  responsibleId?: string;
  customerId?: string;
  converted?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  sort?: "position_asc" | "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
  limit?: number;
}

export interface LeadListFilters extends CommercialWorkItemFilters {
  workItemType?: string;
}

export interface CustomerListFilters {
  search?: string;
  status?: CustomerStatus;
  limit?: number;
}

export type CommercialWorkItemsPage = WorkItemsPage;
export type CommercialCustomersPage = CustomersPage;

export interface CreateCommercialWorkItemInput {
  typeSlug: string;
  stateSlug: string;
  title: string;
  description?: string;
  fields: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export interface UpdateCommercialWorkItemInput {
  workItemId: string;
  title?: string;
  description?: string;
  stateId?: string;
  typeSlug?: string;
  fields?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export interface LinkCustomerToLeadInput {
  workItemId: string;
  fields: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export type TransformWorkItemTypeInput = WorkItemTypeTransformationPayload & {
  workItemId: string;
};

export interface ConvertLeadToCustomerInput {
  workItemId: string;
  customerId?: string;
  customer?: CreateCustomerInput;
  fields?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export interface LeadsOperationalContext {
  metadata: BoardLeadOperationalMetadata | null;
  leadTypeSlug: string | null;
  signalTypeSlug: string | null;
  initialLeadStateSlug: string | null;
  initialSignalStateSlug: string | null;
}

export interface CreateCustomerFromLeadInput {
  customer: CreateCustomerInput;
  sourceWorkItemId?: string | null;
}

export interface CustomerMutationInput {
  customerId?: string;
  customer: CreateCustomerInput | Partial<CreateCustomerInput>;
}

export type { Customer };
export type { WorkItemTypeTransformationPayload, WorkItemTypeTransformationSummary, WorkItemTypeTransformationValidation };
