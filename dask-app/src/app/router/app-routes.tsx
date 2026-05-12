import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { GlobalLayout } from "@/app/layout";
import { ProtectedRoute, PublicRoute, SubscribedRoute } from "@/features/auth";
import { BillingProvider } from "@/app/providers/billing-provider";
import { useCurrentWorkspace, useWorkspaceListQuery, useWorkspacePermissions, WorkspaceProvider } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { LoadingState, type LoadingAnimation } from "@/shared/ui/loading-state";
import { buildWorkspaceBoardPath, buildWorkspaceCommercialPath, buildWorkspaceSettingsPath, routePaths } from "@/app/router";

type LazyPageModule = Record<string, unknown>;

function lazyPage(loader: () => Promise<LazyPageModule>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

function routeSuspense(children: ReactNode, animation: LoadingAnimation = "workspace") {
  return (
    <Suspense fallback={<LoadingState text="Carregando modulo..." animation={animation} />}>
      {children}
    </Suspense>
  );
}

const AiAgentsPage = lazyPage(() => import("@/pages/ai-agents-page"), "AiAgentsPage");
const AgendaPage = lazyPage(() => import("@/pages/agenda-page"), "AgendaPage");
const AutomationsPage = lazyPage(() => import("@/pages/automations-page"), "AutomationsPage");
const BillingCancelPage = lazyPage(() => import("@/pages/billing-cancel-page"), "BillingCancelPage");
const BillingPage = lazyPage(() => import("@/pages/billing-page"), "BillingPage");
const BillingPublicPage = lazyPage(() => import("@/pages/billing-public-page"), "BillingPublicPage");
const BillingSuccessPage = lazyPage(() => import("@/pages/billing-success-page"), "BillingSuccessPage");
const BoardEditorSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/board-editor-settings"),
  "BoardEditorSettings"
);
const BoardPage = lazyPage(() => import("@/pages/board-page"), "BoardPage");
const ChoosePlanPage = lazyPage(() => import("@/pages/choose-plan-page"), "ChoosePlanPage");
const DashboardPage = lazyPage(() => import("@/pages/dashboard-page"), "DashboardPage");
const DocumentationPage = lazyPage(() => import("@/pages/documentation-page"), "DocumentationPage");
const FiscalPage = lazyPage(() => import("@/pages/fiscal-page"), "FiscalPage");
const GeneralSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/general-settings"),
  "GeneralSettings"
);
const HomePage = lazyPage(() => import("@/pages/home-page"), "HomePage");
const CommercialPage = lazyPage(() => import("@/pages/commercial-page"), "CommercialPage");
const ListPage = lazyPage(() => import("@/pages/list-page"), "ListPage");
const LoginPage = lazyPage(() => import("@/pages/login-page"), "LoginPage");
const MarketingPage = lazyPage(() => import("@/pages/marketing-page"), "MarketingPage");
const MembersSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/members-settings"),
  "MembersSettings"
);
const NoWorkspacePage = lazyPage(() => import("@/pages/no-workspace-page"), "NoWorkspacePage");
const PlatformAdminPage = lazyPage(() => import("@/pages/platform-admin-page"), "PlatformAdminPage");
const PrivacyPolicyPage = lazyPage(() => import("@/pages/privacy-policy-page"), "PrivacyPolicyPage");
const ProposalPublicPage = lazyPage(() => import("@/pages/proposal-public-page"), "ProposalPublicPage");
const ResetPasswordPage = lazyPage(() => import("@/pages/reset-password-page"), "ResetPasswordPage");
const SettingsShellPage = lazyPage(
  () => import("@/pages/settings-page/ui/settings-shell"),
  "SettingsShell"
);
const SubscriptionBlockedPage = lazyPage(
  () => import("@/pages/subscription-blocked-page"),
  "SubscriptionBlockedPage"
);
const TermsOfUsePage = lazyPage(() => import("@/pages/terms-of-use-page"), "TermsOfUsePage");
const VerifyEmailPage = lazyPage(() => import("@/pages/verify-email-page"), "VerifyEmailPage");
const WorkItemEditorSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/work-item-editor-settings"),
  "WorkItemEditorSettings"
);
const WorkflowStatesSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/workflow-states-settings"),
  "WorkflowStatesSettings"
);
const WorkspaceAuditSettingsPage = lazyPage(
  () => import("@/pages/settings-page/ui/workspace-audit-settings"),
  "WorkspaceAuditSettings"
);
const WorkspaceSelectorPage = lazyPage(() => import("@/pages/workspace-selector-page"), "WorkspaceSelectorPage");

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasRequiredCompanyProfile(settings: Record<string, unknown> | undefined): boolean {
  const profile = readRecord(settings?.companyProfile);
  return ["legalName", "document", "address", "jurisdictionCity", "jurisdictionState", "noticePeriod"].every((key) => {
    const value = profile[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function WorkspaceBoundary() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}

function CompanyProfileRequired({ settingsPath }: { settingsPath: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      minHeight: 320,
      padding: 32,
      textAlign: "center",
      color: "var(--text-soft)",
      fontSize: "var(--font-size-sm)"
    }}>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text)", fontSize: "var(--font-size-base)" }}>
        Perfil da empresa incompleto
      </p>
      <p style={{ margin: 0, maxWidth: 380 }}>
        Para acessar este módulo, preencha os dados da empresa nas configurações do workspace (nome legal, CNPJ, endereço, cidade, estado e prazo de aviso).
      </p>
      <Link
        to={settingsPath}
        style={{
          marginTop: 8,
          padding: "8px 18px",
          borderRadius: "var(--radius-sm)",
          background: "var(--accent)",
          color: "var(--neutral-white)",
          fontWeight: 600,
          fontSize: "var(--font-size-sm)",
          textDecoration: "none"
        }}
      >
        Ir para Settings
      </Link>
    </div>
  );
}

function ModuleRoute({
  module,
  children
}: {
  module: "dashboard" | "board" | "automation" | "documentation" | "billing" | "ai" | "settings" | "fiscal" | "commercial" | "marketing";
  children: JSX.Element;
}) {
  const { snapshot } = useCurrentWorkspace();
  const permissions = useWorkspacePermissions();
  const location = useLocation();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const isClient = permissions.isClient;
  const isCorporateWorkspace = snapshot?.workspace?.kind === "CORPORATE";
  const needsCompanyProfile = !isClient && isCorporateWorkspace && !hasRequiredCompanyProfile(snapshot?.preferences.settings);
  const isSettingsRoute = workspaceSlug.length > 0 && location.pathname.startsWith(buildWorkspaceSettingsPath(workspaceSlug));

  if (!permissions.canAccessModule(module)) {
    return <Navigate replace to={routePaths.board} />;
  }

  if (needsCompanyProfile && module !== "settings" && !isSettingsRoute) {
    return <CompanyProfileRequired settingsPath={buildWorkspaceSettingsPath(workspaceSlug)} />;
  }

  return children;
}

function NonClientRoute({ children }: { children: JSX.Element }) {
  const permissions = useWorkspacePermissions();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();

  if (permissions.isClient) {
    return <Navigate replace to={buildWorkspaceBoardPath(workspaceSlug)} />;
  }

  return children;
}

function WorkspaceEntryRedirect() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const workspacesQuery = useWorkspaceListQuery();

  useEffect(() => {
    if (!workspacesQuery.data) {
      return;
    }

    const fallbackWorkspace = workspacesQuery.data[0];
    if (!fallbackWorkspace) {
      setRedirectTo(routePaths.noWorkspace);
      return;
    }

    if (workspacesQuery.data.length > 1) {
      setRedirectTo(routePaths.workspaceSelector);
      return;
    }

    setRedirectTo(buildWorkspaceBoardPath(fallbackWorkspace.slug));
  }, [workspacesQuery.data]);

  useEffect(() => {
    if (!workspacesQuery.error) {
      return;
    }

    if (isApiError(workspacesQuery.error)) {
      if (workspacesQuery.error.status === 401) {
        setRedirectTo(routePaths.login);
        return;
      }
      if (workspacesQuery.error.status === 403) {
        // Authenticated user without active subscription should go to plan selection.
        setRedirectTo(routePaths.choosePlan);
        return;
      }
    }

    setRedirectTo(routePaths.noWorkspace);
  }, [workspacesQuery.error]);

  if (!redirectTo) {
    return <LoadingState text="Carregando workspaces..." animation="workspace" />;
  }

  return <Navigate replace to={redirectTo} />;
}

function CommercialLeadsAliasRedirect() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  return <Navigate replace to={buildWorkspaceCommercialPath(workspaceSlug)} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route
          path={routePaths.home}
          element={routeSuspense(<HomePage />)}
        />

        <Route
          path={routePaths.login}
          element={
            <PublicRoute>
              {routeSuspense(<LoginPage />)}
            </PublicRoute>
          }
        />

        {/*
          Rota pública sem guard de sessão.
          O usuário chega aqui via link de e-mail — sem cookie de refresh válido.
        */}
        <Route path={routePaths.resetPassword} element={routeSuspense(<ResetPasswordPage />)} />
        <Route path={routePaths.verifyEmail} element={routeSuspense(<VerifyEmailPage />)} />
        <Route
          path={routePaths.commercialDocumentPublic}
          element={routeSuspense(<ProposalPublicPage />, "documentation")}
        />
        <Route path={routePaths.proposalPublic} element={routeSuspense(<ProposalPublicPage />, "documentation")} />
        <Route path={routePaths.billingPublic} element={routeSuspense(<BillingPublicPage />, "billing")} />
        <Route path={routePaths.termsOfUse} element={routeSuspense(<TermsOfUsePage />)} />
        <Route path={routePaths.privacyPolicy} element={routeSuspense(<PrivacyPolicyPage />)} />

        {/* Billing routes — authenticated but subscription not required */}
        <Route element={<ProtectedRoute />}>
          <Route path={routePaths.admin} element={routeSuspense(<PlatformAdminPage />)} />
          <Route element={<BillingProvider />}>
            <Route path={routePaths.choosePlan} element={routeSuspense(<ChoosePlanPage />, "billing")} />
            <Route path={routePaths.billingSuccess} element={routeSuspense(<BillingSuccessPage />, "billing")} />
            <Route path={routePaths.billingCancel} element={routeSuspense(<BillingCancelPage />, "billing")} />
            <Route path={routePaths.subscriptionBlocked} element={routeSuspense(<SubscriptionBlockedPage />, "billing")} />
          </Route>
        </Route>

        {/* Platform routes — require active subscription */}
        <Route element={<SubscribedRoute />}>
          <Route element={<WorkspaceBoundary />}>
            <Route path={routePaths.workspaceEntry} element={<WorkspaceEntryRedirect />} />
            <Route path={routePaths.workspaceSelector} element={routeSuspense(<WorkspaceSelectorPage />)} />
            <Route path={routePaths.noWorkspace} element={routeSuspense(<NoWorkspacePage />)} />
            <Route
              path={routePaths.dashboard}
              element={
                <ModuleRoute module="dashboard">
                  <NonClientRoute>
                    {routeSuspense(<DashboardPage />, "dashboard")}
                  </NonClientRoute>
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.board}
              element={
                <ModuleRoute module="board">
                  {routeSuspense(<BoardPage />, "board")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.list}
              element={
                <ModuleRoute module="board">
                  <NonClientRoute>
                    {routeSuspense(<ListPage />, "list")}
                  </NonClientRoute>
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.agenda}
              element={
                <ModuleRoute module="board">
                  {routeSuspense(<AgendaPage />, "agenda")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.documentation}
              element={
                <ModuleRoute module="documentation">
                  {routeSuspense(<DocumentationPage />, "documentation")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.aiAgents}
              element={
                <ModuleRoute module="ai">
                  {routeSuspense(<AiAgentsPage />, "ai")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.automations}
              element={
                <ModuleRoute module="automation">
                  {routeSuspense(<AutomationsPage />, "automation")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.billing}
              element={
                <ModuleRoute module="billing">
                  {routeSuspense(<BillingPage />, "billing")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.fiscal}
              element={
                <ModuleRoute module="fiscal">
                  {routeSuspense(<FiscalPage />, "fiscal")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.commercialLeadsAlias}
              element={<CommercialLeadsAliasRedirect />}
            />
            <Route
              path={routePaths.commercial}
              element={
                <ModuleRoute module="commercial">
                  {routeSuspense(<CommercialPage />, "commercial")}
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.marketing}
              element={
                <ModuleRoute module="marketing">
                  {routeSuspense(<MarketingPage />, "marketing")}
                </ModuleRoute>
              }
            />

            {/* Settings — nested routes com layout compartilhado */}
            <Route
              path={routePaths.settings}
              element={
                <ModuleRoute module="settings">
                  {routeSuspense(<SettingsShellPage />, "settings")}
                </ModuleRoute>
              }
            >
              <Route index element={routeSuspense(<GeneralSettingsPage />, "settings")} />
              <Route path="workflow-states" element={routeSuspense(<WorkflowStatesSettingsPage />, "settings")} />
              <Route path="item-types" element={routeSuspense(<WorkItemEditorSettingsPage />, "settings")} />
              <Route path="audit" element={routeSuspense(<WorkspaceAuditSettingsPage />, "settings")} />
              <Route path="custom-fields" element={<Navigate replace to="../item-types" />} />
              {/* Editor de board: substitui Perspectivas + Colunas */}
              <Route path="perspectives" element={routeSuspense(<BoardEditorSettingsPage />, "settings")} />
              <Route path="columns" element={<Navigate replace to="perspectives" />} />
              {/* Aliases de rotas pre-existentes */}
              <Route path="members" element={routeSuspense(<MembersSettingsPage />, "settings")} />
              <Route path="workflow" element={routeSuspense(<WorkflowStatesSettingsPage />, "settings")} />
            </Route>

            <Route path="*" element={<Navigate replace to={routePaths.workspaceEntry} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}



