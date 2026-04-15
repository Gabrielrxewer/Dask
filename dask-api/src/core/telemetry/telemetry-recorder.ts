export type TelemetryEventInput = {
  category: string;
  eventName: string;
  success?: boolean;
  userId?: string | null;
  workspaceId?: string | null;
  method?: string | null;
  route?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  durationNs?: bigint | null;
  reason?: string | null;
  provider?: string | null;
  ipHash?: string | null;
  country?: string | null;
  city?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
};

type TelemetryRecorder = (event: TelemetryEventInput) => Promise<void>;

let recorder: TelemetryRecorder | null = null;

export function setTelemetryRecorder(nextRecorder: TelemetryRecorder | null): void {
  recorder = nextRecorder;
}

export async function recordTelemetryEvent(event: TelemetryEventInput): Promise<void> {
  if (!recorder) {
    return;
  }

  try {
    await recorder(event);
  } catch {
    // Telemetry is best-effort and must never block product execution.
  }
}
