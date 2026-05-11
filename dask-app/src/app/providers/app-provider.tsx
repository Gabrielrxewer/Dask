import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@/app/providers/router-provider";
import { AuthProvider } from "@/app/providers/auth-provider";
import { queryClient } from "@/shared/api/query-client";
import { GlobalLoadingProvider } from "@/shared/ui/global-loading/global-loading-provider";
import { AppToaster } from "@/shared/ui/toast";

export function AppProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoadingProvider>
        <AuthProvider>
          <RouterProvider />
          <AppToaster />
        </AuthProvider>
      </GlobalLoadingProvider>
    </QueryClientProvider>
  );
}
