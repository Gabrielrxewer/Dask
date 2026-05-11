import type { AvailabilityRowSnapshot, DetailTarget, SlotInspection } from "@/pages/agenda-page/ui/agenda-page.model";
import { getStateLabel, toHourLabel } from "@/pages/agenda-page/ui/agenda-page.model";

interface MobileAvailabilityListProps {
  rows: AvailabilityRowSnapshot[];
  onOpenDetail: (target: DetailTarget) => void;
  onInspectSlot: (slot: SlotInspection) => void;
}

export function MobileAvailabilityList({
  rows,
  onOpenDetail,
  onInspectSlot
}: MobileAvailabilityListProps) {
  return (
    <div className="agenda-view__mobile-list">
      {rows.map((row) => (
        <article key={`mobile-${row.id}`} className="agenda-view__mobile-card">
          <button
            type="button"
            className="agenda-view__mobile-card-title"
            onClick={() => onOpenDetail({ id: row.id, label: row.label, kind: row.detailKind })}
          >
            {row.label}
          </button>
          <span className="agenda-view__mobile-card-subtitle">{row.subtitle}</span>
          <div className="agenda-view__mobile-card-slots">
            {row.occupiedCount === 0 ? (
              <span className="agenda-view__mobile-state agenda-view__mobile-state--free">Livre no dia</span>
            ) : (
              row.slots
                .filter(slot => slot.state !== "free")
                .map((slot) => (
                  <button
                    key={`${row.id}-${slot.key}-mobile`}
                    type="button"
                    className={`agenda-view__mobile-state agenda-view__mobile-state--${slot.state}`}
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
                    <strong>{`${toHourLabel(slot.slotStart)} - ${toHourLabel(slot.slotEnd)}`}</strong>
                    <span>{getStateLabel(slot.state, slot.tasks.length)}</span>
                  </button>
                ))
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
