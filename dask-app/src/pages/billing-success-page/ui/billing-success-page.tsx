import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { billingService, billingStore } from "@/modules/billing";
import "./billing-success-page.css";

type PageState = "loading" | "active" | "pending";

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2500;

export function BillingSuccessPage() {
  const [state, setState] = useState<PageState>("loading");
  const pollCount = useRef(0);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const status = await billingService.getStatus();

        if (!active) return;

        if (status.canAccessPlatform) {
          billingStore.setStatus(status);
          setState("active");
          return;
        }

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          // Webhook may be delayed — show pending message
          setState("pending");
          return;
        }

        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!active) return;
        setState("pending");
      }
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="billing-success">
        <div className="billing-success__loading">
          <span className="billing-success__spinner" />
          Confirmando seu pagamento...
        </div>
      </main>
    );
  }

  if (state === "active") {
    return (
      <main className="billing-success">
        <div className="billing-success__icon">✓</div>
        <h1 className="billing-success__title">Assinatura ativa!</h1>
        <p className="billing-success__description">
          Seu pagamento foi confirmado. Agora voce tem acesso completo a plataforma Dask.
        </p>
        <div className="billing-success__actions">
          <Link className="billing-success__btn billing-success__btn--primary" to={routePaths.workspaceEntry}>
            Acessar a plataforma
          </Link>
        </div>
      </main>
    );
  }

  // pending: webhook may arrive later
  return (
    <main className="billing-success">
      <div className="billing-success__icon billing-success__icon--pending">⏳</div>
      <h1 className="billing-success__title">Pagamento em processamento</h1>
      <p className="billing-success__description">
        Seu pagamento esta sendo processado. A ativacao pode levar alguns instantes. Se ja foi cobrado, acesse a
        plataforma e aguarde a confirmacao automatica.
      </p>
      <div className="billing-success__actions">
        <Link className="billing-success__btn billing-success__btn--primary" to={routePaths.workspaceEntry}>
          Tentar acessar a plataforma
        </Link>
        <Link className="billing-success__btn billing-success__btn--secondary" to={routePaths.choosePlan}>
          Voltar aos planos
        </Link>
      </div>
    </main>
  );
}
