import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GlobalLayout } from "@/app/layout";
import { ProtectedRoute, PublicRoute, SubscribedRoute } from "@/features/auth";
import { BillingProvider } from "@/app/providers/billing-provider";
import { WorkspaceProvider, workspaceService } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { LoadingState } from "@/shared/ui";
import {
  AutomationsPage,
  BillingCancelPage,
  BillingSuccessPage,
  BoardPage,
  ChoosePlanPage,
  ColumnsSettingsPage,
  CustomFieldsSettingsPage,
  GeneralSettingsPage,
  HomePage,
  ItemTypesSettingsPage,
  ListPage,
  LoginPage,
  NoWorkspacePage,
  PlatformAdminPage,
  PerspectivesSettingsPage,
  ResetPasswordPage,
  SettingsShellPage,
  SubscriptionBlockedPage,
  TimelinePage,
  VerifyEmailPage,
  WorkflowStatesSettingsPage
} from "@/pages";
import { buildWorkspaceBoardPath, routePaths } from "@/app/router";

function WorkspaceBoundary() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
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
    return <LoadingState text="Carregando workspaces..." />;
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
            <Route path={routePaths.noWorkspace} element={<NoWorkspacePage />} />
            <Route path={routePaths.board} element={<BoardPage />} />
            <Route path={routePaths.list} element={<ListPage />} />
            <Route path={routePaths.timeline} element={<TimelinePage />} />
            <Route path={routePaths.automations} element={<AutomationsPage />} />

            {/* Settings — nested routes com layout compartilhado */}
            <Route path={routePaths.settings} element={<SettingsShellPage />}>
              <Route index element={<GeneralSettingsPage />} />
              <Route path="workflow-states" element={<WorkflowStatesSettingsPage />} />
              <Route path="columns" element={<ColumnsSettingsPage />} />
              <Route path="item-types" element={<ItemTypesSettingsPage />} />
              <Route path="custom-fields" element={<CustomFieldsSettingsPage />} />
              <Route path="perspectives" element={<PerspectivesSettingsPage />} />
              {/* Aliases de rotas pre-existentes */}
              <Route path="members" element={<GeneralSettingsPage />} />
              <Route path="workflow" element={<WorkflowStatesSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate replace to={routePaths.workspaceEntry} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
