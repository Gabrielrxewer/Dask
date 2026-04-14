import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { buildWorkspaceSettingsPath, routePaths } from "@/app/router/route-paths";
import { useAuth, useLogout } from "@/features/auth";
import { GlobalChromeProvider } from "@/app/layout";
import { cn } from "@/shared/lib/cn";
import daskLogoMark from "@/shared/assets/dask-logo-mark.svg";
import "./global-layout.css";

const homeNavigationItems = [
  { id: "top", label: "Inicio" },
  { id: "inteligencia", label: "Como funciona" },
  { id: "contextos", label: "Adaptabilidade" },
  { id: "estruturas", label: "Estrutura" },
  { id: "precos", label: "Planos" }
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

function extractWorkspaceSlug(pathname: string): string | null {
  const matched = pathname.match(/^\/w\/([^/]+)/i);
  return matched?.[1] ?? null;
}

export function GlobalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const { logout, logoutAll, isSubmitting } = useLogout();
  const isHomeRoute = location.pathname === routePaths.home;
  const isLoginRoute = location.pathname === routePaths.login;
  const isResetPasswordRoute = location.pathname === routePaths.resetPassword;
  const isPublicGuestRoute = isHomeRoute || isLoginRoute || isResetPasswordRoute;
  const isAppRoute = !isPublicGuestRoute;
  const isAuthenticated = status === "authenticated";

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isCompactViewport());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHomeNavOpen, setIsHomeNavOpen] = useState(false);
  const [activeHomeSection, setActiveHomeSection] = useState("top");
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsHomeNavOpen(false);
    if (!isCompactViewport()) {
      setIsSidebarOpen(true);
      return;
    }
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isHomeRoute) {
      setActiveHomeSection("top");
      return;
    }

    const scrollContainer = document.querySelector(".global-layout__main");
    if (!(scrollContainer instanceof HTMLElement)) {
      return;
    }

    const updateActiveSection = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const currentSection = homeNavigationItems.reduce((activeId, item) => {
        const target = document.getElementById(item.id);
        if (!target) {
          return activeId;
        }

        const targetTop = target.getBoundingClientRect().top - containerRect.top + scrollContainer.scrollTop;
        return scrollContainer.scrollTop + 120 >= targetTop ? item.id : activeId;
      }, "top");

      setActiveHomeSection(currentSection);
    };

    updateActiveSection();
    scrollContainer.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      scrollContainer.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [isHomeRoute]);

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

  const scrollToHomeSection = (targetId: string) => {
    const container = document.querySelector(".global-layout__main");
    const target = document.getElementById(targetId);
    if (!(container instanceof HTMLElement) || !target) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const sectionTopSpacing = 14;
    const nextTop =
      targetId === "top" ? 0 : targetRect.top - containerRect.top + container.scrollTop - sectionTopSpacing;

    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "smooth"
    });
    setActiveHomeSection(targetId);
    setIsHomeNavOpen(false);
  };

  const profileLabel = user?.name ?? user?.email ?? "Visitante";
  const profileSubLabel = status === "authenticated" ? "Sessao ativa" : "Nao autenticado";
  const profileEmail = user?.email ?? "Sem e-mail";
  const profileInitials = getUserInitials(profileLabel);
  const isAuthBusy = isSubmitting || status === "logout_in_progress";
  const activeWorkspaceSlug = extractWorkspaceSlug(location.pathname);
  const chromeValue = {
    isSidebarOpen,
    toggleNavigation,
    closeNavigation
  };

  return (
    <GlobalChromeProvider value={chromeValue}>
      <div className="global-layout">
        <div className="global-layout__surface">
          <header className={cn("global-header", isHomeRoute && "global-header--home")}>
            <div className="global-header__left">
              <button
                type="button"
                className="global-header__menu"
                aria-label={isHomeRoute ? "Alternar menu da Home" : "Alternar menu de navegacao"}
                aria-expanded={isHomeRoute ? isHomeNavOpen : isSidebarOpen}
                onClick={isHomeRoute ? () => setIsHomeNavOpen(prev => !prev) : isPublicGuestRoute ? undefined : toggleNavigation}
                disabled={isPublicGuestRoute && !isHomeRoute}
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
                <img className="global-header__brand-mark" src={daskLogoMark} alt="Dask" />
              </div>
            </div>

            {isHomeRoute ? (
              <nav className="global-header__home-nav" aria-label="Navegacao da Home">
                {homeNavigationItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "global-header__home-link",
                      activeHomeSection === item.id && "global-header__home-link--active"
                    )}
                    onClick={() => scrollToHomeSection(item.id)}
                  >
                    {item.label}
                  </button>
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
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
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
                          navigate(
                            activeWorkspaceSlug
                              ? buildWorkspaceSettingsPath(activeWorkspaceSlug)
                              : routePaths.workspaceEntry
                          );
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
              <div className="global-header__guest-actions">
                <button
                  type="button"
                  className="global-header__guest-link"
                  onClick={() => navigate(isHomeRoute ? routePaths.login : routePaths.home)}
                >
                  {isHomeRoute ? "Entrar" : "Voltar para Home"}
                </button>
              </div>
            )}

            {isHomeRoute && isHomeNavOpen ? (
              <nav className="global-header__home-menu" aria-label="Navegacao da Home">
                {homeNavigationItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "global-header__home-menu-link",
                      activeHomeSection === item.id && "global-header__home-menu-link--active"
                    )}
                    onClick={() => scrollToHomeSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </header>

          <main
            className={cn(
              "global-layout__main",
              isAppRoute && "global-layout__main--no-scroll",
              isPublicGuestRoute && "global-layout__main--public"
            )}
          >
            <Outlet />
          </main>

          <footer className="global-footer">
            <span className="global-footer__wordmark" aria-label="Dask">
              Dask
            </span>
          </footer>
        </div>
      </div>
    </GlobalChromeProvider>
  );
}
