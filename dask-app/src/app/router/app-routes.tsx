import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { GlobalLayout } from "@/app/layout";
import { ProtectedRoute, PublicRoute, SubscribedRoute } from "@/features/auth";
import { BillingProvider } from "@/app/providers/billing-provider";
import { WorkspaceProvider, useWorkspace, workspaceService } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { LoadingState } from "@/shared/ui";
import {
  AiAgentsPage,
  AutomationsPage,
  AgendaPage,
  BillingPage,
  BillingCancelPage,
  BillingSuccessPage,
  BoardPage,
  BoardEditorSettingsPage,
  ChoosePlanPage,
  DocumentationPage,
  GeneralSettingsPage,
  HomePage,
  LeadsPage,
  MarketingPage,
  ListPage,
  LoginPage,
  FiscalPage,
  MembersSettingsPage,
  NoWorkspacePage,
  PlatformAdminPage,
  ProposalPublicPage,
  ResetPasswordPage,
  SettingsShellPage,
  WorkItemEditorSettingsPage,
  SubscriptionBlockedPage,
  TermsOfUsePage,
  TimelinePage,
  WorkspaceSelectorPage,
  VerifyEmailPage,
  PrivacyPolicyPage,
  WorkflowStatesSettingsPage
} from "@/pages";
import { buildWorkspaceBoardPath, buildWorkspaceSettingsPath, routePaths } from "@/app/router";

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

function ModuleRoute({
  module,
  children
}: {
  module: "board" | "automation" | "documentation" | "ai" | "settings" | "fiscal" | "leads" | "marketing";
  children: JSX.Element;
}) {
  const { snapshot } = useWorkspace();
  const location = useLocation();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const allowedModules = new Set(
    snapshot?.access?.allowedModules ?? ["board", "automation", "documentation", "ai", "settings", "fiscal", "leads", "marketing"]
  );
  const isCorporateWorkspace = snapshot?.workspace?.kind === "CORPORATE";
  const needsCompanyProfile = isCorporateWorkspace && !hasRequiredCompanyProfile(snapshot?.preferences.settings);
  const isSettingsRoute = workspaceSlug.length > 0 && location.pathname.startsWith(buildWorkspaceSettingsPath(workspaceSlug));

  if (needsCompanyProfile && module !== "settings" && !isSettingsRoute) {
    return <Navigate replace to={buildWorkspaceSettingsPath(workspaceSlug)} />;
  }

  if (!allowedModules.has(module)) {
    return <Navigate replace to={routePaths.board} />;
  }

  return children;
}

function WorkspaceEntryRedirect() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    workspaceService
      .listWorkspaces()
      .then((workspaces) => {
        if (!active) {
          return;
        }

        const fallbackWorkspace = workspaces[0];
        if (!fallbackWorkspace) {
          setRedirectTo(routePaths.noWorkspace);
          return;
        }

        if (workspaces.length > 1) {
          setRedirectTo(routePaths.workspaceSelector);
          return;
        }

        setRedirectTo(buildWorkspaceBoardPath(fallbackWorkspace.slug));
      })
        .catch((error) => {
          if (active) {
            if (isApiError(error)) {
              if (error.status === 401) {
                setRedirectTo(routePaths.login);
                return;
              }
              if (error.status === 403) {
                // Authenticated user without active subscription should go to plan selection.
                setRedirectTo(routePaths.choosePlan);
                return;
              }
            }

            setRedirectTo(routePaths.noWorkspace);
          }
        });

    return () => {
      active = false;
    };
  }, []);

  if (!redirectTo) {
    return <LoadingState text="Carregando workspaces..." animation="workspace" />;
  }

  return <Navigate replace to={redirectTo} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route
          path={routePaths.home}
          element={<HomePage />}
        />

        <Route
          path={routePaths.login}
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/*
          Rota pública sem guard de sessão.
          O usuário chega aqui via link de e-mail — sem cookie de refresh válido.
        */}
        <Route path={routePaths.resetPassword} element={<ResetPasswordPage />} />
        <Route path={routePaths.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={routePaths.proposalPublic} element={<ProposalPublicPage />} />
        <Route path={routePaths.termsOfUse} element={<TermsOfUsePage />} />
        <Route path={routePaths.privacyPolicy} element={<PrivacyPolicyPage />} />

        {/* Billing routes — authenticated but subscription not required */}
        <Route element={<ProtectedRoute />}>
          <Route path={routePaths.admin} element={<PlatformAdminPage />} />
          <Route element={<BillingProvider />}>
            <Route path={routePaths.choosePlan} element={<ChoosePlanPage />} />
            <Route path={routePaths.billingSuccess} element={<BillingSuccessPage />} />
            <Route path={routePaths.billingCancel} element={<BillingCancelPage />} />
            <Route path={routePaths.subscriptionBlocked} element={<SubscriptionBlockedPage />} />
          </Route>
        </Route>

        {/* Platform routes — require active subscription */}
        <Route element={<SubscribedRoute />}>
          <Route element={<WorkspaceBoundary />}>
            <Route path={routePaths.workspaceEntry} element={<WorkspaceEntryRedirect />} />
            <Route path={routePaths.workspaceSelector} element={<WorkspaceSelectorPage />} />
            <Route path={routePaths.noWorkspace} element={<NoWorkspacePage />} />
            <Route path={routePaths.board} element={<BoardPage />} />
            <Route path={routePaths.list} element={<ListPage />} />
            <Route path={routePaths.timeline} element={<TimelinePage />} />
            <Route path={routePaths.agenda} element={<AgendaPage />} />
            <Route
              path={routePaths.documentation}
              element={
                <ModuleRoute module="documentation">
                  <DocumentationPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.aiAgents}
              element={
                <ModuleRoute module="ai">
                  <AiAgentsPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.automations}
              element={
                <ModuleRoute module="automation">
                  <AutomationsPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.billing}
              element={
                <ModuleRoute module="settings">
                  <BillingPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.fiscal}
              element={
                <ModuleRoute module="fiscal">
                  <FiscalPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.leads}
              element={
                <ModuleRoute module="leads">
                  <LeadsPage />
                </ModuleRoute>
              }
            />
            <Route
              path={routePaths.marketing}
              element={
                <ModuleRoute module="marketing">
                  <MarketingPage />
                </ModuleRoute>
              }
            />

            {/* Settings — nested routes com layout compartilhado */}
            <Route
              path={routePaths.settings}
              element={
                <ModuleRoute module="settings">
                  <SettingsShellPage />
                </ModuleRoute>
              }
            >
              <Route index element={<GeneralSettingsPage />} />
              <Route path="workflow-states" element={<WorkflowStatesSettingsPage />} />
              <Route path="item-types" element={<WorkItemEditorSettingsPage />} />
              <Route path="custom-fields" element={<Navigate replace to="../item-types" />} />
              {/* Editor de board: substitui Perspectivas + Colunas */}
              <Route path="perspectives" element={<BoardEditorSettingsPage />} />
              <Route path="columns" element={<Navigate replace to="perspectives" />} />
              {/* Aliases de rotas pre-existentes */}
              <Route path="members" element={<MembersSettingsPage />} />
              <Route path="workflow" element={<WorkflowStatesSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate replace to={routePaths.workspaceEntry} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}



