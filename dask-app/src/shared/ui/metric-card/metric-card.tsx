interface MetricCardProps {
  label: string;
  value: string | number;
  className?: string;
}

export function MetricCard({ label, value, className = "" }: MetricCardProps) {
  return (
    <article className={`shared-metric-card ${className}`.trim()}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}
