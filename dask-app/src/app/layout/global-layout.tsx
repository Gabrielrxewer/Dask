import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { GlobalChromeProvider } from "@/app/layout/global-chrome-context";
import "./global-layout.css";

function isCompactViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 1140px)").matches;
}

function getUserInitials(nameOrEmail?: string): string {
  if (!nameOrEmail) {
    return "DK";
  }

  const tokens = nameOrEmail.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

export function GlobalLayout() {
  const location = useLocation();
  const { user, status } = useAuth();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const toggleNavigation = () => {
    if (isCompactViewport()) {
      setIsSidebarOpen(prev => !prev);
      return;
    }

    setIsSidebarCollapsed(prev => !prev);
  };

  const closeNavigation = () => {
    setIsSidebarOpen(false);
  };

  const profileLabel = user?.name ?? user?.email ?? "Visitante";
  const profileSubLabel = status === "authenticated" ? "Sessao ativa" : "Nao autenticado";
  const locationLabel = location.pathname === "/login" ? "Acesso" : "Workspace";

  const chromeValue = {
    isSidebarCollapsed,
    isSidebarOpen,
    toggleNavigation,
    closeNavigation
  };

  return (
    <GlobalChromeProvider value={chromeValue}>
      <div className="global-layout">
        <div className="global-layout__surface">
          <header className="global-header">
            <div className="global-header__left">
              <button
                type="button"
                className="global-header__menu"
                aria-label="Alternar menu de navegacao"
                onClick={toggleNavigation}
              >
                <span />
                <span />
                <span />
              </button>
              <div className="global-header__brand">
                <strong>Dask</strong>
                <span>{locationLabel}</span>
              </div>
            </div>

            <div className="global-header__profile" title={profileLabel}>
              <span className="global-header__avatar">{getUserInitials(profileLabel)}</span>
              <div>
                <p>{profileLabel}</p>
                <small>{profileSubLabel}</small>
              </div>
            </div>
          </header>

          <main className="global-layout__main">
            <Outlet />
          </main>

          <footer className="global-footer">
            <p>Dask Platform</p>
            <small>Fluxo inteligente e rastreavel para operacao de engenharia</small>
          </footer>
        </div>
      </div>
    </GlobalChromeProvider>
  );
}
