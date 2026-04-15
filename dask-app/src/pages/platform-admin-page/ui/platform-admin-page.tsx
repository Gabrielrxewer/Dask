import { Link } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { useAuth } from "@/features/auth";
import "./platform-admin-page.css";

export function PlatformAdminPage() {
  const { user } = useAuth();

  if (!user?.isPlatformAdmin) {
    return (
      <section className="platform-admin-page platform-admin-page--blocked">
        <div className="platform-admin-page__card">
          <p className="platform-admin-page__badge">Acesso restrito</p>
          <h1>Pagina administrativa da plataforma Dask</h1>
          <p>
            Seu usuario esta autenticado, mas nao possui permissao de admin da plataforma.
            Esta area e exclusiva para operacoes administrativas globais.
          </p>
          <div className="platform-admin-page__actions">
            <Link to={routePaths.workspaceEntry}>Voltar para o app</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="platform-admin-page">
      <div className="platform-admin-page__card">
        <p className="platform-admin-page__badge">Admin da plataforma</p>
        <h1>Painel administrativo Dask</h1>
        <p>
          Area protegida para observabilidade global, saude operacional e controle de plataforma.
          No proximo passo vamos plugar aqui o dashboard de telemetria visual.
        </p>
      </div>
    </section>
  );
}
