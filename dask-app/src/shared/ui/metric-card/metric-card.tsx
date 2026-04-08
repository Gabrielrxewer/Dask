import { cn } from "@/shared/lib/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  className?: string;
}

export function MetricCard({ label, value, className = "" }: MetricCardProps) {
  return (
    <article className={cn("shared-metric-card", className)}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}
