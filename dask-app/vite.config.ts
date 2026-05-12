import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(() => {
  const rawBasePath = process.env.VITE_BASE_PATH || "/";
  const normalizedBasePath = rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`;

  return {
    base: normalizedBasePath,
    plugins: [react()],
    server: {
      allowedHosts: ["host.docker.internal"]
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            const nodeModulesPath = normalizedId.split("/node_modules/")[1];

            if (!nodeModulesPath) {
              return undefined;
            }

            const [scopeOrPackage, scopedPackage] = nodeModulesPath.split("/");
            const packageName = scopeOrPackage.startsWith("@")
              ? `${scopeOrPackage}/${scopedPackage}`
              : scopeOrPackage;

            if (
              [
                "@remix-run/router",
                "react",
                "react-dom",
                "react-router",
                "react-router-dom",
                "scheduler",
                "use-sync-external-store"
              ].includes(packageName)
            ) {
              return "vendor-react";
            }

            if (packageName.startsWith("@xyflow/")) return "vendor-flow";
            if (packageName.startsWith("@dnd-kit/")) return "vendor-dnd";
            if (packageName.startsWith("@tanstack/")) return "vendor-tanstack";
            if (packageName.startsWith("@radix-ui/") || packageName.startsWith("@floating-ui/")) {
              return "vendor-radix";
            }
            if (packageName === "react-markdown" || packageName.startsWith("remark-")) {
              return "vendor-markdown";
            }
            if (packageName === "react-hook-form" || packageName === "@hookform/resolvers") {
              return "vendor-forms";
            }
            if (packageName === "react-day-picker" || packageName === "date-fns") {
              return "vendor-dates";
            }
            if (packageName === "lucide-react" || packageName === "sonner") {
              return "vendor-ui";
            }
            if (packageName === "zod") {
              return "vendor-validation";
            }

            return "vendor";
          }
        }
      }
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    }
  };
});
