import type { Dispatch, SetStateAction } from "react";
import { EmptyState, PanelMenu, PanelMenuItem, StatusBadge } from "@/shared/ui";
import type { MarketingAutomationFlow } from "@/modules/marketing";
import { JourneyBuilder } from "../journey-builder";
import type { JourneyEdge, JourneyNode } from "../journey-builder/types";
import { campaignStatusLabel, toLocalDate } from "./marketing-page.model";

interface MarketingJourneysTabProps {
  flows: MarketingAutomationFlow[];
  activeFlowId: string | null;
  setActiveFlowId: Dispatch<SetStateAction<string | null>>;
  handleJourneySave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  handleJourneyActivate: (flowId: string, name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  handleJourneyDeactivate: (flowId: string) => Promise<void>;
  isSavingFlow: boolean;
}

export function MarketingJourneysTab({
  flows,
  activeFlowId,
  setActiveFlowId,
  handleJourneySave,
  handleJourneyActivate,
  handleJourneyDeactivate,
  isSavingFlow
}: MarketingJourneysTabProps) {
  return (
    <div className="mkt-journey-editor">
      <aside className="mkt-journey-sidebar">
        <PanelMenu
          title="Jornadas"
          count={flows.length}
        >
          <PanelMenuItem
            selected={activeFlowId === null}
            onClick={() => setActiveFlowId(null)}
            label="Nova jornada"
            description="Canvas em branco"
            className="mkt-journey-new-item"
          />

          {flows.length === 0 ? (
            <EmptyState
              title="Nenhuma jornada ainda"
              description="Configure os blocos no canvas e salve para criar a primeira."
              size="compact"
            />
          ) : null}

          {flows.map((flow) => (
            <PanelMenuItem
              key={flow.id}
              selected={flow.id === activeFlowId}
              onClick={() => setActiveFlowId(flow.id)}
              label={flow.name}
              trailing={
                <StatusBadge tone={flow.status === "ACTIVE" ? "success" : "default"}>
                  {campaignStatusLabel(flow.status)}
                </StatusBadge>
              }
            />
          ))}
        </PanelMenu>
      </aside>

      <div className="mkt-journey-editor__canvas">
        <JourneyBuilder
          key={activeFlowId ?? "new"}
          flow={flows.find((f) => f.id === activeFlowId) ?? null}
          onSave={handleJourneySave}
          onActivate={handleJourneyActivate}
          onDeactivate={handleJourneyDeactivate}
          isSaving={isSavingFlow}
        />
      </div>
    </div>
  );
}
