import type { Dispatch, SetStateAction } from "react";
import { StatusBadge } from "@/shared/ui";
import type { MarketingAutomationFlow } from "@/modules/marketing";
import { JourneyBuilder } from "../journey-builder";
import type { JourneyEdge, JourneyNode } from "../journey-builder/types";
import { campaignStatusLabel, toLocalDate } from "./marketing-page.model";

interface MarketingJourneysTabProps {
  flows: MarketingAutomationFlow[];
  activeFlowId: string | null;
  setActiveFlowId: Dispatch<SetStateAction<string | null>>;
  handleJourneySave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  handleJourneyActivate: (flowId: string) => Promise<void>;
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
                  <div className="mkt-journey-sidebar__head">
                    <span className="mkt-journey-sidebar__title">Jornadas</span>
                    <span className="mkt-journey-sidebar__count">{flows.length}</span>
                  </div>

                  <button
                    type="button"
                    className={`mkt-journey-card mkt-journey-card--new${activeFlowId === null ? " mkt-journey-card--active" : ""}`}
                    onClick={() => setActiveFlowId(null)}
                  >
                    <strong>Nova jornada</strong>
                    <span>Canvas em branco</span>
                  </button>

                  <div className="mkt-journey-sidebar__list">
                    {flows.length === 0 ?(
                      <div className="mkt-journey-sidebar__empty">
                        <strong>Nenhuma jornada ainda</strong>
                        <span>Configure os blocos no canvas e salve para criar a primeira.</span>
                      </div>
                    ) : null}
                    {flows.map((flow) => {
                      const isActive = flow.id === activeFlowId;
                      return (
                        <button
                          key={flow.id}
                          type="button"
                          className={`mkt-journey-card${isActive ? " mkt-journey-card--active" : ""}`}
                          onClick={() => setActiveFlowId(flow.id)}
                        >
                          <div className="mkt-journey-card__row">
                            <strong>{flow.name}</strong>
                            <StatusBadge tone={flow.status === "ACTIVE" ?"success" : "default"}>{campaignStatusLabel(flow.status)}</StatusBadge>
                          </div>
                          <span>{flow.description ?? "Sem descricao"}</span>
                          <span>{toLocalDate(flow.updatedAt)}</span>
                        </button>
                      );
                    })}
                  </div>
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