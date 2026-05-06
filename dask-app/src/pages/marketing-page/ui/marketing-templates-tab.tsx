import type { Dispatch, SetStateAction } from "react";
import { Button, EmptyState, FormField, ModuleTabs, Select, Textarea, TextInput } from "@/shared/ui";
import type { MarketingTemplate } from "@/modules/marketing";
import {
  OBJECTIVE_OPTIONS,
  TEMPLATE_GOAL_FILTERS,
  fmtNum,
  type TemplateFormState
} from "./marketing-page.model";

interface MarketingTemplatesTabProps {
  templates: MarketingTemplate[];
  filteredTemplates: MarketingTemplate[];
  templateGoalFilter: (typeof TEMPLATE_GOAL_FILTERS)[number];
  setTemplateGoalFilter: Dispatch<SetStateAction<(typeof TEMPLATE_GOAL_FILTERS)[number]>>;
  templateForm: TemplateFormState;
  setTemplateForm: Dispatch<SetStateAction<TemplateFormState>>;
  isSubmitting: boolean;
  createTemplate: () => Promise<void>;
}

export function MarketingTemplatesTab({
  templates,
  filteredTemplates,
  templateGoalFilter,
  setTemplateGoalFilter,
  templateForm,
  setTemplateForm,
  isSubmitting,
  createTemplate
}: MarketingTemplatesTabProps) {
  return (
              <div className="mkt-workbench">
                <section className="mkt-screen-hero mkt-screen-hero--templates">
                  <div className="mkt-screen-hero__copy">
                    <h2>Biblioteca de templates</h2>
                    <p>Modelos reutilizáveis para acelerar campanhas e manter consistência de tom, objetivo e estágio do funil.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtNum(templates.length)}</strong><span>templates</span></div>
                    <div><strong>{TEMPLATE_GOAL_FILTERS.length - 1}</strong><span>objetivos</span></div>
                    <div><strong>{filteredTemplates.length}</strong><span>no filtro</span></div>
                  </div>
                </section>

                <section className="mkt-split">
                  <article className="mkt-analytics__section mkt-composer">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Novo template</h3>
                        <p className="marketing-page__hint">Salve assunto e corpo para reutilizar no builder.</p>
                      </div>
                    </div>

                    <FormField label="Nome">
                      <TextInput value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
                    </FormField>
                    <div className="marketing-page__grid">
                      <FormField label="Categoria">
                        <TextInput value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))} />
                      </FormField>
                      <FormField label="Estágio">
                        <TextInput value={templateForm.funnelStage} onChange={(event) => setTemplateForm((current) => ({ ...current, funnelStage: event.target.value }))} />
                      </FormField>
                    </div>
                    <FormField label="Objetivo">
                      <Select value={templateForm.objective} onChange={(event) => setTemplateForm((current) => ({ ...current, objective: event.target.value }))}>
                        {OBJECTIVE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Assunto">
                      <TextInput value={templateForm.subject} onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))} />
                    </FormField>
                    <FormField label="Corpo">
                      <Textarea rows={9} value={templateForm.bodyMarkdown} onChange={(event) => setTemplateForm((current) => ({ ...current, bodyMarkdown: event.target.value }))} />
                    </FormField>
                    <Button onClick={() => void createTemplate()} disabled={isSubmitting}>Salvar template</Button>
                  </article>

                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Biblioteca</h3>
                        <p className="marketing-page__hint">{templates.length} modelos cadastrados para acelerar campanhas e jornadas.</p>
                      </div>
                    </div>

                    <ModuleTabs
                      value={templateGoalFilter}
                      items={TEMPLATE_GOAL_FILTERS.map((goal) => ({ id: goal, label: goal }))}
                      onChange={setTemplateGoalFilter}
                      className="mkt-template-filters"
                      variant="pill"
                      ariaLabel="Filtrar templates por objetivo"
                    />

                    <div className="mkt-template-grid">
                      {filteredTemplates.length === 0 ?(
                        <EmptyState
                          className="mkt-empty-inline"
                          title="Nenhum template"
                          description="Crie o primeiro modelo ou ajuste o filtro selecionado."
                          size="compact"
                        />
                      ) : null}
                      {filteredTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className="mkt-template-card"
                          onClick={() => setTemplateForm({
                            name: template.name,
                            category: template.category ?? "newsletter",
                            objective: template.objective ?? "LEAD_NURTURE",
                            funnelStage: template.funnelStage ?? "mql",
                            subject: template.subject,
                            bodyMarkdown: template.bodyMarkdown
                          })}
                        >
                          <span className="mkt-template-card__meta">{template.category ?? "geral"} · {template.funnelStage ?? "sem estágio"}</span>
                          <strong>{template.name}</strong>
                          <p>{template.subject}</p>
                          <span className="mkt-template-card__actions">
                            <span>Usar</span>
                            <span>Visualizar</span>
                            <span>Duplicar</span>
                            <span>Editar</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                </section>
              </div>
  );
}
