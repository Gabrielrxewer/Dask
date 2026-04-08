import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface GlobalChromeContextValue {
  isSidebarCollapsed: boolean;
  isSidebarOpen: boolean;
  toggleNavigation: () => void;
  closeNavigation: () => void;
}

const defaultValue: GlobalChromeContextValue = {
  isSidebarCollapsed: false,
  isSidebarOpen: false,
  toggleNavigation: () => undefined,
  closeNavigation: () => undefined
};

const GlobalChromeContext = createContext<GlobalChromeContextValue>(defaultValue);

export function GlobalChromeProvider({
  value,
  children
}: {
  value: GlobalChromeContextValue;
  children: ReactNode;
}) {
  return <GlobalChromeContext.Provider value={value}>{children}</GlobalChromeContext.Provider>;
}

export function useGlobalChrome(): GlobalChromeContextValue {
  return useContext(GlobalChromeContext);
}
