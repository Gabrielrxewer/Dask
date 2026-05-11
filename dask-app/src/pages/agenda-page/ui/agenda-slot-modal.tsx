import type { CSSProperties } from "react";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta } from "@/entities/task";
import { AppDialog, StatusBadge } from "@/shared/ui";
import {
  getStateLabel,
  toAgendaDayLabel,
  toHourLabel,
  type SlotInspection
} from "./agenda-page.model";

interface AgendaSlotModalProps {
  slotInspection: SlotInspection;
  typeMap: ReturnType<typeof buildTaskTypeMetaMap>;
  membersById: Record<string, { name?: string } | undefined>;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
}

export function AgendaSlotModal({
  slotInspection,
  typeMap,
  membersById,
  onClose,
  onSelectTask
}: AgendaSlotModalProps) {
  const description = `${slotInspection.rowKind === "person" ? "Pessoa" : "Recurso"} - ${toAgendaDayLabel(slotInspection.slotStart)} - ${toHourLabel(slotInspection.slotStart)} - ${toHourLabel(slotInspection.slotEnd)}`;

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={slotInspection.rowLabel}
      description={description}
      className="agenda-slot-modal"
    >
      <div className="agenda-slot-modal__content">
        <div className="agenda-slot-modal__header">
          <StatusBadge tone={slotInspection.state === "conflict" ? "warning" : "default"}>
            {getStateLabel(slotInspection.state, slotInspection.tasks.length)}
          </StatusBadge>
        </div>

        <div className="agenda-slot-modal__list">
          {slotInspection.tasks.map(({ task, window }) => {
            const typeMeta = getTaskTypeDisplayMeta(typeMap, task.type);

            return (
              <button
                key={`${task.id}-${window.start}`}
                type="button"
                className="agenda-slot-modal__item"
                style={
                  {
                    "--agenda-slot-item-accent": typeMeta.text,
                    "--agenda-slot-item-accent-soft": typeMeta.background,
                    "--agenda-slot-item-border": typeMeta.border
                  } as CSSProperties
                }
                onClick={() => onSelectTask(task.id)}
              >
                <strong>{task.title}</strong>
                <span>{`${toHourLabel(window.start)} - ${toHourLabel(window.end)}`}</span>
                <small>{membersById[task.assignee]?.name ?? "Sem responsavel"}</small>
              </button>
            );
          })}
        </div>
      </div>
    </AppDialog>
  );
}
