import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/app/router";
import { useAuth } from "@/features/auth/model";
import { cn } from "@/shared/lib/cn";
import { AppIcon, Button, type AppIconName } from "@/shared/ui";
import {
  audiences,
  auditLogs,
  automationSteps,
  comparisonRows,
  heroActivities,
  heroBadges,
  heroDeals,
  heroMetrics,
  insightMetrics,
  modules,
  plans,
  pipelineStages,
  problemCards,
  proofSegments,
  revenueSteps,
  trustItems
} from "./home-page.data";
import type {
  HomeActivity,
  HomeAudience,
  HomeAutomationStep,
  HomeBadge,
  HomeComparisonRow,
  HomeDeal,
  HomeInsightMetric,
  HomeMetric,
  HomeModule,
  HomePlan,
  HomePipelineStage,
  HomeProblem,
  HomeRevenueStep,
  HomeTrustItem
} from "./home-page.types";
import "./home-page.css";

const daskLogoSrc = "/favicon.svg";

type HomeSectionId = "top" | "produto" | "solucoes" | "recursos" | "precos" | "sobre";

const homeSectionIds = new Set<HomeSectionId>(["top", "produto", "solucoes", "recursos", "precos", "sobre"]);

function getHomeSectionFromHash(hash: string): HomeSectionId {
  const sectionId = hash.replace("#", "") as HomeSectionId;
  return homeSectionIds.has(sectionId) ? sectionId : "top";
}

function progressStyle(progress: number): CSSProperties {
  return { "--progress": `${progress}%` } as CSSProperties;
}

function IconBadge({ name, className }: { name: AppIconName; className?: string }) {
  return (
    <span className={cn("home-page__icon-badge", className)}>
      <AppIcon name={name} size={18} strokeWidth={2} />
    </span>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  titleId,
  align = "center"
}: {
  eyebrow?: string;
  title: string;
  description: string;
  titleId: string;
  align?: "start" | "center";
}) {
  return (
    <header className={cn("home-page__section-intro", align === "start" && "home-page__section-intro--start")}>
      {eyebrow ? <p className="home-page__eyebrow">{eyebrow}</p> : null}
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function HeroBadge({ badge }: { badge: HomeBadge }) {
  return <span className={`home-page__hero-badge home-page__hero-badge--${badge.tone ?? "default"}`}>{badge.label}</span>;
}

function HeroMetric({ metric }: { metric: HomeMetric }) {
  return (
    <article className={`home-page__metric-card home-page__metric-card--${metric.tone ?? "default"}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}

function PipelineStage({ stage }: { stage: HomePipelineStage }) {
  return (
    <li className={cn("home-page__pipeline-stage", stage.isActive && "is-active", stage.isDone && "is-done")}>
      <span>{stage.label}</span>
      <i style={progressStyle(stage.progress)} aria-hidden="true" />
    </li>
  );
}

function HeroDeal({ deal }: { deal: HomeDeal }) {
  return (
    <article className="home-page__deal-card">
      <div>
        <strong>{deal.account}</strong>
        <span>{deal.scope}</span>
        <small>{deal.amount}</small>
      </div>
      <div className="home-page__deal-progress">
        <mark className={`home-page__status-pill home-page__status-pill--${deal.tone ?? "accent"}`}>{deal.status}</mark>
        <span>{deal.progress}%</span>
      </div>
    </article>
  );
}

function HeroActivity({ activity }: { activity: HomeActivity }) {
  return (
    <li>
      <AppIcon name={activity.icon} size={15} strokeWidth={2} />
      <span>{activity.label}</span>
      <time>{activity.time}</time>
    </li>
  );
}

function RevenueDashboard() {
  return (
    <aside className="home-page__dashboard" aria-label="Dashboard conceitual de receita do Dask">
      <header className="home-page__dashboard-header">
        <div>
          <span>Pipeline de Receita</span>
          <strong>Do lead ao onboarding</strong>
        </div>
        <small>Dados conectados em tempo real</small>
      </header>

      <ol className="home-page__pipeline" aria-label="Etapas de receita">
        {pipelineStages.map((stage) => (
          <PipelineStage key={stage.label} stage={stage} />
        ))}
      </ol>

      <div className="home-page__metric-grid">
        {heroMetrics.map((metric) => (
          <HeroMetric key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="home-page__dashboard-grid">
        <section className="home-page__dashboard-panel">
          <header>
            <strong>Negocios em andamento</strong>
            <a href="#solucoes">Ver todos</a>
          </header>
          <div className="home-page__deal-list">
            {heroDeals.map((deal) => (
              <HeroDeal key={deal.account} deal={deal} />
            ))}
          </div>
        </section>

        <section className="home-page__dashboard-panel">
          <header>
            <strong>Atividades recentes</strong>
            <a href="#recursos">Ver logs</a>
          </header>
          <ul className="home-page__activity-list">
            {heroActivities.map((activity) => (
              <HeroActivity key={`${activity.label}-${activity.time}`} activity={activity} />
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

function HeroSection({
  isAuthenticated,
  onExploreClick
}: {
  isAuthenticated: boolean;
  onExploreClick: () => void;
}) {
  const primaryPath = isAuthenticated ? routePaths.workspaceEntry : routePaths.login;

  return (
    <section className="home-page__hero" id="produto" aria-labelledby="home-hero-title">
      <div className="home-page__hero-copy">
        <div className="home-page__brand-lockup" aria-label="Dask">
          <img src={daskLogoSrc} alt="" />
          <span>Dask</span>
        </div>
        <h1 id="home-hero-title">O CRM que nao para na proposta.</h1>
        <p className="home-page__hero-lead">
          O Dask conecta todo o ciclo de receita da sua empresa: leads, propostas, contratos, cobrancas, fiscal,
          automacoes e IA. Um sistema operacional de receita configuravel para empresas de servicos que querem
          previsibilidade e controle.
        </p>
        <div className="home-page__actions">
          <Link className="home-page__action home-page__action--primary" to={primaryPath}>
            Agendar demonstracao
          </Link>
          <Button className="home-page__action home-page__action--secondary" variant="secondary" onClick={onExploreClick}>
            Ver como funciona
          </Button>
        </div>
        <div className="home-page__hero-badges" aria-label="Diferenciais do Dask">
          {heroBadges.map((badge) => (
            <HeroBadge key={badge.label} badge={badge} />
          ))}
        </div>
      </div>
      <RevenueDashboard />
    </section>
  );
}

function ProofStrip() {
  return (
    <section className="home-page__proof" aria-label="Perfis de operacao para o Dask">
      <p>Empresas de servicos que precisam transformar oportunidade em receita rastreavel</p>
      <div>
        {proofSegments.map((segment) => (
          <span key={segment}>{segment}</span>
        ))}
      </div>
    </section>
  );
}

function ProblemCard({ problem }: { problem: HomeProblem }) {
  return (
    <article className="home-page__problem-card">
      <IconBadge name={problem.icon} />
      <h3>{problem.title}</h3>
      <p>{problem.description}</p>
    </article>
  );
}

function ProblemsSection() {
  return (
    <section className="home-page__section" aria-labelledby="home-problems-title">
      <SectionIntro
        titleId="home-problems-title"
        title="Os problemas que travam sua receita"
        description="Quando a venda sai do CRM, a receita passa a depender de memoria, planilha, copia manual e follow-up solto."
      />
      <div className="home-page__problem-grid">
        {problemCards.map((problem) => (
          <ProblemCard key={problem.title} problem={problem} />
        ))}
      </div>
    </section>
  );
}

function RevenueStepCard({ step, index }: { step: HomeRevenueStep; index: number }) {
  return (
    <li className="home-page__revenue-card">
      <IconBadge name={step.icon} />
      <strong>{step.title}</strong>
      <p>{step.description}</p>
      <span>{String(index + 1).padStart(2, "0")}</span>
    </li>
  );
}

function RevenueSystemSection() {
  return (
    <section className="home-page__section home-page__revenue-system" id="solucoes" aria-labelledby="home-revenue-title">
      <div className="home-page__revenue-copy">
        <SectionIntro
          align="start"
          eyebrow="Sistema operacional de receita"
          titleId="home-revenue-title"
          title="Um sistema operacional de receita ponta a ponta"
          description="O Dask orquestra todas as etapas do ciclo de receita em um unico trilho, com dados conectados, automacoes inteligentes e total visibilidade."
        />
        <ul className="home-page__check-list">
          <li>Fluxos 100% configuraveis</li>
          <li>Regras de negocio e aprovacoes</li>
          <li>Automacao de tarefas e comunicacoes</li>
          <li>Integracoes nativas com fiscal e financeiro</li>
          <li>IA aplicada para analise e execucao</li>
        </ul>
      </div>

      <div className="home-page__revenue-flow-panel">
        <ol className="home-page__revenue-grid" aria-label="Ciclo completo de receita no Dask">
          {revenueSteps.map((step, index) => (
            <RevenueStepCard key={step.title} step={step} index={index} />
          ))}
        </ol>
        <div className="home-page__connected-strip">
          <span>Dados conectados</span>
          <span>Auditoria completa</span>
          <span>Automacoes</span>
          <span>IA</span>
        </div>
      </div>
    </section>
  );
}

function ModuleCard({ module }: { module: HomeModule }) {
  return (
    <article className="home-page__module-card">
      <IconBadge name={module.icon} />
      <h3>{module.title}</h3>
      <p>{module.description}</p>
    </article>
  );
}

function ModulesSection() {
  return (
    <section className="home-page__section" aria-labelledby="home-modules-title">
      <SectionIntro
        titleId="home-modules-title"
        title="Modulos que cobrem todo o ciclo de receita"
        description="Tudo que normalmente fica espalhado entre CRM, documento, financeiro, fiscal, marketing e entrega dentro do mesmo trilho operacional."
      />
      <div className="home-page__module-grid">
        {modules.map((module) => (
          <ModuleCard key={module.title} module={module} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  selfServicePath
}: {
  plan: HomePlan;
  selfServicePath: string;
}) {
  const isEnterprise = plan.code === "ENTERPRISE";
  const actionClassName = cn(
    "home-page__plan-action",
    plan.isFeatured && "home-page__plan-action--featured"
  );
  const actionContent = (
    <>
      <span>{plan.ctaLabel}</span>
      <AppIcon name="chevron-right" size={15} strokeWidth={2.4} />
    </>
  );

  return (
    <article className={cn("home-page__plan-card", plan.isFeatured && "home-page__plan-card--featured")}>
      {plan.isFeatured ? <span className="home-page__plan-badge">Mais completo</span> : null}
      <div className="home-page__plan-head">
        <p>{plan.name}</p>
        <div className="home-page__plan-price">
          <strong>{plan.price}</strong>
          {plan.period ? <span>{plan.period}</span> : null}
        </div>
      </div>
      <p className="home-page__plan-description">{plan.description}</p>
      <ul className="home-page__plan-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <AppIcon name="check" size={14} strokeWidth={2.4} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {isEnterprise ? (
        <a className={actionClassName} href="mailto:comercial@dask.com.br?subject=Orcamento%20Enterprise%20Dask">
          {actionContent}
        </a>
      ) : (
        <Link className={actionClassName} to={selfServicePath}>
          {actionContent}
        </Link>
      )}
    </article>
  );
}

function PricingSection({ selfServicePath }: { selfServicePath: string }) {
  return (
    <section className="home-page__section home-page__pricing" id="precos" aria-labelledby="home-pricing-title">
      <div className="home-page__pricing-copy">
        <SectionIntro
          align="start"
          eyebrow="Planos"
          titleId="home-pricing-title"
          title="Planos e precos do Dask"
          description="Planos mensais para operar CRM, proposta, contrato, cobranca, fiscal, automacoes e IA no mesmo fluxo."
        />
        <p className="home-page__pricing-note">
          Valores do catalogo atual. O checkout confirma plano, aceite legal, recorrencia e dados de cobranca antes do pagamento.
        </p>
      </div>
      <div className="home-page__plan-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.code} plan={plan} selfServicePath={selfServicePath} />
        ))}
      </div>
    </section>
  );
}

function ComparisonRow({ row }: { row: HomeComparisonRow }) {
  return (
    <div className="home-page__comparison-row" role="row">
      <span role="cell">{row.commonCrm}</span>
      <strong role="cell">{row.dask}</strong>
    </div>
  );
}

function InsightMetric({ metric }: { metric: HomeInsightMetric }) {
  return (
    <article>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}

function ComparisonInsightsSection() {
  const bars = [72, 84, 79, 96, 91, 100];

  return (
    <section className="home-page__section home-page__comparison-insights" aria-labelledby="home-comparison-title">
      <div className="home-page__comparison-card" role="table" aria-label="CRM comum vs Dask">
        <h2 id="home-comparison-title">CRM comum vs Dask</h2>
        <div className="home-page__comparison-head" role="row">
          <span role="columnheader">CRM comum</span>
          <strong role="columnheader">Dask</strong>
        </div>
        {comparisonRows.map((row) => (
          <ComparisonRow key={row.commonCrm} row={row} />
        ))}
      </div>

      <div className="home-page__insights-card" aria-label="Visao de receita">
        <div className="home-page__chart-card">
          <header>
            <strong>Visao de Receita</strong>
            <span>Previsibilidade mensal</span>
          </header>
          <div className="home-page__bar-chart" aria-hidden="true">
            {bars.map((bar, index) => (
              <i key={`${bar}-${index}`} style={progressStyle(bar)} />
            ))}
          </div>
          <div className="home-page__chart-legend">
            <span>Prevista</span>
            <span>Contratada</span>
            <span>Realizada</span>
          </div>
        </div>
        <div className="home-page__donut-card">
          <strong>Receita por status</strong>
          <div className="home-page__donut" aria-hidden="true" />
          <ul>
            <li>Prevista 40%</li>
            <li>Contratada 30%</li>
            <li>Realizada 20%</li>
            <li>Pendente 10%</li>
          </ul>
        </div>
        <div className="home-page__insight-grid">
          {insightMetrics.map((metric) => (
            <InsightMetric key={metric.label} metric={metric} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceCard({ audience }: { audience: HomeAudience }) {
  return (
    <article className="home-page__audience-card">
      <IconBadge name={audience.icon} />
      <div>
        <h3>{audience.title}</h3>
        <p>{audience.description}</p>
      </div>
    </article>
  );
}

function AudienceSection() {
  return (
    <section className="home-page__section" aria-labelledby="home-audience-title">
      <SectionIntro
        titleId="home-audience-title"
        title="Feito para empresas de servicos B2B"
        description="Negocios que vendem projeto, contrato, mensalidade ou servico recorrente precisam de mais que um funil: precisam de uma operacao que chegue ate a receita."
      />
      <div className="home-page__audience-grid">
        {audiences.map((audience) => (
          <AudienceCard key={audience.title} audience={audience} />
        ))}
      </div>
    </section>
  );
}

function AutomationStep({ step, index }: { step: HomeAutomationStep; index: number }) {
  return (
    <li>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <strong>{step.title}</strong>
      <p>{step.description}</p>
    </li>
  );
}

function AutomationSection() {
  return (
    <section className="home-page__section home-page__automation" id="recursos" aria-labelledby="home-automation-title">
      <SectionIntro
        titleId="home-automation-title"
        title="Automacao + IA que acelera sua operacao"
        description="Menos trabalho manual. Mais receita. Decisoes melhores. Com aprovacao humana, logs e contexto operacional em cada etapa."
      />
      <ol className="home-page__automation-rail">
        {automationSteps.map((step, index) => (
          <AutomationStep key={step.title} step={step} index={index} />
        ))}
      </ol>
      <div className="home-page__automation-strip">
        <span>Menos trabalho manual</span>
        <span>Mais receita</span>
        <span>Decisoes melhores</span>
      </div>
    </section>
  );
}

function TrustItem({ item }: { item: HomeTrustItem }) {
  return (
    <li>
      <AppIcon name="check" size={15} strokeWidth={2.2} />
      <span>{item.title}</span>
      <small>{item.description}</small>
    </li>
  );
}

function TrustSection() {
  return (
    <section className="home-page__section home-page__trust" id="sobre" aria-labelledby="home-trust-title">
      <SectionIntro
        titleId="home-trust-title"
        title="Confianca, controle e auditoria em cada etapa"
        description="O Dask deixa claro o que aconteceu, quem executou, qual automacao rodou e o que falta para a oportunidade virar receita."
      />
      <div className="home-page__trust-grid">
        <ul className="home-page__trust-list">
          {trustItems.map((item) => (
            <TrustItem key={item.title} item={item} />
          ))}
        </ul>
        <section className="home-page__audit-card" aria-label="Log de auditoria">
          <h3>Log de auditoria</h3>
          {auditLogs.map((log) => (
            <article key={`${log.time}-${log.event}`}>
              <time>{log.time}</time>
              <span>{log.event}</span>
            </article>
          ))}
        </section>
        <section className="home-page__security-card" aria-label="Seguranca e conformidade">
          <h3>Seguranca e conformidade</h3>
          <div>
            <span>LGPD</span>
            <span>SSL/TLS</span>
            <span>Backup diario</span>
          </div>
          <strong>SLA 99,9%</strong>
          <p>Infraestrutura em nuvem, permissoes por perfil e revisao para operacoes criticas.</p>
        </section>
      </div>
    </section>
  );
}

function FinalCta({
  primaryPath,
  onSecondaryClick
}: {
  primaryPath: string;
  onSecondaryClick: () => void;
}) {
  return (
    <section className="home-page__final-cta" aria-labelledby="home-final-title">
      <h2 id="home-final-title">Pronto para transformar sua operacao de receita?</h2>
      <p>Agende uma demonstracao personalizada e veja o Dask na pratica.</p>
      <div className="home-page__actions home-page__actions--center">
        <Link className="home-page__action home-page__action--primary" to={primaryPath}>
          Agendar demonstracao
        </Link>
        <Button className="home-page__action home-page__action--secondary" variant="secondary" onClick={onSecondaryClick}>
          Falar com especialista
        </Button>
      </div>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const activeSection = getHomeSectionFromHash(location.hash);
  const primaryPath = isAuthenticated ? routePaths.workspaceEntry : routePaths.login;
  const selfServicePath = isAuthenticated ? routePaths.choosePlan : routePaths.login;

  function selectSection(sectionId: HomeSectionId) {
    navigate(sectionId === "top" ? routePaths.home : `${routePaths.home}#${sectionId}`);
  }

  return (
    <main id="top" className="home-page" data-active-section={activeSection}>
      <div className="home-page__container">
        <div className="home-page__view home-page__view--hero">
          <HeroSection isAuthenticated={isAuthenticated} onExploreClick={() => selectSection("solucoes")} />
        </div>

        <ProofStrip />
        <ProblemsSection />
        <RevenueSystemSection />
        <ModulesSection />
        <ComparisonInsightsSection />
        <PricingSection selfServicePath={selfServicePath} />
        <AudienceSection />
        <AutomationSection />
        <TrustSection />
        <FinalCta primaryPath={primaryPath} onSecondaryClick={() => selectSection("sobre")} />
      </div>
    </main>
  );
}
