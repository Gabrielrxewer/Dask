import "./auth-route-fallback.css";

export function AuthRouteFallback() {
  return (
    <main className="auth-route-fallback" aria-live="polite">
      <div className="auth-route-fallback__panel">
        <p className="auth-route-fallback__label">Sessao</p>
        <h1>Verificando autenticacao</h1>
        <p>Estamos validando sua sessao com seguranca.</p>
      </div>
    </main>
  );
}
