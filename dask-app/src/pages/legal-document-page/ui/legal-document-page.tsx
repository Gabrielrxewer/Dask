import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import "./legal-document-page.css";

type LegalDocumentBadgeTone = "default" | "success" | "warning";

type LegalDocumentBadge = {
  label: string;
  tone?: LegalDocumentBadgeTone;
};

type LegalDocumentHighlight = {
  label: string;
  value: string;
  description: string;
};

type LegalDocumentSection = {
  title: string;
  description: string;
  tag?: string;
  featured?: boolean;
};

type LegalDocumentGuideItem = {
  title: string;
  description: string;
};

type LegalDocumentLink = {
  label: string;
  to: string;
};

type LegalDocumentPageProps = {
  pageClassName?: string;
  sectionsVariant?: "pricing" | "pillars";
  guideVariant?: "architecture" | "pillars";
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  summary: string;
  badges: LegalDocumentBadge[];
  highlights: LegalDocumentHighlight[];
  sections: LegalDocumentSection[];
  sectionsEyebrow: string;
  sectionsTitle: string;
  sectionsDescription: string;
  guideEyebrow: string;
  guideTitle: string;
  guideDescription: string;
  guideItems: LegalDocumentGuideItem[];
  complementaryEyebrow: string;
  complementaryTitle: string;
  complementaryDescription: string;
  complementaryLink: LegalDocumentLink;
};

function Badge({ label, tone = "default" }: LegalDocumentBadge) {
  return <span className={`home-page__badge home-page__badge--${tone}`}>{label}</span>;
}

function HighlightCard({ label, value, description }: LegalDocumentHighlight) {
  return (
    <article className="home-page__signal-card">
      <p className="home-page__signal-label">{label}</p>
      <strong className="home-page__signal-value">{value}</strong>
      <p className="home-page__signal-description">{description}</p>
    </article>
  );
}

function ClauseCard({
  index,
  title,
  description,
  tag,
  featured,
  variant
}: LegalDocumentSection & { index: number; variant: LegalDocumentPageProps["sectionsVariant"] }) {
  if (variant === "pillars") {
    return (
      <article className="home-page__pillar legal-page__card">
        <span className="home-page__pillar-number">{String(index).padStart(2, "0")}</span>
        <p className="home-page__pillar-eyebrow">{tag ?? "Clausula"}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </article>
    );
  }

  const cardClassName = featured
    ? "home-page__pricing-card--featured legal-page__card"
    : "home-page__pricing-card legal-page__card";

  return (
    <article className={cardClassName}>
      <p className="home-page__pricing-plan-name">Topico {String(index).padStart(2, "0")}</p>
      {tag ? <span className="home-page__pricing-badge">{tag}</span> : null}
      <h2 className="home-page__feature-title legal-page__card-title">{title}</h2>
      <p className="home-page__feature-description legal-page__card-description">{description}</p>
    </article>
  );
}

export function LegalDocumentPage({
  pageClassName,
  sectionsVariant = "pricing",
  guideVariant = "architecture",
  eyebrow,
  title,
  description,
  updatedAt,
  summary,
  badges,
  highlights,
  sections,
  sectionsEyebrow,
  sectionsTitle,
  sectionsDescription,
  guideEyebrow,
  guideTitle,
  guideDescription,
  guideItems,
  complementaryEyebrow,
  complementaryTitle,
  complementaryDescription,
  complementaryLink
}: LegalDocumentPageProps) {
  const mainClassName = ["home-page legal-page", pageClassName].filter(Boolean).join(" ");
  const hasPillarGuide = guideVariant === "pillars";
  const clausesSectionClassName = [
    "home-page__section",
    "home-page__tab-section",
    sectionsVariant === "pillars" ? "home-page__value-section" : "home-page__pricing-section",
    "legal-page__clauses-section"
  ].join(" ");
  const cardsClassName = [
    sectionsVariant === "pillars" ? "home-page__pillar-grid" : "home-page__pricing-cards",
    "legal-page__cards",
    sectionsVariant === "pillars" && "legal-page__cards--pillars"
  ].filter(Boolean).join(" ");
  const guideSectionClassName = [
    "home-page__section",
    "home-page__tab-section",
    hasPillarGuide ? "home-page__value-section" : "home-page__architecture-section",
    "legal-page__guide-section",
    hasPillarGuide && "legal-page__guide-section--pillars"
  ].filter(Boolean).join(" ");
  const guideListClassName = [
    hasPillarGuide ? "home-page__pillar-grid" : "home-page__architecture-list",
    "legal-page__guide-list",
    hasPillarGuide && "legal-page__guide-list--pillars"
  ].filter(Boolean).join(" ");

  const clausesView = (
    <div className="home-page__view home-page__view--stacked legal-page__stack legal-page__stack--clauses">
      <section id="legal-clauses" className={clausesSectionClassName}>
        <header className="home-page__section-intro">
          <p className="home-page__section-eyebrow">{sectionsEyebrow}</p>
          <h2 className="home-page__section-title">{sectionsTitle}</h2>
          <p className="home-page__section-description">{sectionsDescription}</p>
        </header>

        <div className={cardsClassName}>
          {sections.map((section, index) => (
            <ClauseCard key={section.title} index={index + 1} variant={sectionsVariant} {...section} />
          ))}
        </div>
      </section>
    </div>
  );

  const guideCards = hasPillarGuide ? (
    <div className={guideListClassName}>
      {guideItems.map((item, index) => (
        <article key={item.title} className="home-page__pillar legal-page__guide-card">
          <span className="home-page__pillar-number">{String(index + 1).padStart(2, "0")}</span>
          <p className="home-page__pillar-eyebrow">Leitura rapida</p>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}

      <article id="legal-complementary" className="home-page__pillar legal-page__guide-card legal-page__guide-card--link">
        <span className="home-page__pillar-number">04</span>
        <p className="home-page__pillar-eyebrow">{complementaryEyebrow}</p>
        <h3>{complementaryTitle}</h3>
        <p>{complementaryDescription}</p>
        <Link className="home-page__action home-page__action--secondary legal-page__preview-link" to={complementaryLink.to}>
          {complementaryLink.label}
        </Link>
      </article>
    </div>
  ) : (
    <div className="home-page__architecture-grid">
      <div className={guideListClassName}>
        {guideItems.map((item) => (
          <article key={item.title} className="home-page__architecture-item">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <aside id="legal-complementary" className="home-page__architecture-preview legal-page__preview">
        <p className="home-page__architecture-preview-eyebrow">{complementaryEyebrow}</p>
        <h3>{complementaryTitle}</h3>
        <p>{complementaryDescription}</p>
        <Link className="home-page__action home-page__action--secondary legal-page__preview-link" to={complementaryLink.to}>
          {complementaryLink.label}
        </Link>
      </aside>
    </div>
  );

  const guideSection = (
    <section id="legal-guide" className={guideSectionClassName}>
      <header className="home-page__section-intro">
        <p className="home-page__section-eyebrow">{guideEyebrow}</p>
        <h2 className="home-page__section-title">{guideTitle}</h2>
        <p className="home-page__section-description">{guideDescription}</p>
      </header>

      {guideCards}
    </section>
  );

  return (
    <main className={mainClassName}>
      <div className="home-page__container legal-page__container">
        <div className="home-page__view legal-page__viewport">
          <section id="legal-overview" className="home-page__hero legal-page__hero" aria-label={title}>
            <div className="home-page__hero-copy legal-page__hero-copy">
              <p className="home-page__eyebrow">{eyebrow}</p>
              <h1 className="home-page__title legal-page__title">{title}</h1>
              <p className="home-page__description legal-page__description">{description}</p>
              <p className="legal-page__updated">Ultima atualizacao: {updatedAt}</p>

              <div className="home-page__actions">
                <Link className="home-page__action home-page__action--primary" to={routePaths.home}>
                  Voltar para Home
                </Link>
                <Link className="home-page__action home-page__action--secondary" to={complementaryLink.to}>
                  {complementaryLink.label}
                </Link>
              </div>
            </div>

            <aside className="home-page__hero-side legal-page__hero-side" aria-label={`${title} em resumo`}>
              <div className="home-page__hero-side-head">
                <div className="home-page__badge-row" aria-label="Pontos centrais do documento">
                  {badges.map((badge) => (
                    <Badge key={badge.label} {...badge} />
                  ))}
                </div>
                <p className="home-page__hero-side-summary">{summary}</p>
              </div>

              <div className="home-page__hero-signal-list" aria-label="Resumo rapido do documento">
                {highlights.map((highlight) => (
                  <HighlightCard key={highlight.label} {...highlight} />
                ))}
              </div>
            </aside>
          </section>
        </div>

        {hasPillarGuide ? (
          <>
            {clausesView}
            <div className="home-page__view home-page__view--stacked legal-page__stack legal-page__stack--guide">
              {guideSection}
            </div>
          </>
        ) : (
          <div className="home-page__view home-page__view--stacked legal-page__stack">
            <section id="legal-clauses" className={clausesSectionClassName}>
              <header className="home-page__section-intro">
                <p className="home-page__section-eyebrow">{sectionsEyebrow}</p>
                <h2 className="home-page__section-title">{sectionsTitle}</h2>
                <p className="home-page__section-description">{sectionsDescription}</p>
              </header>

              <div className={cardsClassName}>
                {sections.map((section, index) => (
                  <ClauseCard key={section.title} index={index + 1} variant={sectionsVariant} {...section} />
                ))}
              </div>
            </section>

            {guideSection}
          </div>
        )}
      </div>
    </main>
  );
}
