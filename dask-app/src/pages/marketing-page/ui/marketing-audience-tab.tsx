import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  EmptyState,
  FormField,
  ModuleTabs,
  ResourceTable,
  Select,
  TextInput
} from "@/shared/ui";
import type { MarketingAudienceContact, MarketingSegment } from "@/modules/marketing";
import {
  SEGMENT_FILTER_FIELDS,
  SEGMENT_FILTER_OPERATORS,
  fmtNum,
  toLocalDate,
  type SegmentFilterRule,
  type SegmentFormState,
  type SegmentPreviewState
} from "./marketing-page.model";

const SEGMENT_KIND_ITEMS: Array<{ id: SegmentFormState["kind"]; label: string }> = [
  { id: "DYNAMIC", label: "Dinamico" },
  { id: "STATIC", label: "Estatico" }
];

interface MarketingAudienceTabProps {
  audience: MarketingAudienceContact[];
  segments: MarketingSegment[];
  audienceSearch: string;
  setAudienceSearch: Dispatch<SetStateAction<string>>;
  segmentForm: SegmentFormState;
  setSegmentForm: Dispatch<SetStateAction<SegmentFormState>>;
  segmentPreview: SegmentPreviewState | null;
  segmentFilterRule: SegmentFilterRule;
  updateSegmentFilterRule: (updates: Partial<SegmentFilterRule>) => void;
  isLoading: boolean;
  isSubmitting: boolean;
  loadData: () => Promise<void>;
  createSegment: () => Promise<void>;
  previewSegment: (segmentId: string) => Promise<void>;
}

export function MarketingAudienceTab({
  audience,
  segments,
  audienceSearch,
  setAudienceSearch,
  segmentForm,
  setSegmentForm,
  segmentPreview,
  segmentFilterRule,
  updateSegmentFilterRule,
  isLoading,
  isSubmitting,
  loadData,
  createSegment,
  previewSegment
}: MarketingAudienceTabProps) {
  return (
              <div className="mkt-workbench">
                <section className="mkt-screen-hero mkt-screen-hero--audience">
                  <div className="mkt-screen-hero__copy">
                    <h2>Audiência de marketing</h2>
                    <p>Construa públicos acionáveis para campanhas e jornadas mantendo o CRM como fonte operacional.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtNum(audience.length)}</strong><span>contatos</span></div>
                    <div><strong>{fmtNum(segments.length)}</strong><span>segmentos</span></div>
                    <div><strong>{segmentPreview ?fmtNum(segmentPreview.estimatedContacts) : "—"}</strong><span>prévia</span></div>
                  </div>
                </section>

                <section className="mkt-audience-grid">
                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Audiência</h3>
                        <p className="marketing-page__hint">Monte públicos para campanhas e jornadas sem misturar esta área com o CRM.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={isLoading || isSubmitting}>
                        Recarregar
                      </Button>
                    </div>

                    <div className="mkt-audience-note">
                      Audiências são grupos de contatos usados em campanhas e jornadas. Leads continuam sendo gerenciados no CRM.
                    </div>

                    <FormField label="Buscar">
                      <TextInput
                        value={audienceSearch}
                        onChange={(event) => setAudienceSearch(event.target.value)}
                        placeholder="Nome, email, empresa..."
                      />
                    </FormField>

                    <ResourceTable
                      data={audience}
                      rowKey={(entry) => entry.lead.id}
                      responsiveMinWidth="920px"
                      emptyState={
                        <EmptyState
                          className="mkt-table-empty"
                          title="Nenhum contato encontrado"
                          description="Conecte leads/clientes ao workspace ou ajuste a busca para criar segmentos de marketing."
                          size="compact"
                        />
                      }
                      columns={[
                        {
                          id: "contact",
                          header: "Contato",
                          width: "1.15fr",
                          render: (entry) => (
                            <div className="marketing-page__stacked">
                              <strong>{entry.lead.fullName ?? "Sem nome"}</strong>
                              <span>{entry.lead.email ?? "-"}</span>
                            </div>
                          )
                        },
                        {
                          id: "company",
                          header: "Empresa",
                          width: "1fr",
                          render: (entry) => entry.lead.companyName ?? "-"
                        },
                        {
                          id: "score",
                          header: "Score",
                          width: "0.5fr",
                          render: (entry) => entry.lead.score
                        },
                        {
                          id: "consent",
                          header: "Consentimento",
                          width: "0.75fr",
                          render: (entry) => entry.preference?.consentStatus ?? "Não informado"
                        },
                        {
                          id: "lastEvent",
                          header: "Último evento",
                          width: "0.9fr",
                          render: (entry) => toLocalDate(entry.lastEventAt)
                        }
                      ]}
                    />
                  </article>

                  <aside className="mkt-analytics__section mkt-segment-builder">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Novo segmento</h3>
                        <p className="marketing-page__hint">Construa a regra em controles simples.</p>
                      </div>
                    </div>

                    <FormField label="Nome">
                      <TextInput value={segmentForm.name} onChange={(event) => setSegmentForm((current) => ({ ...current, name: event.target.value }))} />
                    </FormField>
                    <FormField label="Descrição">
                      <TextInput value={segmentForm.description} onChange={(event) => setSegmentForm((current) => ({ ...current, description: event.target.value }))} />
                    </FormField>

                    <div className="mkt-rule-builder">
                      <Select value={segmentFilterRule.field} onChange={(event) => updateSegmentFilterRule({ field: event.target.value })}>
                        {SEGMENT_FILTER_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                      </Select>
                      <Select value={segmentFilterRule.operator} onChange={(event) => updateSegmentFilterRule({ operator: event.target.value })}>
                        {SEGMENT_FILTER_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                      </Select>
                      <TextInput value={segmentFilterRule.value} onChange={(event) => updateSegmentFilterRule({ value: event.target.value })} />
                    </div>

                    <ModuleTabs
                      value={segmentForm.kind}
                      items={SEGMENT_KIND_ITEMS}
                      onChange={(kind) => setSegmentForm((current) => ({ ...current, kind }))}
                      className="mkt-segment-builder__mode"
                      variant="pill"
                      ariaLabel="Tipo de segmento"
                    />

                    <Button onClick={() => void createSegment()} disabled={isSubmitting}>Criar segmento</Button>

                    <div className="marketing-page__chips">
                      {segments.map((segment) => (
                        <button key={segment.id} type="button" onClick={() => void previewSegment(segment.id)}>
                          {segment.name}
                        </button>
                      ))}
                    </div>

                    {segmentPreview ?(
                      <div className="marketing-page__preview">
                        <h3>{segmentPreview.segmentName}</h3>
                        <p>{segmentPreview.estimatedContacts} contatos estimados</p>
                        <ul>
                          {segmentPreview.sample.slice(0, 8).map((lead) => (
                            <li key={lead.id}>
                              <strong>{lead.fullName ?? "Sem nome"}</strong>
                              <span>{lead.email ?? "-"} · {lead.companyName ?? "-"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </aside>
                </section>
              </div>
  );
}
