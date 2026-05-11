import type { Dispatch, SetStateAction } from "react";
import { type Control, type FieldErrors } from "react-hook-form";
import {
  AppFormField,
  AppFormError,
  AppFormGrid,
  AppSelectField,
  AppTextField,
  Button,
  EmptyState,
  FormField,
  AppSelect,
  ResourceTable,
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

const SEGMENT_KIND_ITEMS: Array<{ value: SegmentFormState["kind"]; label: string }> = [
  { value: "DYNAMIC", label: "Dinamico" },
  { value: "STATIC", label: "Estatico" }
];

interface MarketingAudienceTabProps {
  audience: MarketingAudienceContact[];
  segments: MarketingSegment[];
  audienceSearch: string;
  setAudienceSearch: Dispatch<SetStateAction<string>>;
  segmentFormControl: Control<SegmentFormState>;
  segmentFormErrors: FieldErrors<SegmentFormState>;
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
  segmentFormControl,
  segmentFormErrors,
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

                    <AppTextField control={segmentFormControl} name="name" label="Nome" />
                    <AppTextField control={segmentFormControl} name="description" label="Descricao" />

                    <AppFormField label="Regra">
                      <AppFormGrid className="mkt-rule-builder" columns={3}>
                        <AppSelect
                          value={segmentFilterRule.field}
                          onValueChange={(value) => updateSegmentFilterRule({ field: value })}
                          aria-label="Campo do filtro"
                          items={SEGMENT_FILTER_FIELDS.map((field) => ({ value: field.value, label: field.label }))}
                        />
                        <AppSelect
                          value={segmentFilterRule.operator}
                          onValueChange={(value) => updateSegmentFilterRule({ operator: value })}
                          aria-label="Operador do filtro"
                          items={SEGMENT_FILTER_OPERATORS.map((operator) => ({ value: operator.value, label: operator.label }))}
                        />
                        <TextInput value={segmentFilterRule.value} onChange={(event) => updateSegmentFilterRule({ value: event.target.value })} />
                      </AppFormGrid>
                    </AppFormField>

                    <AppSelectField<SegmentFormState, "kind", SegmentFormState["kind"]>
                      control={segmentFormControl}
                      name="kind"
                      label="Tipo de segmento"
                      className="mkt-segment-builder__mode"
                      options={SEGMENT_KIND_ITEMS}
                    />
                    <AppFormError>{segmentFormErrors.filtersText?.message}</AppFormError>
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
