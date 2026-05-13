import type { ReactNode } from "react";

interface SettingsSectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SettingsSectionHeading({ eyebrow, title, description }: SettingsSectionHeadingProps) {
  return (
    <div className="general-settings__section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

interface SettingsSummaryListProps {
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
}

export function SettingsSummaryList({ items }: SettingsSummaryListProps) {
  return (
    <div className="general-settings__summary-list">
      {items.map((item) => (
        <span key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

interface SettingsProfileCardProps {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  details: Array<{
    label: string;
    value: ReactNode;
  }>;
  action: ReactNode;
}

export function SettingsProfileCard({
  eyebrow,
  title,
  description,
  details,
  action,
}: SettingsProfileCardProps) {
  return (
    <article className="general-settings__profile-card">
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <dl>
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
      {action}
    </article>
  );
}
