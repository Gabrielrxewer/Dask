import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MarketingTemplate, MarketingTemplateFormValues, SendMarketingTemplateTestEmailValues } from "@/modules/marketing";
import { AppDialog, Button, EmptyState, ModuleTabs } from "@/shared/ui";
import {
  TEMPLATE_GOAL_FILTERS,
  fmtNum
} from "./marketing-page.model";
import { EmailTemplateEditor } from "./email-template-editor";
import { EmailTemplatePreview } from "./email-template-preview";
import { EmailTemplateTestDialog } from "./email-template-test-dialog";

interface MarketingTemplatesTabProps {
  templates: MarketingTemplate[];
  filteredTemplates: MarketingTemplate[];
  templateGoalFilter: (typeof TEMPLATE_GOAL_FILTERS)[number];
  setTemplateGoalFilter: Dispatch<SetStateAction<(typeof TEMPLATE_GOAL_FILTERS)[number]>>;
  isSubmitting: boolean;
  createTemplate: (values?: MarketingTemplateFormValues) => Promise<void>;
  updateTemplate: (templateId: string, values: MarketingTemplateFormValues) => Promise<void>;
  duplicateTemplate: (template: MarketingTemplate) => Promise<void>;
  archiveTemplate: (templateId: string) => Promise<void>;
  sendTemplateTest: (templateId: string, values: SendMarketingTemplateTestEmailValues) => Promise<void>;
}

export function MarketingTemplatesTab({
  templates,
  filteredTemplates,
  templateGoalFilter,
  setTemplateGoalFilter,
  isSubmitting,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  archiveTemplate,
  sendTemplateTest
}: MarketingTemplatesTabProps) {
  const [previewTemplate, setPreviewTemplate] = useState<MarketingTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MarketingTemplate | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<MarketingTemplate | null>(null);

  return (
              <div className="mkt-workbench">
                <section className="mkt-screen-hero mkt-screen-hero--templates">
                  <div className="mkt-screen-hero__copy">
                    <h2>Biblioteca de templates</h2>
                    <p>Modelos reutilizaveis para acelerar campanhas e manter consistencia de tom, objetivo e estagio do funil.</p>
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
                        <p className="marketing-page__hint">Salve assunto, corpo e HTML opcional para reutilizar no builder.</p>
                      </div>
                    </div>

                    <EmailTemplateEditor
                      isSubmitting={isSubmitting}
                      onSubmit={createTemplate}
                    />
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
                        <article
                          key={template.id}
                          className={`mkt-template-card${template.isArchived ? " mkt-template-card--archived" : ""}`}
                        >
                          <span className="mkt-template-card__meta">{template.category ?? "geral"} - {template.funnelStage ?? "sem estagio"}</span>
                          <strong>{template.name}</strong>
                          <p>{template.subject}</p>
                          <span className="mkt-template-card__actions">
                            <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)}>
                              Visualizar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingTemplate(template)}>
                              Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTestingTemplate(template)}>
                              Enviar teste
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void duplicateTemplate(template)} disabled={isSubmitting}>
                              Duplicar
                            </Button>
                            {!template.isArchived ? (
                              <Button size="sm" variant="ghost" onClick={() => void archiveTemplate(template.id)} disabled={isSubmitting}>
                                Arquivar
                              </Button>
                            ) : null}
                          </span>
                        </article>
                      ))}
                    </div>
                  </article>
                </section>

                <AppDialog
                  open={Boolean(previewTemplate)}
                  onOpenChange={(open) => {
                    if (!open) setPreviewTemplate(null);
                  }}
                  title={previewTemplate?.name ?? "Preview de template"}
                  description={previewTemplate?.subject}
                  contentClassName="mkt-template-dialog"
                >
                  {previewTemplate ? (
                    <EmailTemplatePreview
                      subject={previewTemplate.subject}
                      bodyMarkdown={previewTemplate.bodyMarkdown}
                      bodyHtml={previewTemplate.bodyHtml}
                    />
                  ) : null}
                </AppDialog>

                <AppDialog
                  open={Boolean(editingTemplate)}
                  onOpenChange={(open) => {
                    if (!open) setEditingTemplate(null);
                  }}
                  title={editingTemplate ? `Editar ${editingTemplate.name}` : "Editar template"}
                  contentClassName="mkt-template-dialog mkt-template-dialog--editor"
                >
                  {editingTemplate ? (
                    <EmailTemplateEditor
                      template={editingTemplate}
                      submitLabel="Salvar alteracoes"
                      isSubmitting={isSubmitting}
                      onCancel={() => setEditingTemplate(null)}
                      onSubmit={async (values) => {
                        await updateTemplate(editingTemplate.id, values);
                        setEditingTemplate(null);
                      }}
                    />
                  ) : null}
                </AppDialog>

                <EmailTemplateTestDialog
                  open={Boolean(testingTemplate)}
                  template={testingTemplate}
                  isSubmitting={isSubmitting}
                  onOpenChange={(open) => {
                    if (!open) setTestingTemplate(null);
                  }}
                  onSubmit={sendTemplateTest}
                />
              </div>
  );
}
