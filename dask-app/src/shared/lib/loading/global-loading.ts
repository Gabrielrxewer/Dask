export type GlobalLoadingSource = "auth" | "request" | "route" | "workspace";

export interface GlobalLoadingOptions {
  label?: string;
  source?: GlobalLoadingSource;
}

interface GlobalLoadingBridge {
  begin: (options?: GlobalLoadingOptions) => () => void;
  releaseInitial: () => void;
}

let globalLoadingBridge: GlobalLoadingBridge | null = null;

export function setGlobalLoadingBridge(bridge: GlobalLoadingBridge | null): void {
  globalLoadingBridge = bridge;
}

export function beginGlobalLoading(options?: GlobalLoadingOptions): () => void {
  if (!globalLoadingBridge) {
    return () => undefined;
  }

  return globalLoadingBridge.begin(options);
}

export function releaseInitialGlobalLoading(): void {
  globalLoadingBridge?.releaseInitial();
}

export async function trackGlobalLoading<T>(
  promise: Promise<T>,
  options?: GlobalLoadingOptions
): Promise<T> {
  const stopLoading = beginGlobalLoading(options);

  try {
    return await promise;
  } finally {
    stopLoading();
  }
}
