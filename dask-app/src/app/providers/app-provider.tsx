import { RouterProvider } from "@/app/providers/router-provider";
import { AuthProvider } from "@/app/providers/auth-provider";

export function AppProvider() {
  return (
    <AuthProvider>
      <RouterProvider />
    </AuthProvider>
  );
}
