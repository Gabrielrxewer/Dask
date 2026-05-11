import type { Task, TaskFieldDefinition } from "@/entities/task";

interface WorkItemCustomerCellProps {
  task: Task;
  field?: TaskFieldDefinition;
}

export function WorkItemCustomerCell({ task, field }: WorkItemCustomerCellProps) {
  const fieldKey = field?.variableKey ?? field?.slug ?? field?.id ?? "customerId";
  const value =
    task.customFields.clientName ??
    task.customFields.customerName ??
    task.customFields.companyName ??
    task.customFields[fieldKey] ??
    task.customFieldValuesById?.[field?.id ?? ""];

  if (typeof value !== "string" || value.trim().length === 0) {
    return <span className="work-item-cell-empty">-</span>;
  }

  return <span className="work-item-cell-customer">{value}</span>;
}
