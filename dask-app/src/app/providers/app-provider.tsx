import { RouterProvider } from "@/app/providers/router-provider";
import { WorkspaceProvider } from "@/modules/workspace";

export function AppProvider() {
  return (
    <WorkspaceProvider>
      <RouterProvider />
    </WorkspaceProvider>
  );
}
