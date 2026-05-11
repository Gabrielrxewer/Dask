import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { WorkspaceSnapshot } from "@/modules/workspace/model";
import {
  invalidateWorkspaceQueries,
  setWorkspaceSnapshotQueryData,
  workspaceQueryKeys
} from "@/modules/workspace/query";
import { toast } from "@/shared/ui/toast";
import { agendaQueryKeys } from "@/modules/agenda/query/agenda-query-keys";

export type RescheduleWorkItemMutationInput = {
  workspaceId?: string;
  workItemId: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  assigneeId?: string | null;
  resourceId?: string | null;
  reason?: "agenda_drag_reschedule";
};

type AgendaMutationContext = {
  workspaceId: string;
  previousSnapshot?: WorkspaceSnapshot;
  previousAgendaQueries: Array<[readonly unknown[], Task[] | undefined]>;
};

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

function applyScheduleToTask(task: Task, input: RescheduleWorkItemMutationInput): Task {
  if (task.id !== input.workItemId) {
    return task;
  }

  return {
    ...task,
    plannedStartAt: input.plannedStartAt,
    plannedEndAt: input.plannedEndAt,
    customFields: {
      ...task.customFields,
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt
    }
  };
}

function applyScheduleToSnapshot(
  snapshot: WorkspaceSnapshot,
  input: RescheduleWorkItemMutationInput
): WorkspaceSnapshot {
  return {
    ...snapshot,
    tasks: snapshot.tasks.map(task => applyScheduleToTask(task, input))
  };
}

export function useRescheduleWorkItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RescheduleWorkItemMutationInput) => {
      const resolvedWorkspaceId = requireWorkspace(input.workspaceId ?? workspaceId);
      return workspaceService.updateTaskSchedule(resolvedWorkspaceId, input.workItemId, {
        plannedStartAt: input.plannedStartAt,
        plannedEndAt: input.plannedEndAt,
        reason: input.reason ?? "agenda_drag_reschedule"
      });
    },
    onMutate: async (input): Promise<AgendaMutationContext> => {
      const resolvedWorkspaceId = requireWorkspace(input.workspaceId ?? workspaceId);
      const snapshotKey = workspaceQueryKeys.workspaceSnapshot(resolvedWorkspaceId);
      const agendaWorkItemsKey = agendaQueryKeys.workItemsRoot(resolvedWorkspaceId);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: snapshotKey }),
        queryClient.cancelQueries({ queryKey: agendaWorkItemsKey })
      ]);

      const previousSnapshot = queryClient.getQueryData<WorkspaceSnapshot>(snapshotKey);
      const previousAgendaQueries = queryClient.getQueriesData<Task[]>({ queryKey: agendaWorkItemsKey });

      if (previousSnapshot) {
        queryClient.setQueryData(snapshotKey, applyScheduleToSnapshot(previousSnapshot, input));
      }

      queryClient.setQueriesData<Task[]>({ queryKey: agendaWorkItemsKey }, (current) =>
        current?.map(task => applyScheduleToTask(task, input))
      );

      return {
        workspaceId: resolvedWorkspaceId,
        previousSnapshot,
        previousAgendaQueries
      };
    },
    onError: (error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(
          workspaceQueryKeys.workspaceSnapshot(context.workspaceId),
          context.previousSnapshot
        );
      }

      context?.previousAgendaQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel reagendar", { description: message });
    },
    onSuccess: (snapshot, _input, context) => {
      setWorkspaceSnapshotQueryData(queryClient, context.workspaceId, snapshot);
      toast.success("WorkItem reagendado");
    },
    onSettled: (_snapshot, _error, _input, context) => {
      if (!context?.workspaceId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: agendaQueryKeys.workspace(context.workspaceId) });
      void invalidateWorkspaceQueries(queryClient, context.workspaceId);
    }
  });
}
