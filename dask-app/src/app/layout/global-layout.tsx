import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { buildWorkspaceSelectorPath, routePaths } from "@/app/router/route-paths";
import { useAuth, useLogout } from "@/features/auth";
import { billingService, PLAN_DISPLAY, type BillingStatus } from "@/modules/billing";
import { GlobalChromeProvider } from "@/app/layout";
import { cn } from "@/shared/lib/cn";
import { ModalShell, TextInput, UserAvatar } from "@/shared/ui";
import daskLogoMark from "@/shared/assets/dask-logo-mark.svg";
import "./global-layout.css";

const homeNavigationItems = [
  { id: "top", label: "Inicio" },
  { id: "valor", label: "Por que Dask" },
  { id: "inteligencia", label: "Como funciona" },
  { id: "contextos", label: "Adaptabilidade" },
  { id: "estruturas", label: "Estrutura" },
  { id: "precos", label: "Planos" }
];

const termsNavigationItems = [
  { id: "legal-overview", label: "Visao geral" },
  { id: "legal-clauses", label: "Clausulas" },
  { id: "legal-guide", label: "Leitura rapida" }
];

const privacyNavigationItems = [
  { id: "legal-overview", label: "Visao geral" },
  { id: "legal-clauses", label: "Dados" },
  { id: "legal-guide", label: "Leitura rapida" }
];

const homeNavigationIds = new Set(homeNavigationItems.map(item => item.id));
const legalNavigationIds = new Set([...termsNavigationItems, ...privacyNavigationItems].map(item => item.id));
const userProfileStorageKey = "dask:user-profile-preferences";
const globalThemeStorageKey = "dask:theme-preference";
const userProfileThemes = new Set<UserProfileTheme>(["light", "dark", "system"]);
const defaultUserProfilePreferences: UserProfilePreferences = {
  theme: "system"
};

type UserProfileTheme = "light" | "dark" | "system";

interface UserProfilePreferences {
  theme: UserProfileTheme;
}

function normalizeUserProfileTheme(theme: unknown): UserProfileTheme {
  return typeof theme === "string" && userProfileThemes.has(theme as UserProfileTheme)
    ? (theme as UserProfileTheme)
    : "system";
}

function getSystemResolvedTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveUserProfileTheme(theme: string, systemTheme: "light" | "dark"): "light" | "dark" {
  const normalizedTheme = normalizeUserProfileTheme(theme);
  return normalizedTheme === "system" ? systemTheme : normalizedTheme;
}

function buildUserProfileStorageKey(userId: string): string {
  return `${userProfileStorageKey}:${userId}`;
}

function getStoredUserProfilePreferences(userId: string | null | undefined): UserProfilePreferences | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  try {
    const rawPreferences = window.localStorage.getItem(buildUserProfileStorageKey(userId));
    if (!rawPreferences) {
      return null;
    }

    const parsed = JSON.parse(rawPreferences) as Partial<UserProfilePreferences> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      theme: normalizeUserProfileTheme(parsed.theme)
    };
  } catch {
    return null;
  }
}

function storeUserProfilePreferences(userId: string | null | undefined, preferences: UserProfilePreferences): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(
      buildUserProfileStorageKey(userId),
      JSON.stringify({
        ...preferences,
        theme: normalizeUserProfileTheme(preferences.theme)
      })
    );
  } catch {
    // Preferencias locais nao bloqueiam a UI quando o storage indisponivel.
  }
}

function storeGlobalThemePreference(theme: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(globalThemeStorageKey, normalizeUserProfileTheme(theme));
  } catch {
    // Tema global e melhor-esforco; nao deve bloquear a interface.
  }
}

function getStoredGlobalThemePreference(): UserProfileTheme {
  if (typeof window === "undefined") {
    return defaultUserProfilePreferences.theme;
  }

  try {
    return normalizeUserProfileTheme(window.localStorage.getItem(globalThemeStorageKey));
  } catch {
    return defaultUserProfilePreferences.theme;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nao foi possivel carregar a imagem."));
    });
    reader.addEventListener("error", () => reject(new Error("Nao foi possivel carregar a imagem.")));
    reader.readAsDataURL(file);
  });
}

function getHomeSectionFromHash(hash: string): string {
  const sectionId = hash.replace("#", "");
  return homeNavigationIds.has(sectionId) ? sectionId : "top";
}

function getLegalSectionFromHash(hash: string): string {
  const sectionId = hash.replace("#", "");
  return legalNavigationIds.has(sectionId) ? sectionId : "legal-overview";
}

function getHomeScrollTarget(sectionId: string): HTMLElement | null {
  const target = document.getElementById(sectionId);
  if (!target) {
    return null;
  }

  if (sectionId === "top" || sectionId === "precos") {
    return target.closest(".home-page__view") ?? target;
  }

  return target;
}

function getHomeSectionScrollTop(scrollContainer: HTMLElement, target: HTMLElement, targetId: string): number {
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetId === "top") {
    return 0;
  }

  if (targetId === "precos") {
    const alignedTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    return Math.min(maxScrollTop, Math.max(0, alignedTop));
  }

  const centeredTop =
    targetRect.top -
    containerRect.top +
    scrollContainer.scrollTop -
    Math.max(0, (containerRect.height - targetRect.height) / 2);

  const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  return Math.min(maxScrollTop, Math.max(0, centeredTop));
}

function getLegalScrollTarget(sectionId: string): HTMLElement | null {
  const target = document.getElementById(sectionId);
  if (!target) {
    return null;
  }

  return target.closest(".home-page__view") ?? target;
}

function getLegalSectionScrollTop(
  scrollContainer: HTMLElement,
  target: HTMLElement,
  targetId: string,
  options?: { alignToPageEnd?: boolean }
): number {
  if (targetId === "legal-overview") {
    return 0;
  }

  const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  if (options?.alignToPageEnd) {
    return maxScrollTop;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const alignedTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
  return Math.min(maxScrollTop, Math.max(0, alignedTop));
}

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

function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "Nao disponivel";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Nao disponivel";
  }

  return date.toLocaleDateString("pt-BR");
}

function scrollPublicMainTo(top: number): void {
  const scrollContainer = document.querySelector(".global-layout__main");
  if (!(scrollContainer instanceof HTMLElement)) {
    return;
  }

  scrollContainer.scrollTo({
    top,
    behavior: "auto"
  });
}

export function GlobalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status, updateUserProfile, updateUserAvatar } = useAuth();
  const { logout, isSubmitting } = useLogout();
  const isHomeRoute = location.pathname === routePaths.home;
  const isLoginRoute = location.pathname === routePaths.login;
  const isResetPasswordRoute = location.pathname === routePaths.resetPassword;
  const isVerifyEmailRoute = location.pathname === routePaths.verifyEmail;
  const isTermsRoute = location.pathname === routePaths.termsOfUse;
  const isPrivacyRoute = location.pathname === routePaths.privacyPolicy;
  const isCommercialDocumentPublicRoute = location.pathname.startsWith("/documents/public/");
  const isProposalPublicRoute = location.pathname.startsWith("/proposals/public/");
  const isBillingPublicRoute = location.pathname === routePaths.billingPublic;
  const isBillingSuccessRoute = location.pathname === routePaths.billingSuccess;
  const isBillingCancelRoute = location.pathname === routePaths.billingCancel;
  const isChoosePlanRoute = location.pathname === routePaths.choosePlan;
  const isSubscriptionBlockedRoute = location.pathname === routePaths.subscriptionBlocked;
  const isPublicRoute =
    isHomeRoute ||
    isLoginRoute ||
    isResetPasswordRoute ||
    isVerifyEmailRoute ||
    isTermsRoute ||
    isPrivacyRoute ||
    isCommercialDocumentPublicRoute ||
    isProposalPublicRoute ||
    isBillingPublicRoute ||
    isBillingSuccessRoute ||
    isBillingCancelRoute ||
    isChoosePlanRoute ||
    isSubscriptionBlockedRoute;
  const isAppRoute = !isPublicRoute;
  const isAdminRoute = location.pathname === routePaths.admin;
  const shouldDisableMainScroll = isAppRoute && !isAdminRoute;
  const isAuthenticated = status === "authenticated";
  const isLegalRoute = isTermsRoute || isPrivacyRoute;
  const isAuthenticatedArea = isAuthenticated && !isPublicRoute;
  const hasPublicHeaderNavigation = isHomeRoute || isLegalRoute;
  const legalNavigationItems = isPrivacyRoute ? privacyNavigationItems : termsNavigationItems;
  const legalNavigationLabel = isPrivacyRoute ? "Navegacao da Politica de Privacidade" : "Navegacao dos Termos de Uso";
  const legalRoutePath = isPrivacyRoute ? routePaths.privacyPolicy : routePaths.termsOfUse;

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isCompactViewport());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoadState, setBillingLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isUpgradingToBusiness, setIsUpgradingToBusiness] = useState(false);
  const [isHomeNavOpen, setIsHomeNavOpen] = useState(false);
  const [activeHomeSection, setActiveHomeSection] = useState(() => getHomeSectionFromHash(location.hash));
  const [activeLegalSection, setActiveLegalSection] = useState(() => getLegalSectionFromHash(location.hash));
  const [profileTheme, setProfileTheme] = useState<UserProfileTheme>(() => getStoredGlobalThemePreference());
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemResolvedTheme());
  const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileAvatarState, setProfileAvatarState] = useState<"idle" | "saving">("idle");
  const [profileAvatarError, setProfileAvatarError] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const normalizedProfileTheme = normalizeUserProfileTheme(profileTheme);
  const resolvedProfileTheme = resolveUserProfileTheme(profileTheme, systemTheme);

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
    if (typeof window === "undefined") {
      return;
    }

    const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => setSystemTheme(getSystemResolvedTheme());
    handleSystemThemeChange();
    systemThemeQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      systemThemeQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfileTheme(getStoredGlobalThemePreference());
      setProfileNameDraft("");
      return;
    }

    const storedPreferences = getStoredUserProfilePreferences(user.id) ?? defaultUserProfilePreferences;
    setProfileNameDraft(user.name);
    setProfileTheme(normalizeUserProfileTheme(storedPreferences.theme));
    storeGlobalThemePreference(storedPreferences.theme);
  }, [user?.id]);

  useEffect(() => {
    setProfileNameDraft(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    if (!isUserProfileOpen) {
      setProfileSaveState("idle");
      setProfileSaveError(null);
      setProfileAvatarState("idle");
      setProfileAvatarError(null);
      return;
    }

    setProfileNameDraft(user?.name ?? "");
  }, [isUserProfileOpen, user?.name]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const { documentElement } = document;
    const { body } = document;

    if (isAuthenticatedArea) {
      documentElement.classList.add("app-theme");
      documentElement.dataset.theme = resolvedProfileTheme;
      documentElement.dataset.themePreference = normalizedProfileTheme;
      documentElement.style.colorScheme = resolvedProfileTheme;
      body.classList.add("app-theme");
      body.dataset.theme = resolvedProfileTheme;
      body.dataset.themePreference = normalizedProfileTheme;
      body.style.colorScheme = resolvedProfileTheme;
      return () => {
        documentElement.classList.remove("app-theme");
        delete documentElement.dataset.theme;
        delete documentElement.dataset.themePreference;
        documentElement.style.removeProperty("color-scheme");
        body.classList.remove("app-theme");
        delete body.dataset.theme;
        delete body.dataset.themePreference;
        body.style.removeProperty("color-scheme");
      };
    }

    documentElement.classList.remove("app-theme");
    delete documentElement.dataset.theme;
    delete documentElement.dataset.themePreference;
    documentElement.style.removeProperty("color-scheme");
    body.classList.remove("app-theme");
    delete body.dataset.theme;
    delete body.dataset.themePreference;
    body.style.removeProperty("color-scheme");

    return undefined;
  }, [isAuthenticatedArea, normalizedProfileTheme, resolvedProfileTheme]);

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
      const viewportCenter = containerRect.top + containerRect.height / 2;
      const currentSection = homeNavigationItems.reduce((closestId, item) => {
        const target = getHomeScrollTarget(item.id);
        if (!target) {
          return closestId;
        }

        const targetRect = target.getBoundingClientRect();
        const targetCenter = targetRect.top + targetRect.height / 2;
        const currentDistance = Math.abs(targetCenter - viewportCenter);
        const closestTarget = getHomeScrollTarget(closestId);

        if (!closestTarget) {
          return item.id;
        }

        const closestRect = closestTarget.getBoundingClientRect();
        const closestCenter = closestRect.top + closestRect.height / 2;
        const closestDistance = Math.abs(closestCenter - viewportCenter);
        return currentDistance < closestDistance ? item.id : closestId;
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

  useLayoutEffect(() => {
    if (!isPublicRoute) {
      return;
    }

    scrollPublicMainTo(0);
  }, [isPublicRoute, location.pathname]);

  useLayoutEffect(() => {
    if (!isHomeRoute) {
      return;
    }

    const targetId = getHomeSectionFromHash(location.hash);
    const scrollContainer = document.querySelector(".global-layout__main");
    const target = getHomeScrollTarget(targetId);
    if (!(scrollContainer instanceof HTMLElement) || !target) {
      return;
    }
    const nextTop = getHomeSectionScrollTop(scrollContainer, target, targetId);

    scrollPublicMainTo(nextTop);
  }, [isHomeRoute, location.hash]);

  useEffect(() => {
    if (!isLegalRoute) {
      setActiveLegalSection("legal-overview");
      return;
    }

    const scrollContainer = document.querySelector(".global-layout__main");
    if (!(scrollContainer instanceof HTMLElement)) {
      return;
    }

    const updateActiveSection = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const viewportCenter = containerRect.top + containerRect.height / 2;
      const currentSection = legalNavigationItems.reduce((closestId, item) => {
        const target = getLegalScrollTarget(item.id);
        if (!target) {
          return closestId;
        }

        const targetRect = target.getBoundingClientRect();
        const targetCenter = targetRect.top + targetRect.height / 2;
        const currentDistance = Math.abs(targetCenter - viewportCenter);
        const closestTarget = getLegalScrollTarget(closestId);

        if (!closestTarget) {
          return item.id;
        }

        const closestRect = closestTarget.getBoundingClientRect();
        const closestCenter = closestRect.top + closestRect.height / 2;
        const closestDistance = Math.abs(closestCenter - viewportCenter);
        return currentDistance < closestDistance ? item.id : closestId;
      }, "legal-overview");

      setActiveLegalSection(currentSection);
    };

    updateActiveSection();
    scrollContainer.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      scrollContainer.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [isLegalRoute, legalNavigationItems]);

  useLayoutEffect(() => {
    if (!isLegalRoute) {
      return;
    }

    const targetId = getLegalSectionFromHash(location.hash);
    const scrollContainer = document.querySelector(".global-layout__main");
    const target = getLegalScrollTarget(targetId);
    if (!(scrollContainer instanceof HTMLElement) || !target) {
      return;
    }
    const nextTop = getLegalSectionScrollTop(scrollContainer, target, targetId, {
      alignToPageEnd: isPrivacyRoute && targetId === "legal-guide"
    });

    scrollPublicMainTo(nextTop);
  }, [isLegalRoute, location.hash, location.pathname]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setBillingStatus(null);
      setBillingLoadState("idle");
      setBillingError(null);
      return;
    }

    if (!isUserMenuOpen) {
      return;
    }

    setBillingLoadState("loading");
    setBillingError(null);
    billingService
      .getStatus()
      .then((statusResponse) => {
        setBillingStatus(statusResponse);
        setBillingLoadState("loaded");
      })
      .catch(() => {
        setBillingLoadState("error");
        setBillingError("Nao foi possivel carregar os dados de assinatura.");
      });
  }, [isAuthenticated, isUserMenuOpen]);

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

  const selectHomeSection = (targetId: string) => {
    const nextPath = targetId === "top" ? routePaths.home : `${routePaths.home}#${targetId}`;

    setActiveHomeSection(targetId);
    setIsHomeNavOpen(false);

    if (`${location.pathname}${location.hash}` === nextPath) {
      const container = document.querySelector(".global-layout__main");
      const target = getHomeScrollTarget(targetId);
      if (container instanceof HTMLElement && target) {
        container.scrollTo({
          top: getHomeSectionScrollTop(container, target, targetId),
          behavior: "auto"
        });
      }
      return;
    }

    navigate(nextPath);
  };

  const selectLegalSection = (targetId: string) => {
    const nextPath = targetId === "legal-overview" ? legalRoutePath : `${legalRoutePath}#${targetId}`;

    setActiveLegalSection(targetId);
    setIsHomeNavOpen(false);

    if (`${location.pathname}${location.hash}` === nextPath) {
      const container = document.querySelector(".global-layout__main");
      const target = getLegalScrollTarget(targetId);
      if (container instanceof HTMLElement && target) {
        container.scrollTo({
          top: getLegalSectionScrollTop(container, target, targetId, {
            alignToPageEnd: isPrivacyRoute && targetId === "legal-guide"
          }),
          behavior: "auto"
        });
      }
      return;
    }

    navigate(nextPath);
  };

  const profileLabel = user?.name ?? user?.email ?? "Visitante";
  const profileSubLabel = status === "authenticated" ? "Sessao ativa" : "Nao autenticado";
  const profileEmail = user?.email ?? "Sem e-mail";
  const profileInitials = getUserInitials(profileLabel);
  const profileAvatarUrl = user?.avatarUrl ?? null;
  const isAuthBusy = isSubmitting || status === "logout_in_progress";
  const activeWorkspaceSlug = extractWorkspaceSlug(location.pathname);
  const currentWorkspaceLabel = activeWorkspaceSlug ? activeWorkspaceSlug.replace(/-/g, " ") : "Nenhum workspace ativo";
  const currentPlanLabel = billingStatus?.plan ? PLAN_DISPLAY[billingStatus.plan].name : "Sem plano";
  const currentPlanPrice = billingStatus?.plan ? PLAN_DISPLAY[billingStatus.plan].price : "--";
  const nextBillingDate = formatDateLabel(billingStatus?.currentPeriodEnd ?? null);
  const canUpgradeToBusiness = billingStatus?.plan !== "BUSINESS";
  const normalizedProfileName = profileNameDraft.trim();
  const isProfileSaveBusy = profileSaveState === "saving";
  const isProfileAvatarBusy = profileAvatarState === "saving";
  const profileAccountBadge = user?.emailVerified ? "Email verificado" : "Email pendente";
  const profileAccountStatus = user?.emailVerified ? "Verificada" : "Pendente";
  const profileCreatedAt = formatDateLabel(user?.createdAt);
  const chromeValue = {
    isSidebarOpen,
    toggleNavigation,
    closeNavigation
  };

  const handleUpgradeToBusiness = async () => {
    if (isUpgradingToBusiness) {
      return;
    }

    setIsUpgradingToBusiness(true);
    try {
      const { url } = await billingService.createCheckoutSession("BUSINESS");
      window.location.href = url;
    } catch {
      setBillingError("Nao foi possivel iniciar upgrade agora.");
      setIsUpgradingToBusiness(false);
    }
  };

  const closeUserProfileModal = (preserveCurrentState = false) => {
    if (!preserveCurrentState) {
      const storedPreferences = getStoredUserProfilePreferences(user?.id) ?? defaultUserProfilePreferences;
      setProfileTheme(normalizeUserProfileTheme(storedPreferences.theme));
      setProfileNameDraft(user?.name ?? "");
    }

    setProfileSaveState("idle");
    setProfileSaveError(null);
    setIsUserProfileOpen(false);
  };

  const saveUserProfilePreferences = async () => {
    if (!user?.id || normalizedProfileName.length < 2) {
      setProfileSaveState("error");
      setProfileSaveError("Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    setProfileSaveState("saving");
    setProfileSaveError(null);

    try {
      if (normalizedProfileName !== user.name) {
        await updateUserProfile({ name: normalizedProfileName });
      }

      storeUserProfilePreferences(user.id, {
        theme: profileTheme
      });
      storeGlobalThemePreference(profileTheme);
      setProfileSaveState("idle");
      closeUserProfileModal(true);
    } catch (error) {
      setProfileSaveState("error");
      setProfileSaveError(error instanceof Error ? error.message : "Nao foi possivel salvar seu perfil.");
    }
  };

  const uploadUserProfileAvatar = async (file: File) => {
    setProfileAvatarState("saving");
    setProfileAvatarError(null);

    try {
      const manualAvatarDataUrl = await readFileAsDataUrl(file);
      await updateUserAvatar({ manualAvatarDataUrl });
      setProfileAvatarState("idle");
    } catch (error) {
      setProfileAvatarState("idle");
      setProfileAvatarError(error instanceof Error ? error.message : "Nao foi possivel atualizar sua foto.");
    }
  };

  const removeUserProfileAvatar = async () => {
    setProfileAvatarState("saving");
    setProfileAvatarError(null);

    try {
      await updateUserAvatar({ manualAvatarDataUrl: null, removeProviderAvatar: true });
      setProfileAvatarState("idle");
    } catch (error) {
      setProfileAvatarState("idle");
      setProfileAvatarError(error instanceof Error ? error.message : "Nao foi possivel remover sua foto.");
    }
  };

  return (
    <GlobalChromeProvider value={chromeValue}>
      <div
        className="global-layout app-theme"
        data-theme={resolvedProfileTheme}
        data-theme-preference={normalizedProfileTheme}
        style={{ colorScheme: resolvedProfileTheme }}
      >
        <div className="global-layout__surface">
          <header className={cn("global-header", hasPublicHeaderNavigation && "global-header--home")}>
            <div className="global-header__left">
              <button
                type="button"
                className="global-header__menu"
                aria-label={
                  isHomeRoute
                    ? "Alternar menu da Home"
                    : isLegalRoute
                      ? isPrivacyRoute
                        ? "Alternar menu de Privacidade"
                        : "Alternar menu dos Termos"
                      : "Alternar menu de navegacao"
                }
                aria-expanded={hasPublicHeaderNavigation ? isHomeNavOpen : isSidebarOpen}
                onClick={hasPublicHeaderNavigation ? () => setIsHomeNavOpen(prev => !prev) : isPublicRoute ? undefined : toggleNavigation}
                disabled={isPublicRoute && !hasPublicHeaderNavigation}
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
                    onClick={() => selectHomeSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            ) : isLegalRoute ? (
              <nav className="global-header__home-nav" aria-label={legalNavigationLabel}>
                {legalNavigationItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "global-header__home-link",
                      activeLegalSection === item.id && "global-header__home-link--active"
                    )}
                    onClick={() => selectLegalSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            ) : null}

            {isAuthenticated ? (
              <div className="global-header__user-wrap" ref={userMenuRef}>
                {isPublicRoute && !isHomeRoute ? (
                  <button
                    type="button"
                    className="global-header__user global-header__home-return"
                    onClick={() => navigate(routePaths.workspaceEntry)}
                  >
                    Voltar ao Dask
                  </button>
                ) : null}

                <button
                  type="button"
                  className="global-header__user"
                  aria-label={profileLabel}
                  title={profileSubLabel}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                >
                  <UserAvatar
                    alt={`Foto de ${profileLabel}`}
                    imageUrl={profileAvatarUrl}
                    initials={profileInitials}
                    size="sm"
                    className="global-header__user-avatar"
                  />
                  <span className="global-header__user-name">{profileLabel}</span>
                </button>

                {isUserMenuOpen ? (
                  <div className="global-header__user-menu" role="menu" aria-label="Menu de perfil do usuario">
                    <header className="global-header__user-menu-head">
                      <UserAvatar
                        alt={`Foto de ${profileLabel}`}
                        imageUrl={profileAvatarUrl}
                        initials={profileInitials}
                        size="md"
                        className="global-header__user-menu-avatar"
                      />
                      <div>
                        <p>{profileLabel}</p>
                        <small>{profileEmail}</small>
                      </div>
                    </header>

                    <section className="global-header__billing-card" aria-label="Plano atual">
                      <div className="global-header__billing-copy">
                        <span>Plano atual</span>
                        <strong>{currentPlanLabel}</strong>
                        <small>{currentPlanPrice}/mes</small>
                      </div>
                      <div className="global-header__billing-metadata">
                        {billingLoadState === "loading" ? <p>Carregando assinatura...</p> : null}
                        {billingLoadState === "error" && billingError ? <p>{billingError}</p> : null}
                        {billingLoadState === "loaded" ? (
                          <>
                            <p>Proxima cobranca: {nextBillingDate}</p>
                            <p>Status: {billingStatus?.status ?? "Nao definido"}</p>
                          </>
                        ) : null}
                      </div>
                      <div className="global-header__billing-actions">
                        {canUpgradeToBusiness ? (
                          <button
                            type="button"
                            onClick={() => void handleUpgradeToBusiness()}
                            disabled={isUpgradingToBusiness || billingLoadState === "loading"}
                          >
                            {isUpgradingToBusiness ? "Abrindo checkout..." : "Fazer upgrade para Business"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate(routePaths.choosePlan);
                          }}
                        >
                          Gerenciar plano
                        </button>
                      </div>
                    </section>

                    <nav className="global-header__user-menu-actions" aria-label="Acoes do perfil">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsUserProfileOpen(true);
                        }}
                      >
                        Abrir perfil do usuario
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate(buildWorkspaceSelectorPath());
                        }}
                        disabled={isAuthBusy}
                      >
                        Trocar workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate(isHomeRoute ? routePaths.workspaceEntry : routePaths.home);
                        }}
                      >
                        {isHomeRoute ? "Voltar ao Dask" : "Voltar para Home"}
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

            {hasPublicHeaderNavigation && isHomeNavOpen ? (
              <nav className="global-header__home-menu" aria-label={isHomeRoute ? "Navegacao da Home" : legalNavigationLabel}>
                {(isHomeRoute ? homeNavigationItems : legalNavigationItems).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "global-header__home-menu-link",
                      (isHomeRoute ? activeHomeSection : activeLegalSection) === item.id &&
                        "global-header__home-menu-link--active"
                    )}
                    onClick={() => (isHomeRoute ? selectHomeSection(item.id) : selectLegalSection(item.id))}
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
              isAdminRoute && "global-layout__main--admin",
              shouldDisableMainScroll && "global-layout__main--no-scroll",
              isPublicRoute && "global-layout__main--public"
            )}
          >
            <Outlet />
          </main>

          <footer className="global-footer">
            <div className="global-footer__inner">
              <span className="global-footer__wordmark" aria-label="Dask">
                Dask
              </span>
              <nav className="global-footer__links" aria-label="Links legais">
                <Link to={routePaths.termsOfUse}>Termos de uso</Link>
                <Link to={routePaths.privacyPolicy}>Privacidade</Link>
              </nav>
            </div>
          </footer>

          {isUserProfileOpen ? (
            <ModalShell
              titleId="user-profile-title"
              className={cn("user-profile-modal", `user-profile-modal--${resolvedProfileTheme}`)}
              onClose={() => closeUserProfileModal()}
            >
              <header className="user-profile-modal__header">
                <div className="user-profile-modal__identity">
                  <UserAvatar
                    alt={`Foto de ${profileLabel}`}
                    imageUrl={profileAvatarUrl}
                    initials={profileInitials}
                    size="lg"
                    editable
                    canRemove={Boolean(profileAvatarUrl)}
                    isLoading={isProfileAvatarBusy}
                    error={profileAvatarError}
                    onUpload={uploadUserProfileAvatar}
                    onRemove={removeUserProfileAvatar}
                    className="user-profile-modal__avatar"
                  />
                  <div className="user-profile-modal__identity-copy">
                    <span className="user-profile-modal__eyebrow">Perfil do usuario</span>
                    <h2 id="user-profile-title">{profileLabel}</h2>
                    <p>{profileEmail}</p>
                    <div className="user-profile-modal__identity-badges">
                      <span className="user-profile-modal__plan-badge">{currentPlanLabel}</span>
                      <span className="user-profile-modal__meta-badge">{profileAccountBadge}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="user-profile-modal__close"
                  aria-label="Fechar perfil do usuario"
                  onClick={() => closeUserProfileModal()}
                >
                  x
                </button>
              </header>

              <div className="user-profile-modal__body">
                <section className="user-profile-modal__panel user-profile-modal__panel--identity">
                  <div className="user-profile-modal__section-head">
                    <span className="user-profile-modal__section-icon" aria-hidden="true">
                      ME
                    </span>
                    <div>
                      <span className="user-profile-modal__section-label">Dados basicos</span>
                      <p>Mostre apenas o essencial da conta e ajuste como seu nome aparece no Dask.</p>
                    </div>
                  </div>
                  <div className="user-profile-modal__identity-grid">
                    <label className="user-profile-modal__field">
                      <span>Nome de usuario</span>
                      <TextInput
                        value={profileNameDraft}
                        onChange={event => {
                          setProfileNameDraft(event.target.value);
                          if (profileSaveState === "error") {
                            setProfileSaveState("idle");
                            setProfileSaveError(null);
                          }
                        }}
                        placeholder="Como seu nome deve aparecer no Dask"
                        maxLength={100}
                      />
                    </label>
                    <label className="user-profile-modal__field user-profile-modal__field--readonly">
                      <span>E-mail</span>
                      <TextInput value={profileEmail} readOnly aria-readonly="true" />
                    </label>
                  </div>
                  <div className="user-profile-modal__basic-grid" aria-label="Resumo da conta">
                    <article className="user-profile-modal__basic-card">
                      <small>Plano atual</small>
                      <strong>{billingLoadState === "loading" ? "Carregando..." : currentPlanLabel}</strong>
                    </article>
                    <article className="user-profile-modal__basic-card">
                      <small>Workspace ativo</small>
                      <strong>{currentWorkspaceLabel}</strong>
                    </article>
                    <article className="user-profile-modal__basic-card">
                      <small>Conta</small>
                      <strong>{profileAccountStatus}</strong>
                    </article>
                    <article className="user-profile-modal__basic-card">
                      <small>Membro desde</small>
                      <strong>{profileCreatedAt}</strong>
                    </article>
                  </div>
                </section>

                <section className="user-profile-modal__panel user-profile-modal__panel--theme">
                  <div className="user-profile-modal__section-head">
                    <span className="user-profile-modal__section-icon" aria-hidden="true">
                      UI
                    </span>
                    <div>
                      <span className="user-profile-modal__section-label">Aparencia</span>
                      <p>Escolha somente o tema que deve ser aplicado ao seu perfil.</p>
                    </div>
                  </div>
                  <div className="user-profile-modal__option-grid" role="radiogroup" aria-label="Tema">
                    {([
                      { value: "light", label: "Claro", description: "Interface luminosa" },
                      { value: "dark", label: "Escuro", description: "Menos brilho" },
                      { value: "system", label: "Sistema", description: `Usar ${systemTheme === "dark" ? "escuro" : "claro"} do dispositivo` }
                    ] satisfies Array<{ value: UserProfileTheme; label: string; description: string }>).map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "user-profile-modal__choice",
                          profileTheme === option.value && "user-profile-modal__choice--active"
                        )}
                        role="radio"
                        aria-checked={profileTheme === option.value}
                        onClick={() => setProfileTheme(option.value)}
                      >
                        <span className={cn("user-profile-modal__theme-preview", `user-profile-modal__theme-preview--${option.value}`)} aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        <span className="user-profile-modal__choice-copy">
                          <span>{option.label}</span>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <footer className="user-profile-modal__footer">
                {profileSaveError ? <p className="user-profile-modal__feedback">{profileSaveError}</p> : null}
                <button type="button" className="user-profile-modal__secondary" onClick={() => closeUserProfileModal()}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="user-profile-modal__primary"
                  onClick={() => void saveUserProfilePreferences()}
                  disabled={isProfileSaveBusy}
                >
                  {isProfileSaveBusy ? "Salvando..." : "Salvar perfil"}
                </button>
              </footer>
            </ModalShell>
          ) : null}
        </div>
      </div>
    </GlobalChromeProvider>
  );
}
