import { RouterProvider } from "@/app/providers/router-provider";
import { AuthProvider } from "@/app/providers/auth-provider";
import { GlobalLoadingProvider } from "@/shared/ui/global-loading/global-loading-provider";

export function AppProvider() {
  return (
    <GlobalLoadingProvider>
      <AuthProvider>
        <RouterProvider />
      </AuthProvider>
    </GlobalLoadingProvider>
  );
}
