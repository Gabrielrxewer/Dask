import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GlobalLayout } from "@/app/layout";
import { ProtectedRoute, PublicRoute } from "@/features/auth";
import { WorkspaceProvider } from "@/modules/workspace";
import {
  AutomationsPage,
  BoardPage,
  ListPage,
  LoginPage,
  SettingsPage,
  TimelinePage
} from "@/pages";
import { routePaths } from "@/app/router";

function WorkspaceBoundary() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route
          path={routePaths.login}
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceBoundary />}>
            <Route path={routePaths.root} element={<Navigate replace to={routePaths.board} />} />
            <Route path={routePaths.board} element={<BoardPage />} />
            <Route path={routePaths.list} element={<ListPage />} />
            <Route path={routePaths.timeline} element={<TimelinePage />} />
            <Route path={routePaths.automations} element={<AutomationsPage />} />
            <Route path={routePaths.settings} element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to={routePaths.board} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
