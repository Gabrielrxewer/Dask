import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import type { Task } from "@/entities/task";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema";
import { buildWorkItemFormSchema } from "@/entities/work-item-form/buildWorkItemFormSchema";
import { mapWorkItemToFormValues } from "@/entities/work-item-form/mapWorkItemToFormValues";
import type { WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";

export function useWorkItemForm(schema: WorkItemPublicSchema, task?: Task | null) {
  const resolverSchema = useMemo(() => buildWorkItemFormSchema(schema), [schema]);
  const defaultValues = useMemo(() => mapWorkItemToFormValues(task, schema), [schema, task]);

  return useForm<WorkItemFormValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange"
  });
}
