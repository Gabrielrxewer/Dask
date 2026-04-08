import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { PublicRoute, ProtectedRoute } from "@/features/auth";
import { WorkspaceProvider } from "@/modules/workspace";
import { BoardPage } from "@/pages/board-page";
import { ListPage } from "@/pages/list-page";
import { TimelinePage } from "@/pages/timeline-page";
import { AutomationsPage } from "@/pages/automations-page";
import { SettingsPage } from "@/pages/settings-page";
import { LoginPage } from "@/pages/login-page";

function getRouterBase(): string {
  const rawBase = import.meta.env.BASE_URL || "/";
  if (rawBase === "/") {
    return "/";
  }
  return rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
}

export function RouterProvider() {
  return (
    <BrowserRouter basename={getRouterBase()}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <WorkspaceProvider>
                <Outlet />
              </WorkspaceProvider>
            }
          >
            <Route path="/" element={<Navigate replace to="/board" />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/list" element={<ListPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/automations" element={<AutomationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to="/board" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
