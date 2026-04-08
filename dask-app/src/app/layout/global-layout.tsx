import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "@/features/auth";
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
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const { logout, logoutAll, isSubmitting } = useLogout();
  const isLoginRoute = location.pathname === "/login";
  const isBoardRoute = location.pathname === "/board";

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isCompactViewport());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsUserMenuOpen(false);
    if (!isCompactViewport()) {
      setIsSidebarOpen(true);
      return;
    }
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (!isCompactViewport()) {
        setIsSidebarOpen(true);
        return;
      }
      setIsSidebarOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsUserMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isUserMenuOpen]);

  const toggleNavigation = () => {
    if (isCompactViewport()) {
      setIsSidebarOpen(prev => !prev);
      return;
    }

    setIsSidebarOpen(true);
  };

  const closeNavigation = () => {
    setIsSidebarOpen(false);
  };

  const profileLabel = user?.name ?? user?.email ?? "Visitante";
  const profileSubLabel = status === "authenticated" ? "Sessao ativa" : "Nao autenticado";
  const profileEmail = user?.email ?? "Sem e-mail";
  const profileInitials = getUserInitials(profileLabel);
  const isAuthBusy = isSubmitting || status === "logout_in_progress";
  const locationLabel = isLoginRoute ? "Acesso" : "Workspace";

  const chromeValue = {
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
                onClick={isLoginRoute ? undefined : toggleNavigation}
                disabled={isLoginRoute}
              >
                <span className="global-header__menu-grid">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </button>
              <div className="global-header__brand">
                <strong>Dask</strong>
                <span>{locationLabel}</span>
              </div>
            </div>

            <div className="global-header__user-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="global-header__user"
                aria-label={profileLabel}
                title={profileSubLabel}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                disabled={isLoginRoute}
              >
                <span className="global-header__user-icon" />
              </button>

              {isUserMenuOpen ? (
                <div className="global-header__user-menu" role="menu" aria-label="Menu de perfil do usuario">
                  <header className="global-header__user-menu-head">
                    <span className="global-header__user-menu-avatar">{profileInitials}</span>
                    <div>
                      <p>{profileLabel}</p>
                      <small>{profileEmail}</small>
                    </div>
                  </header>

                  <nav className="global-header__user-menu-actions" aria-label="Acoes do perfil">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate("/settings");
                      }}
                    >
                      Abrir perfil do usuario
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void logout();
                      }}
                      disabled={isAuthBusy}
                    >
                      {isAuthBusy ? "Saindo..." : "Sair"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void logoutAll();
                      }}
                      disabled={isAuthBusy}
                    >
                      Sair de todos
                    </button>
                  </nav>
                </div>
              ) : null}
            </div>
          </header>

          <main className={`global-layout__main ${isBoardRoute ? "global-layout__main--no-scroll" : ""}`.trim()}>
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
