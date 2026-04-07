import type { BoardMetrics as BoardMetricsType } from "@/entities/task";
import "./board-metrics.css";

interface MetricCardItem {
  label: string;
  value: string | number;
}

interface BoardMetricsProps {
  metrics: BoardMetricsType;
  cards?: MetricCardItem[];
}

export function BoardMetrics({ metrics, cards }: BoardMetricsProps) {
  const fallbackCards: MetricCardItem[] = [
    { label: "Total de cards", value: metrics.total },
    { label: "Em progresso", value: metrics.doing },
    { label: "Entrega esta semana", value: metrics.dueThisWeek },
    { label: "Concluido", value: `${metrics.donePercent}%` }
  ];

  const metricCards = cards && cards.length > 0 ? cards : fallbackCards;

  return (
    <section className="board-metrics">
      {metricCards.map(card => (
        <article className="board-metrics__card" key={card.label}>
          <p>{card.label}</p>
          <h3>{card.value}</h3>
        </article>
      ))}
    </section>
  );
}
