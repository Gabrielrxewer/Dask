export interface AdminTelemetryOverview {
  users: {
    total: number;
    verified: number;
    lockedNow: number;
    platformAdmins: number;
    activeByPeriod: {
      day: number;
      week: number;
      month: number;
    };
  };
  auth: {
    loginByPeriod: {
      day: number;
      week: number;
      month: number;
    };
    channel: {
      password: number;
      social: number;
    };
    failedLoginReasons24h: Array<{
      reason: string;
      attempts: number;
    }>;
    refreshFailures24h: number;
    logout24h: number;
    concurrentSessions: {
      max: number;
      topUsers: Array<{
        user_id: string;
        sessions: number;
      }>;
    };
  };
  workspaces: {
    total: number;
  };
  traffic: {
    timezone: string;
    peakHours24h: Array<{
      hour: number;
      total: number;
    }>;
  };
  backend: {
    latency24h: {
      avgMs: number;
      p95Ms: number;
      p99Ms: number;
    };
    statusBuckets24h: Array<{
      bucket: string;
      total: number;
    }>;
  };
  product: {
    topDomainEvents7d: Array<{
      eventName: string;
      total: number;
    }>;
  };
  ai: {
    runs24h: number;
    failed24h: number;
    failureRate24h: number;
  };
  outbox: {
    pending: number;
    retryPending: number;
    deadLetter: number;
    oldestPendingAgeSeconds: number | null;
  };
}
