import { Link, useNavigate } from "react-router-dom";
import { routePaths } from "@/app/router";
import { useAuth } from "@/features/auth/model";
import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import {
  architectureItems,
  heroBadges,
  heroSignals,
  processStages,
  useCases
} from "./home-page.data";
import type {
  HomeArchitectureItem,
  HomeBadge,
  HomeProcessStage,
  HomeSignal,
  HomeUseCase
} from "./home-page.types";
import "./home-page.css";

type HomeSectionId = "top" | "inteligencia" | "contextos" | "estruturas" | "precos";

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

function WorkflowStep({ stage }: { stage: HomeProcessStage }) {
  return (
    <article className="home-page__workflow-step">
      <span className="home-page__workflow-index">{stage.step}</span>
      <div>
        <h3>{stage.title}</h3>
        <p>{stage.description}</p>
      </div>
    </article>
  );
}

function UseCaseItem({ useCase }: { useCase: HomeUseCase }) {
  return (
    <article className="home-page__use-case-item">
      <h3>{useCase.title}</h3>
      <p>{useCase.focus}</p>
    </article>
  );
}

function ArchitectureItem({ item }: { item: HomeArchitectureItem }) {
  return (
    <article className="home-page__architecture-item">
      <h3>{item.label}</h3>
      <p>{item.detail}</p>
    </article>
  );
}

function PricingSection({ onSubscribeClick }: { onSubscribeClick: (plan: "PERSONAL" | "BUSINESS") => void }) {
  return (
    <section
      className="home-page__section home-page__tab-section home-page__pricing-section"
      id="precos"
      aria-label="Planos e precos"
    >
      <SectionIntro
        eyebrow="Planos"
        title="Simples, direto e sem surpresas."
        description="Escolha o plano que melhor se encaixa na sua operacao. Cobranca mensal recorrente, cancele quando quiser."
      />

      <div className="home-page__pricing-cards">
        <article className="home-page__pricing-card">
          <p className="home-page__pricing-plan-name">Pessoal</p>
          <div className="home-page__pricing-price">
            <strong>R$ 19,90</strong>
            <span>/mes</span>
          </div>
          <p className="home-page__pricing-description">Para uso individual com boards, IA e automacoes basicas.</p>
          <ul className="home-page__pricing-features">
            {["1 workspace pessoal", "Boards, listas e timeline", "IA para melhorias", "Automacoes basicas", "Busca semantica"].map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <button
            className="home-page__action home-page__action--secondary home-page__pricing-btn"
            onClick={() => onSubscribeClick("PERSONAL")}
            type="button"
          >
            Assinar Pessoal
          </button>
        </article>

        <article className="home-page__pricing-card home-page__pricing-card--featured">
          <span className="home-page__pricing-badge">Popular</span>
          <p className="home-page__pricing-plan-name">Business</p>
          <div className="home-page__pricing-price">
            <strong>R$ 99,00</strong>
            <span>/mes</span>
          </div>
          <p className="home-page__pricing-description">Para equipes e operacoes corporativas com recursos avancados.</p>
          <ul className="home-page__pricing-features">
            {[
              "Multiplos workspaces",
              "Suporte a equipes",
              "Boards, listas e timeline",
              "IA avancada e automacoes",
              "Campos personalizados",
              "Auditoria e integracoes",
              "Suporte prioritario"
            ].map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <button
            className="home-page__action home-page__action--primary home-page__pricing-btn"
            onClick={() => onSubscribeClick("BUSINESS")}
            type="button"
          >
            Assinar Business
          </button>
        </article>
      </div>
    </section>
  );
}

function HomeHeroView({ onExploreClick }: { onExploreClick: () => void }) {
  return (
    <section className="home-page__hero" id="top" aria-label="Tela inicial da plataforma">
      <div className="home-page__hero-copy">
        <img className="home-page__logo" src={daskLogoFull} alt="Logo Dask" />
        <p className="home-page__eyebrow">Plataforma operacional inteligente</p>
        <h1 className="home-page__title">Operacao inteligente com IA continua.</h1>
        <p className="home-page__description">
          O Dask organiza processos, conecta contexto e distribui inteligencia ao longo da operacao com uma estrutura
          flexivel e clara.
        </p>

        <div className="home-page__actions">
          <Link className="home-page__action home-page__action--primary" to={routePaths.login}>
            Entrar na plataforma
          </Link>
          <button
            className="home-page__action home-page__action--secondary"
            type="button"
            onClick={onExploreClick}
          >
            Explorar a plataforma
          </button>
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
            Uma plataforma configuravel para software, operacoes administrativas, escola, suporte, projetos e outros
            fluxos que exigem clareza e inteligencia no processo.
          </p>
        </div>

        <div className="home-page__hero-signal-list" aria-label="Sinais de valor do produto">
          {heroSignals.map((signal) => (
            <SignalCard key={signal.label} signal={signal} />
          ))}
        </div>
      </aside>
    </section>
  );
}

function IntelligenceView() {
  return (
    <section
      id="inteligencia"
      className="home-page__section home-page__tab-section home-page__workflow-section"
      aria-label="Como funciona"
    >
      <div className="home-page__workflow-copy">
        <SectionIntro
          eyebrow="Como funciona"
          title="Do registro inicial a evolucao do processo."
          description="A plataforma acompanha o fluxo real: organiza a entrada, adiciona contexto, recupera conhecimento e melhora a execucao com continuidade."
        />
      </div>

      <div className="home-page__workflow-panel" aria-label="Fluxo de trabalho no Dask">
        {processStages.map((stage) => (
          <WorkflowStep key={stage.step} stage={stage} />
        ))}
      </div>
    </section>
  );
}

function AdaptabilityView() {
  return (
    <section
      id="contextos"
      className="home-page__section home-page__tab-section home-page__adaptability-section"
      aria-label="Adaptabilidade"
    >
      <SectionIntro
        eyebrow="Adaptabilidade"
        title="A mesma base para contextos diferentes."
        description="Software, administrativo, qualidade, suporte e escola podem operar com a mesma logica de clareza, busca e inteligencia aplicada."
      />

      <div className="home-page__context-map" aria-label="Contextos de aplicacao">
        {useCases.map((useCase) => (
          <UseCaseItem key={useCase.title} useCase={useCase} />
        ))}
      </div>

      <aside className="home-page__adaptability-note" aria-label="Resumo de adaptabilidade">
        <p>Escala sem fragmentar a experiencia.</p>
        <strong>Um produto consistente para operacoes com linguagens diferentes.</strong>
      </aside>
    </section>
  );
}

function StructureView() {
  return (
    <section
      id="estruturas"
      className="home-page__section home-page__tab-section home-page__architecture-section"
      aria-label="Estrutura configuravel"
    >
      <SectionIntro
        eyebrow="Arquitetura configuravel"
        title="Flexibilidade estrutural com leitura simples."
        description="A configuracao aparece como uma base estrategica: suficiente para adaptar processos, sem transformar a experiencia em uma tela tecnica demais."
      />

      <div className="home-page__architecture-grid">
        <div className="home-page__architecture-list" aria-label="Elementos configuraveis">
          {architectureItems.map((item) => (
            <ArchitectureItem key={item.label} item={item} />
          ))}
        </div>

        <aside className="home-page__architecture-preview" aria-label="Resumo da configuracao">
          <p className="home-page__architecture-preview-eyebrow">Modelo operacional</p>
          <h3>Configurar, operar, aprender e replicar.</h3>
          <p>Workspaces e templates mantem o padrao. Campos, views e regras absorvem a particularidade de cada fluxo.</p>
        </aside>
      </div>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function handleSubscribeClick(_plan: "PERSONAL" | "BUSINESS") {
    if (isAuthenticated) {
      navigate(routePaths.choosePlan);
    } else {
      navigate(routePaths.login, { state: { from: { pathname: routePaths.choosePlan } } });
    }
  }

  function selectSection(sectionId: HomeSectionId) {
    navigate(sectionId === "top" ? routePaths.home : `${routePaths.home}#${sectionId}`);
  }

  return (
    <main className="home-page">
      <div className="home-page__container">
        <div className="home-page__view">
          <HomeHeroView onExploreClick={() => selectSection("inteligencia")} />
        </div>
        <div className="home-page__view">
          <IntelligenceView />
        </div>
        <div className="home-page__view">
          <AdaptabilityView />
        </div>
        <div className="home-page__view">
          <StructureView />
        </div>
        <div className="home-page__view">
          <PricingSection onSubscribeClick={handleSubscribeClick} />
        </div>
      </div>
    </main>
  );
}
