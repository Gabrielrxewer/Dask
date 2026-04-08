import type { BoardMetrics as BoardMetricsType } from "@/entities/task";
import { MetricCard } from "@/shared/ui";
import "./board-metrics.css";

interface MetricCardItem {
  label: string;
  value: string | number;
}

interface BoardMetricsProps {
  metrics: BoardMetricsType;
  cards?: MetricCardItem[];
  className?: string;
}

export function BoardMetrics({ metrics, cards, className = "" }: BoardMetricsProps) {
  const fallbackCards: MetricCardItem[] = [
    { label: "Total de cards", value: metrics.total },
    { label: "Em progresso", value: metrics.doing },
    { label: "Entrega esta semana", value: metrics.dueThisWeek },
    { label: "Concluido", value: `${metrics.donePercent}%` }
  ];

  const metricCards = cards && cards.length > 0 ? cards : fallbackCards;

  return (
    <section className={`board-metrics ${className}`.trim()}>
      {metricCards.map(card => (
        <MetricCard label={card.label} value={card.value} key={card.label} />
      ))}
    </section>
  );
}
