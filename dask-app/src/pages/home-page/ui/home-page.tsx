import { Link, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/app/router";
import { useAuth } from "@/features/auth/model";
import { cn } from "@/shared/lib/cn";
import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import {
  architectureItems,
  heroBadges,
  heroSignals,
  processStages,
  useCases,
  valuePillars
} from "./home-page.data";
import type {
  HomeArchitectureItem,
  HomeBadge,
  HomeProcessStage,
  HomeSignal,
  HomeUseCase,
  HomeValuePillar
} from "./home-page.types";
import "./home-page.css";

type HomeSectionId = "top" | "valor" | "inteligencia" | "contextos" | "estruturas" | "precos";
const homeSectionIds = new Set<HomeSectionId>(["top", "valor", "inteligencia", "contextos", "estruturas", "precos"]);

function getHomeSectionFromHash(hash: string): HomeSectionId {
  const sectionId = hash.replace("#", "") as HomeSectionId;
  return homeSectionIds.has(sectionId) ? sectionId : "top";
}

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

function ValuePillarCard({ pillar, index }: { pillar: HomeValuePillar; index: number }) {
  return (
    <article className="home-page__pillar">
      <span className="home-page__pillar-number">{String(index + 1).padStart(2, "0")}</span>
      <p className="home-page__pillar-eyebrow">{pillar.eyebrow}</p>
      <h3>{pillar.title}</h3>
      <p>{pillar.description}</p>
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

function HomeHeroView({
  isAuthenticated,
  onExploreClick,
  isActive
}: {
  isAuthenticated: boolean;
  onExploreClick: () => void;
  isActive: boolean;
}) {
  const privateEntryPath = isAuthenticated ? routePaths.workspaceEntry : routePaths.login;

  return (
    <section
      className={cn("home-page__hero", isActive && "home-page__hero--active")}
      id="top"
      aria-label="Tela inicial da plataforma"
    >
      <div className="home-page__hero-copy">
        <img className="home-page__logo" src={daskLogoFull} alt="Logo Dask" />
        <p className="home-page__eyebrow">Plataforma operacional para software houses e startups</p>
        <h1 className="home-page__title">Seu processo inteiro, no mesmo sistema.</h1>
        <p className="home-page__description">
          Do lead ao faturamento, o Dask conecta comercial, escopo, documentacao, execucao, agenda e cobranca no
          mesmo contexto. A IA acompanha essa jornada inteira, sem transformar sua operacao em ilhas de ferramenta.
        </p>

        <div className="home-page__actions">
          <Link className="home-page__action home-page__action--primary" to={privateEntryPath}>
            {isAuthenticated ? "Abrir operacao" : "Entrar no Dask"}
          </Link>
          <button
            className="home-page__action home-page__action--secondary"
            type="button"
            onClick={onExploreClick}
          >
            Ver o fluxo completo
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
            Nao e so mais um board com IA. O Dask foi pensado para operacoes de software que precisam vender,
            documentar, executar, acompanhar e faturar sem reescrever o mesmo trabalho em varias ferramentas.
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

function ValueSectionView({ isActive }: { isActive: boolean }) {
  return (
    <section
      id="valor"
      className={cn("home-page__section home-page__tab-section home-page__value-section", isActive && "home-page__section--active")}
      aria-label="Proposta de valor"
    >
      <SectionIntro
        eyebrow="Por que Dask"
        title="Continuidade operacional, sem fragmentacao."
        description="O mesmo contexto segue do comercial a entrega e ao faturamento. Menos retrabalho, mais clareza e uma operacao mais fluida para times de software."
      />

      <div className="home-page__pillar-grid" aria-label="Beneficios centrais do Dask">
        {valuePillars.map((pillar, index) => (
          <ValuePillarCard key={pillar.title} pillar={pillar} index={index} />
        ))}
      </div>
    </section>
  );
}

function IntelligenceView({ isActive }: { isActive: boolean }) {
  return (
    <section
      id="inteligencia"
      className={cn("home-page__section home-page__tab-section home-page__workflow-section", isActive && "home-page__section--active")}
      aria-label="Como funciona"
    >
      <div className="home-page__workflow-copy">
        <SectionIntro
          eyebrow="Como funciona"
          title="Do lead a cobranca, sem perder contexto."
          description="No Dask, a operacao nao reinicia a cada etapa. O que nasce no comercial continua no escopo, vira documentacao, alimenta a execucao, organiza acompanhamento e sustenta cobranca e faturamento."
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

function AdaptabilityView({ isActive }: { isActive: boolean }) {
  return (
    <section
      id="contextos"
      className={cn("home-page__section home-page__tab-section home-page__adaptability-section", isActive && "home-page__section--active")}
      aria-label="Adaptabilidade"
    >
      <SectionIntro
        eyebrow="Aplicacao"
        title="Feito para operacoes de software. Expansivel quando precisar."
        description="A mensagem principal do Dask e software house, fabrica de software, startup de desenvolvimento e operacoes por projeto. Outros contextos podem usar a mesma base depois, sem roubar o foco da proposta central."
      />

      <div className="home-page__context-map" aria-label="Contextos de aplicacao">
        {useCases.map((useCase) => (
          <UseCaseItem key={useCase.title} useCase={useCase} />
        ))}
      </div>

      <aside className="home-page__adaptability-note" aria-label="Resumo de adaptabilidade">
        <p>Expansao controlada</p>
        <strong>Comece pela operacao de software e leve o mesmo sistema para outras frentes.</strong>
      </aside>
    </section>
  );
}

function StructureView({ isActive }: { isActive: boolean }) {
  return (
    <section
      id="estruturas"
      className={cn("home-page__section home-page__tab-section home-page__architecture-section", isActive && "home-page__section--active")}
      aria-label="Estrutura configuravel"
    >
      <SectionIntro
        eyebrow="Arquitetura configuravel"
        title="Configuravel para o processo. Objetivo na narrativa."
        description="A configuracao existe para sustentar o fluxo comercial, operacional e financeiro do seu time. Ela e importante, mas nao substitui a promessa principal: manter tudo no mesmo sistema, no mesmo contexto."
      />

      <div className="home-page__architecture-grid">
        <div className="home-page__architecture-list" aria-label="Elementos configuraveis">
          {architectureItems.map((item) => (
            <ArchitectureItem key={item.label} item={item} />
          ))}
        </div>

        <aside className="home-page__architecture-preview" aria-label="Resumo da configuracao">
          <p className="home-page__architecture-preview-eyebrow">Base configuravel</p>
          <h3>Padrao onde precisa, flexibilidade onde importa.</h3>
          <p>Templates, campos, views e regras adaptam o processo sem quebrar a continuidade entre venda, documentacao, execucao e faturamento.</p>
        </aside>
      </div>
    </section>
  );
}

function PricingSection({
  onSubscribeClick,
  isActive
}: {
  onSubscribeClick: (plan: "PERSONAL" | "BUSINESS") => void;
  isActive: boolean;
}) {
  return (
    <section
      className={cn(
        "home-page__section home-page__tab-section home-page__pricing-section",
        isActive && "home-page__section--active"
      )}
      id="precos"
      aria-label="Planos e precos"
    >
      <SectionIntro
        eyebrow="Planos"
        title="Comece simples. Estruture a operacao inteira."
        description="Escolha o plano ideal para sair da fragmentacao e operar no mesmo sistema. Cobranca mensal recorrente, sem surpresa e com cancelamento quando quiser."
      />

      <div className="home-page__pricing-cards">
        <article className="home-page__pricing-card">
          <p className="home-page__pricing-plan-name">Pessoal</p>
          <div className="home-page__pricing-price">
            <strong>R$ 19,90</strong>
            <span>/mes</span>
          </div>
          <p className="home-page__pricing-description">Para profissionais que querem centralizar contexto, tarefas e acompanhamento em um fluxo individual.</p>
          <ul className="home-page__pricing-features">
            {[
              "1 workspace pessoal",
              "Boards, listas e agenda",
              "Contexto continuo para demandas e entregas",
              "IA aplicada ao fluxo",
              "Automacoes basicas e busca contextual"
            ].map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <button
            className="home-page__action home-page__action--secondary home-page__pricing-btn"
            onClick={() => onSubscribeClick("PERSONAL")}
            type="button"
          >
            Comecar no Pessoal
          </button>
        </article>

        <article className="home-page__pricing-card home-page__pricing-card--featured">
          <span className="home-page__pricing-badge">Popular</span>
          <p className="home-page__pricing-plan-name">Business</p>
          <div className="home-page__pricing-price">
            <strong>R$ 99,00</strong>
            <span>/mes</span>
          </div>
          <p className="home-page__pricing-description">Para software houses e equipes que precisam conectar comercial, entrega, acompanhamento e cobranca na mesma operacao.</p>
          <ul className="home-page__pricing-features">
            {[
              "Multiplos workspaces",
              "Fluxo compartilhado entre comercial, operacao e faturamento",
              "Boards, listas e agenda",
              "IA contextual e automacoes",
              "Campos personalizados",
              "Rastreabilidade, auditoria e integracoes",
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
            Estruturar com Business
          </button>
        </article>
      </div>

    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const activeSection = getHomeSectionFromHash(location.hash);

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
          <HomeHeroView
            isAuthenticated={isAuthenticated}
            isActive={activeSection === "top"}
            onExploreClick={() => selectSection("inteligencia")}
          />
        </div>

        <div className="home-page__view">
          <ValueSectionView isActive={activeSection === "valor"} />
        </div>

        <div className="home-page__view">
          <IntelligenceView isActive={activeSection === "inteligencia"} />
        </div>

        <div className="home-page__view">
          <AdaptabilityView isActive={activeSection === "contextos"} />
        </div>

        <div className="home-page__view">
          <StructureView isActive={activeSection === "estruturas"} />
        </div>

        <div className="home-page__view home-page__view--pricing">
          <PricingSection isActive={activeSection === "precos"} onSubscribeClick={handleSubscribeClick} />
        </div>
      </div>
    </main>
  );
}
