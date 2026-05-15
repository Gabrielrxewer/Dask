import { Link, useLocation } from "react-router-dom";
import { routePaths } from "@/app/router";
import { cn } from "@/shared/lib/cn";
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

type LegalSectionId = "legal-overview" | "legal-clauses" | "legal-guide";
const legalSectionIds = new Set<LegalSectionId>(["legal-overview", "legal-clauses", "legal-guide"]);

function getLegalSectionFromHash(hash: string): LegalSectionId {
  const sectionId = hash.replace("#", "") as LegalSectionId;
  return legalSectionIds.has(sectionId) ? sectionId : "legal-overview";
}

function Badge({ label, tone = "default" }: LegalDocumentBadge) {
  return <span className={`legal-page__badge legal-page__badge--${tone}`}>{label}</span>;
}

function HighlightCard({ label, value, description }: LegalDocumentHighlight) {
  return (
    <article className="legal-page__highlight-card">
      <p className="legal-page__highlight-label">{label}</p>
      <strong className="legal-page__highlight-value">{value}</strong>
      <p className="legal-page__highlight-description">{description}</p>
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
  const cardClassName = cn(
    "legal-page__card",
    variant === "pillars" && "legal-page__card--pillar",
    featured && "legal-page__card--featured"
  );

  return (
    <article className={cardClassName}>
      <div className="legal-page__card-head">
        <span className="legal-page__card-number">{String(index).padStart(2, "0")}</span>
        <span className="legal-page__card-tag">{tag ?? (variant === "pillars" ? "Clausula" : "Topico")}</span>
      </div>
      <h3 className="legal-page__card-title">{title}</h3>
      <p className="legal-page__card-description">{description}</p>
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
  const location = useLocation();
  const activeSection = getLegalSectionFromHash(location.hash);
  const mainClassName = ["legal-page", pageClassName].filter(Boolean).join(" ");
  const hasPillarGuide = guideVariant === "pillars";
  const clausesSectionClassName = cn(
    "legal-page__section",
    "legal-page__clauses-section",
    sectionsVariant === "pillars" && "legal-page__section--pillars"
  );
  const cardsClassName = cn("legal-page__cards", sectionsVariant === "pillars" && "legal-page__cards--pillars");
  const guideSectionClassName = cn(
    "legal-page__section",
    "legal-page__guide-section",
    hasPillarGuide && "legal-page__section--pillars"
  );
  const guideListClassName = cn("legal-page__guide-list", hasPillarGuide && "legal-page__guide-list--pillars");

  const clausesView = (
    <div className="legal-page__view legal-page__stack legal-page__stack--clauses">
      <section
        id="legal-clauses"
        className={cn(clausesSectionClassName, activeSection === "legal-clauses" && "legal-page__section--active")}
      >
        <header className="legal-page__section-intro">
          <p className="legal-page__section-eyebrow">{sectionsEyebrow}</p>
          <h2 className="legal-page__section-title">{sectionsTitle}</h2>
          <p className="legal-page__section-description">{sectionsDescription}</p>
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
        <article key={item.title} className="legal-page__guide-card">
          <span className="legal-page__card-number">{String(index + 1).padStart(2, "0")}</span>
          <p className="legal-page__card-tag">Leitura rapida</p>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}

      <article id="legal-complementary" className="legal-page__guide-card legal-page__guide-card--link">
        <span className="legal-page__card-number">04</span>
        <p className="legal-page__card-tag">{complementaryEyebrow}</p>
        <h3>{complementaryTitle}</h3>
        <p>{complementaryDescription}</p>
        <Link className="legal-page__button legal-page__button--secondary legal-page__preview-link" to={complementaryLink.to}>
          {complementaryLink.label}
        </Link>
      </article>
    </div>
  ) : (
    <div className="legal-page__guide-grid">
      <div className={guideListClassName}>
        {guideItems.map((item) => (
          <article key={item.title} className="legal-page__guide-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <aside id="legal-complementary" className="legal-page__preview">
        <p className="legal-page__card-tag">{complementaryEyebrow}</p>
        <h3>{complementaryTitle}</h3>
        <p>{complementaryDescription}</p>
        <Link className="legal-page__button legal-page__button--secondary legal-page__preview-link" to={complementaryLink.to}>
          {complementaryLink.label}
        </Link>
      </aside>
    </div>
  );

  const guideSection = (
    <section
      id="legal-guide"
      className={cn(guideSectionClassName, activeSection === "legal-guide" && "legal-page__section--active")}
    >
      <header className="legal-page__section-intro">
        <p className="legal-page__section-eyebrow">{guideEyebrow}</p>
        <h2 className="legal-page__section-title">{guideTitle}</h2>
        <p className="legal-page__section-description">{guideDescription}</p>
      </header>

      {guideCards}
    </section>
  );

  return (
    <main className={mainClassName}>
      <div className="legal-page__container">
        <div className="legal-page__view legal-page__viewport">
          <section
            id="legal-overview"
            className={cn("legal-page__hero", activeSection === "legal-overview" && "legal-page__section--active")}
            aria-label={title}
          >
            <div className="legal-page__hero-copy">
              <p className="legal-page__eyebrow">{eyebrow}</p>
              <h1 className="legal-page__title">{title}</h1>
              <p className="legal-page__description">{description}</p>
              <p className="legal-page__updated">Ultima atualizacao: {updatedAt}</p>

              <div className="legal-page__actions">
                <Link className="legal-page__button legal-page__button--primary" to={routePaths.home}>
                  Voltar para Home
                </Link>
                <Link className="legal-page__button legal-page__button--secondary" to={complementaryLink.to}>
                  {complementaryLink.label}
                </Link>
              </div>
            </div>

            <aside className="legal-page__hero-side" aria-label={`${title} em resumo`}>
              <div className="legal-page__summary-head">
                <div className="legal-page__badge-row" aria-label="Pontos centrais do documento">
                  {badges.map((badge) => (
                    <Badge key={badge.label} {...badge} />
                  ))}
                </div>
                <p className="legal-page__summary">{summary}</p>
              </div>

              <div className="legal-page__highlight-list" aria-label="Resumo rapido do documento">
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
            <div className="legal-page__view legal-page__stack legal-page__stack--guide">
              {guideSection}
            </div>
          </>
        ) : (
          <div className="legal-page__view legal-page__stack">
            <section
              id="legal-clauses"
              className={cn(clausesSectionClassName, activeSection === "legal-clauses" && "legal-page__section--active")}
            >
              <header className="legal-page__section-intro">
                <p className="legal-page__section-eyebrow">{sectionsEyebrow}</p>
                <h2 className="legal-page__section-title">{sectionsTitle}</h2>
                <p className="legal-page__section-description">{sectionsDescription}</p>
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
