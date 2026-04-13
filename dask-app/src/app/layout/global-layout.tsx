import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { useAuth, useLogout } from "@/features/auth";
import { GlobalChromeProvider } from "@/app/layout";
import { cn } from "@/shared/lib/cn";
import daskLogoMark from "@/shared/assets/dask-logo-mark.svg";
import "./global-layout.css";

const homeNavigationItems = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "IA", href: "#inteligencia" },
  { label: "Estruturas", href: "#estruturas" },
  { label: "Contextos", href: "#contextos" }
];

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
  const isHomeRoute = location.pathname === routePaths.home;
  const isLoginRoute = location.pathname === routePaths.login;
  const isPublicGuestRoute = isHomeRoute || isLoginRoute;
  const isAppRoute = !isPublicGuestRoute;
  const isAuthenticated = status === "authenticated";

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isCompactViewport());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

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
      setIsSidebarOpen((prev) => !prev);
      return;
    }

    setIsSidebarOpen(true);
  };

  const closeNavigation = () => {
    setIsSidebarOpen(false);
  };

  const scrollToMarketingSection = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    event.preventDefault();

    const container = mainRef.current;
    const target = document.getElementById(targetId);
    if (!container || !target) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = targetRect.top - containerRect.top + container.scrollTop - 4;

    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "smooth"
    });
  };

  const profileLabel = user?.name ?? user?.email ?? "Visitante";
  const profileSubLabel = status === "authenticated" ? "Sessao ativa" : "Nao autenticado";
  const profileEmail = user?.email ?? "Sem e-mail";
  const profileInitials = getUserInitials(profileLabel);
  const isAuthBusy = isSubmitting || status === "logout_in_progress";
  const chromeValue = {
    isSidebarOpen,
    toggleNavigation,
    closeNavigation
  };

  return (
    <GlobalChromeProvider value={chromeValue}>
      <div className="global-layout">
        <div className={cn("global-layout__surface", isHomeRoute && "global-layout__surface--home")}>
          <header className={cn("global-header", isHomeRoute && "global-header--marketing")}>
            <div className="global-header__left">
              {isPublicGuestRoute ? null : (
                <button
                  type="button"
                  className="global-header__menu"
                  aria-label="Alternar menu de navegacao"
                  onClick={toggleNavigation}
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
              )}

              <Link
                className="global-header__brand"
                to={routePaths.home}
                aria-label="Pagina inicial do Dask"
              >
                <img className="global-header__brand-mark" src={daskLogoMark} alt="Dask" />
              </Link>
            </div>

            {isHomeRoute ? (
              <nav className="global-header__marketing-nav" aria-label="Navegacao da home">
                {homeNavigationItems.map((item) => (
                  <a
                    key={item.href}
                    className="global-header__marketing-link"
                    href={item.href}
                    onClick={(event) => scrollToMarketingSection(event, item.href.slice(1))}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}

            {isAuthenticated ? (
              <div className="global-header__user-wrap" ref={userMenuRef}>
                <button
                  type="button"
                  className="global-header__user"
                  aria-label={profileLabel}
                  title={profileSubLabel}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                >
                  <span className="global-header__user-avatar" aria-hidden="true">
                    <span className="global-header__user-avatar-icon" />
                  </span>
                  <span className="global-header__user-name">{profileLabel}</span>
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
                          navigate(routePaths.settings);
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
            ) : (
              <div className={cn("global-header__guest-actions", isHomeRoute && "global-header__guest-actions--marketing")}>
                {isHomeRoute ? null : (
                  <button
                    type="button"
                    className="global-header__guest-link"
                    onClick={() => navigate(routePaths.home)}
                  >
                    Voltar para Home
                  </button>
                )}
              </div>
            )}
          </header>

          <main
            ref={mainRef}
            className={cn(
              "global-layout__main",
              isAppRoute && "global-layout__main--no-scroll",
              isPublicGuestRoute && "global-layout__main--public"
            )}
          >
            <Outlet />
          </main>

          <footer className={cn("global-footer", isHomeRoute && "global-footer--marketing")}>
            {isHomeRoute ? (
              <div className="global-footer__marketing">
                <div className="global-footer__marketing-brand">
                  <span className="global-footer__wordmark" aria-label="Dask">
                    Dask
                  </span>
                  <small>Plataforma operacional inteligente com IA continua, busca semantica e estrutura configuravel.</small>
                </div>

                <div className="global-footer__marketing-links" aria-label="Atalhos do rodape">
                  <a href="#plataforma" onClick={(event) => scrollToMarketingSection(event, "plataforma")}>
                    Plataforma
                  </a>
                  <a href="#contextos" onClick={(event) => scrollToMarketingSection(event, "contextos")}>
                    Contextos
                  </a>
                  <Link to={routePaths.login}>Entrar</Link>
                </div>
              </div>
            ) : (
              <span className="global-footer__wordmark" aria-label="Dask">
                Dask
              </span>
            )}
          </footer>
        </div>
      </div>
    </GlobalChromeProvider>
  );
}
