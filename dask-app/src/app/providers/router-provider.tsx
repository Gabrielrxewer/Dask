import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "@/app/router";

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
      <AppRoutes />
    </BrowserRouter>
  );
}
