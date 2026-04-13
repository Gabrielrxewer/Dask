import { type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import {
  focusPanel,
  heroBadges,
  heroSignals,
  platformFeatures,
  previewLanes,
  processStages,
  searchLenses,
  structureLayers,
  useCases
} from "./home-page.data";
import type {
  HomeBadge,
  HomeFeature,
  HomePreviewLane,
  HomeProcessStage,
  HomeSearchLens,
  HomeSignal,
  HomeStructureLayer,
  HomeUseCase
} from "./home-page.types";
import "./home-page.css";

function SectionIntro({
  id,
  eyebrow,
  title,
  description
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header id={id} className="home-page__section-intro">
      <p className="home-page__section-eyebrow">{eyebrow}</p>
      <h2 className="home-page__section-title">{title}</h2>
      <p className="home-page__section-description">{description}</p>
    </header>
  );
}

function Badge({ badge }: { badge: HomeBadge }) {
  return <span className={`home-page__badge home-page__badge--${badge.tone ?? "default"}`}>{badge.label}</span>;
}

function SignalCard({ signal }: { signal: HomeSignal }) {
  return (
    <article className="home-page__signal-card">
      <p className="home-page__signal-label">{signal.label}</p>
      <strong className="home-page__signal-value">{signal.value}</strong>
      <p className="home-page__signal-description">{signal.description}</p>
    </article>
  );
}

function PreviewLane({ lane }: { lane: HomePreviewLane }) {
  return (
    <section className={`home-page__preview-lane home-page__preview-lane--${lane.tone}`} aria-label={lane.title}>
      <header className="home-page__preview-lane-head">
        <div>
          <p className="home-page__preview-lane-title">{lane.title}</p>
          <p className="home-page__preview-lane-description">{lane.description}</p>
        </div>
        <span className="home-page__preview-lane-count">{lane.count}</span>
      </header>

      <div className="home-page__preview-card-list">
        {lane.items.map((item) => (
          <article key={item} className="home-page__preview-card">
            <span className="home-page__preview-card-status" aria-hidden="true" />
            <div>
              <strong>{item}</strong>
              <span>Fluxo apoiado por IA e estrutura configuravel.</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: HomeFeature }) {
  return (
    <article className="home-page__feature-card">
      <p className="home-page__feature-eyebrow">{feature.eyebrow}</p>
      <h3 className="home-page__feature-title">{feature.title}</h3>
      <p className="home-page__feature-description">{feature.description}</p>
      <div className="home-page__feature-highlights" aria-label="Destaques">
        {feature.highlights.map((highlight) => (
          <span key={highlight}>{highlight}</span>
        ))}
      </div>
    </article>
  );
}

function ProcessStage({ stage }: { stage: HomeProcessStage }) {
  return (
    <article className="home-page__stage-card">
      <div className="home-page__stage-step">{stage.step}</div>
      <div className="home-page__stage-body">
        <h3>{stage.title}</h3>
        <p>{stage.description}</p>
        <small>{stage.note}</small>
      </div>
    </article>
  );
}

function SearchLensCard({ lens }: { lens: HomeSearchLens }) {
  return (
    <article className="home-page__search-card">
      <header className="home-page__search-card-head">
        <span>{lens.label}</span>
        <small>Semantico</small>
      </header>
      <div className="home-page__search-query">{lens.query}</div>
      <p className="home-page__search-context">{lens.context}</p>
      <div className="home-page__search-results">
        {lens.results.map((result) => (
          <div key={result} className="home-page__search-result">
            {result}
          </div>
        ))}
      </div>
    </article>
  );
}

function StructureLayerCard({ layer }: { layer: HomeStructureLayer }) {
  return (
    <article className="home-page__layer-card">
      <p className="home-page__layer-label">{layer.label}</p>
      <h3>{layer.title}</h3>
      <p>{layer.description}</p>
    </article>
  );
}

function UseCaseCard({ useCase }: { useCase: HomeUseCase }) {
  return (
    <article className="home-page__use-case-card">
      <h3>{useCase.title}</h3>
      <p>{useCase.description}</p>
      <strong>{useCase.outcome}</strong>
    </article>
  );
}

export function HomePage() {
  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    event.preventDefault();

    const container = event.currentTarget.closest(".global-layout__main");
    const target = document.getElementById(targetId);
    if (!(container instanceof HTMLElement) || !target) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = targetRect.top - containerRect.top + container.scrollTop - 4;

    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "smooth"
    });
  };

  return (
    <main id="top" className="home-page">
      <div className="home-page__container">
        <section className="home-page__hero" aria-label="Tela inicial da plataforma">
          <div className="home-page__hero-copy">
            <img className="home-page__logo" src={daskLogoFull} alt="Logo Dask" />
            <p className="home-page__eyebrow">Plataforma operacional inteligente</p>
            <h1 className="home-page__title">Operacao inteligente com IA continua.</h1>
            <p className="home-page__description">
              O Dask organiza processos, conecta contexto e distribui inteligencia ao longo da operacao com uma
              estrutura flexivel e clara.
            </p>

            <div className="home-page__actions">
              <Link className="home-page__action home-page__action--primary" to={routePaths.login}>
                Entrar na plataforma
              </Link>
              <a
                className="home-page__action home-page__action--secondary"
                href="#plataforma"
                onClick={(event) => scrollToSection(event, "plataforma")}
              >
                Explorar a plataforma
              </a>
            </div>
          </div>

          <aside className="home-page__hero-side" aria-label="Resumo do produto">
            <div className="home-page__hero-side-head">
              <div className="home-page__badge-row" aria-label="Capacidades principais do Dask">
                {heroBadges.map((badge) => (
                  <Badge key={badge.label} badge={badge} />
                ))}
              </div>
              <p className="home-page__hero-side-summary">
                Uma plataforma configuravel para software, operacoes administrativas, escola, suporte, projetos e
                outros fluxos que exigem clareza e inteligencia no processo.
              </p>
            </div>

            <div className="home-page__hero-signal-list" aria-label="Sinais de valor do produto">
              {heroSignals.map((signal) => (
                <SignalCard key={signal.label} signal={signal} />
              ))}
            </div>
          </aside>
        </section>

        <section className="home-page__section home-page__section--preview" aria-label="Preview estilizado do produto">
          <div className="home-page__hero-preview" aria-label="Preview estilizado do produto">
            <div className="home-page__preview-shell">
              <header className="home-page__preview-topbar">
                <div className="home-page__preview-orbs" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="home-page__preview-topbar-content">
                  <div className="home-page__preview-title-group">
                    <strong>Dask Workspace</strong>
                    <span>Operacao com IA distribuida, busca e templates</span>
                  </div>
                  <div className="home-page__preview-toolbar">
                    <span className="home-page__preview-pill">IA ativa</span>
                    <span className="home-page__preview-pill">Busca semantica</span>
                  </div>
                </div>
              </header>

              <div className="home-page__preview-layout">
                <aside className="home-page__preview-sidebar" aria-label="Navegacao do produto">
                  <span className="home-page__preview-sidebar-label">Workspace</span>
                  <strong>Operacao central</strong>
                  <div className="home-page__preview-sidebar-nav">
                    <span className="is-active">Boards</span>
                    <span>Templates</span>
                    <span>Busca</span>
                    <span>Automacoes</span>
                  </div>
                </aside>

                <div className="home-page__preview-stage">
                  <div className="home-page__preview-command-bar">
                    <span>Buscar por contexto, risco, etapa ou template</span>
                    <div className="home-page__preview-command-meta">
                      <span>12 fontes cruzadas</span>
                      <span>4 sugestoes</span>
                    </div>
                  </div>

                  <div className="home-page__preview-stage-content">
                    <div className="home-page__preview-board">
                      {previewLanes.map((lane) => (
                        <PreviewLane key={lane.title} lane={lane} />
                      ))}
                    </div>

                    <aside className="home-page__preview-assistant" aria-label="Painel de IA">
                      <p className="home-page__preview-assistant-eyebrow">{focusPanel.eyebrow}</p>
                      <h2 className="home-page__preview-assistant-title">{focusPanel.status}</h2>
                      <p className="home-page__preview-assistant-summary">{focusPanel.summary}</p>

                      <div className="home-page__preview-assistant-tags">
                        {focusPanel.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      <div className="home-page__preview-assistant-metrics">
                        {focusPanel.metrics.map((metric) => (
                          <div key={metric.label}>
                            <strong>{metric.value}</strong>
                            <span>{metric.label}</span>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-page__section">
          <SectionIntro
            id="plataforma"
            eyebrow="Plataforma"
            title="Nao e apenas um board. E uma camada operacional inteligente com presenca de produto real."
            description="O Dask une experiencia premium, IA continua e flexibilidade estrutural em uma interface que comunica confianca logo no primeiro contato."
          />

          <div className="home-page__feature-grid">
            {platformFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </section>

        <section className="home-page__section home-page__section--immersive">
          <div className="home-page__immersive-shell">
            <div className="home-page__immersive-copy">
              <SectionIntro
                id="inteligencia"
                eyebrow="IA ao longo do processo"
                title="O Dask distribui inteligencia em cada etapa da operacao."
                description="Em vez de depender de consultas isoladas, a plataforma leva IA para o ponto em que o trabalho acontece e combina isso com busca semantica, historico e estrutura."
              />

              <div className="home-page__stage-list">
                {processStages.map((stage) => (
                  <ProcessStage key={stage.step} stage={stage} />
                ))}
              </div>
            </div>

            <div className="home-page__immersive-panels">
              <article className="home-page__focus-card">
                <p className="home-page__focus-eyebrow">{focusPanel.eyebrow}</p>
                <h3 className="home-page__focus-title">{focusPanel.title}</h3>
                <p className="home-page__focus-summary">{focusPanel.summary}</p>

                <div className="home-page__focus-tag-row">
                  {focusPanel.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="home-page__focus-metrics">
                  {focusPanel.metrics.map((metric) => (
                    <div key={metric.label} className="home-page__focus-metric">
                      <strong>{metric.value}</strong>
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>

                <div className="home-page__focus-insights">
                  {focusPanel.insights.map((insight) => (
                    <p key={insight}>{insight}</p>
                  ))}
                </div>
              </article>

              <div className="home-page__search-stack">
                {searchLenses.map((lens) => (
                  <SearchLensCard key={lens.label} lens={lens} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-page__section">
          <SectionIntro
            id="estruturas"
            eyebrow="Estruturas adaptaveis"
            title="Configuravel para diferentes operacoes, sem perder clareza, padrao e acabamento."
            description="A base do Dask permite partir de software e evoluir para novos contextos com um produto consistente, elegante e pronto para operacoes serias."
          />

          <div className="home-page__layers-panel">
            <div className="home-page__layers-head">
              <p>Arquitetura configuravel</p>
              <strong>Camadas que se ajustam ao negocio.</strong>
            </div>

            <div className="home-page__layers-list">
              {structureLayers.map((layer) => (
                <StructureLayerCard key={layer.title} layer={layer} />
              ))}
            </div>
          </div>
        </section>

        <section className="home-page__section">
          <SectionIntro
            id="contextos"
            eyebrow="Contextos"
            title="A plataforma se adapta a cenarios diferentes sem perder consistencia de produto."
            description="O Dask pode nascer em software e operar com o mesmo nivel de clareza em administrativo, qualidade, suporte, projetos e outros fluxos internos."
          />

          <div className="home-page__contexts-panel">
            <div className="home-page__contexts-head">
              <p className="home-page__contexts-anchor">Aplicacao em multiplos cenarios</p>
              <strong>Software e muito alem dele.</strong>
            </div>

            <div className="home-page__use-case-grid">
              {useCases.map((useCase) => (
                <UseCaseCard key={useCase.title} useCase={useCase} />
              ))}
            </div>

            <div className="home-page__context-chip-row" aria-label="Contextos adicionais">
              {["Projetos", "Suporte interno", "PMO", "Operacoes escolares", "Compliance", "Qualidade"].map(
                (context) => (
                  <span key={context}>{context}</span>
                )
              )}
            </div>
          </div>
        </section>

        <section className="home-page__section">
          <div className="home-page__cta-shell">
            <div className="home-page__cta-copy">
              <p className="home-page__section-eyebrow">Entrada do sistema</p>
              <h2 className="home-page__cta-title">
                Uma Home com presenca de produto, valor claro e espaco para operacoes inteligentes crescerem.
              </h2>
              <p className="home-page__cta-description">
                Entre no Dask e veja uma plataforma pronta para organizar processos, distribuir inteligencia e elevar
                a percepcao de valor do sistema desde a primeira tela.
              </p>
            </div>

            <div className="home-page__cta-actions">
              <Link className="home-page__action home-page__action--primary" to={routePaths.login}>
                Entrar na plataforma
              </Link>
              <a
                className="home-page__action home-page__action--secondary"
                href="#top"
                onClick={(event) => scrollToSection(event, "top")}
              >
                Voltar ao topo
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
