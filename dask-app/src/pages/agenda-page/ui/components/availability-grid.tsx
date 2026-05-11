import type { AgendaSlot } from "@/pages/agenda-page/model/agenda-view-model";
import type {
  AvailabilityMode,
  AvailabilityRowSnapshot,
  DetailTarget,
  SlotInspection
} from "@/pages/agenda-page/ui/agenda-page.model";
import { getStateLabel } from "@/pages/agenda-page/ui/agenda-page.model";
import { AppIcon, AppTooltip } from "@/shared/ui";

interface AvailabilityGridProps {
  availabilityMode: AvailabilityMode;
  hourSlots: AgendaSlot[];
  rows: AvailabilityRowSnapshot[];
  slotMinutes: number;
  onOpenDetail: (target: DetailTarget) => void;
  onInspectSlot: (slot: SlotInspection) => void;
}

export function AvailabilityGrid({
  availabilityMode,
  hourSlots,
  rows,
  slotMinutes,
  onOpenDetail,
  onInspectSlot
}: AvailabilityGridProps) {
  return (
    <div className="agenda-view__availability-scroll">
      <table className="agenda-view__availability-table">
        <thead>
          <tr>
            <th>{availabilityMode === "people" ? "Pessoa" : "Recurso"}</th>
            {hourSlots.map(slot => (
              <th key={slot.key}>
                {slot.label}
                {slot.key === "0" ? (
                  <AppTooltip
                    content={`A grade usa intervalos de ${slotMinutes} minutos entre 06:00 e 22:00. Slots parciais e conflitos aparecem com cor propria.`}
                  >
                    <button type="button" className="agenda-view__info-button" aria-label="Mais informacoes sobre horarios">
                      <AppIcon name="info" size={12} />
                    </button>
                  </AppTooltip>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th>
                <div className="agenda-view__row-head">
                  <button
                    type="button"
                    className="agenda-view__row-name"
                    onClick={() => onOpenDetail({ id: row.id, label: row.label, kind: row.detailKind })}
                  >
                    {row.label}
                  </button>
                  <small>{row.subtitle}</small>
                </div>
              </th>
              {row.slots.map((slot) => {
                const stateLabel = getStateLabel(slot.state, slot.tasks.length);

                return (
                  <td key={`${row.id}-${slot.key}`}>
                    <div className={`agenda-view__cell agenda-view__cell--${slot.state}`}>
                      {slot.state === "free" ? (
                        <span>Livre</span>
                      ) : (
                        <button
                          type="button"
                          title={slot.tasks.map(entry => entry.task.title).join(" | ")}
                          onClick={() =>
                            onInspectSlot({
                              rowLabel: row.label,
                              rowKind: row.detailKind,
                              state: slot.state,
                              tasks: slot.tasks,
                              slotStart: slot.slotStart,
                              slotEnd: slot.slotEnd
                            })
                          }
                        >
                          <strong>{stateLabel}</strong>
                          <span>{slot.tasks[0]?.task.title ?? "Atividade planejada"}</span>
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
