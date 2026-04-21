import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { setGlobalLoadingBridge, type GlobalLoadingOptions } from "@/shared/lib/loading/global-loading";
import { cn } from "@/shared/lib/cn";
import "./global-loading-provider.css";

interface GlobalLoadingContextValue {
  isVisible: boolean;
}

interface LoadingEntry {
  id: number;
  label: string;
}

interface GlobalLoadingProviderProps {
  children: ReactNode;
}

const SHOW_DELAY_MS = 220;
const MIN_VISIBLE_MS = 420;
const HIDE_GRACE_MS = 260;
const DEFAULT_LABEL = "Carregando dados do workspace";
const INITIAL_ENTRY_ID = -1;

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: GlobalLoadingProviderProps) {
  const [entries, setEntries] = useState<LoadingEntry[]>([
    {
      id: INITIAL_ENTRY_ID,
      label: "Preparando a experiencia do Dask"
    }
  ]);
  const [isVisible, setIsVisible] = useState(true);
  const nextEntryId = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number | null>(Date.now());

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (entries.length > 0) {
      clearHideTimer();

      if (!isVisible && showTimerRef.current === null) {
        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null;
          visibleSinceRef.current = Date.now();
          setIsVisible(true);
        }, SHOW_DELAY_MS);
      }

      return undefined;
    }

    clearShowTimer();

    if (!isVisible) {
      return undefined;
    }

    const visibleFor = visibleSinceRef.current === null ? MIN_VISIBLE_MS : Date.now() - visibleSinceRef.current;
    const remainingVisibleTime = Math.max(0, MIN_VISIBLE_MS - visibleFor) + HIDE_GRACE_MS;

    hideTimerRef.current = window.setTimeout(() => {
      visibleSinceRef.current = null;
      hideTimerRef.current = null;
      setIsVisible(false);
    }, remainingVisibleTime);

    return undefined;
  }, [clearHideTimer, clearShowTimer, entries.length, isVisible]);

  useEffect(() => {
    setGlobalLoadingBridge({
      begin: (options?: GlobalLoadingOptions) => {
        const id = nextEntryId.current++;
        setEntries(currentEntries => [
          ...currentEntries,
          {
            id,
            label: options?.label?.trim() || DEFAULT_LABEL
          }
        ]);

        return () => {
          setEntries(currentEntries => currentEntries.filter(currentEntry => currentEntry.id !== id));
        };
      },
      releaseInitial: () => {
        setEntries(currentEntries => currentEntries.filter(currentEntry => currentEntry.id !== INITIAL_ENTRY_ID));
      }
    });

    return () => {
      setGlobalLoadingBridge(null);
      clearShowTimer();
      clearHideTimer();
    };
  }, [clearHideTimer, clearShowTimer]);

  const topEntry = entries[entries.length - 1] ?? null;

  const value = useMemo<GlobalLoadingContextValue>(
    () => ({
      isVisible
    }),
    [isVisible]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <div
        className={cn("global-loading-overlay", isVisible && "global-loading-overlay--visible")}
        aria-hidden={!isVisible}
      >
        <div className="global-loading-overlay__backdrop" />
        <div className="global-loading-overlay__panel" role="status" aria-live="polite">
          <div className="global-loading-overlay__orbital" aria-hidden="true">
            <div className="global-loading-overlay__orbital-ring">
              <span className="global-loading-overlay__orbital-dot" />
            </div>
            <div className="global-loading-overlay__orbital-core" />
          </div>

          <div className="global-loading-overlay__copy">
            <strong>Atualizando interface</strong>
            <p>{topEntry?.label ?? DEFAULT_LABEL}</p>
          </div>

          <div className="global-loading-overlay__skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading(): GlobalLoadingContextValue {
  const context = useContext(GlobalLoadingContext);

  if (!context) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }

  return context;
}
