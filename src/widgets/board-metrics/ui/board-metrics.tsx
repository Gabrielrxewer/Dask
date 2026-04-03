import type { BoardMetrics as BoardMetricsType } from "@/entities/task";
import "./board-metrics.css";

interface BoardMetricsProps {
  metrics: BoardMetricsType;
}

export function BoardMetrics({ metrics }: BoardMetricsProps) {
  return (
    <section className="board-metrics">
      <article className="board-metrics__card">
        <p>Total de cards</p>
        <h3>{metrics.total}</h3>
      </article>

      <article className="board-metrics__card">
        <p>Em progresso</p>
        <h3>{metrics.doing}</h3>
      </article>

      <article className="board-metrics__card">
        <p>Entrega esta semana</p>
        <h3>{metrics.dueThisWeek}</h3>
      </article>

      <article className="board-metrics__card">
        <p>Concluido</p>
        <h3>{`${metrics.donePercent}%`}</h3>
      </article>
    </section>
  );
}
