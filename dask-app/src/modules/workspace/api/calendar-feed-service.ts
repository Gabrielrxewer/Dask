import type { CalendarFeedSnapshot } from "@/modules/workspace/model/types";

const DEFAULT_FEED: CalendarFeedSnapshot = {
  events: [],
  integrations: [
    { provider: "teams", isConnected: false, canImportMeetings: true, lastSyncAt: null },
    { provider: "google-calendar", isConnected: false, canImportMeetings: true, lastSyncAt: null },
    { provider: "outlook-calendar", isConnected: false, canImportMeetings: true, lastSyncAt: null }
  ]
};

export const calendarFeedService = {
  async listFeed(
    _workspaceSlug: string,
    _input: { startAt: string; endAt: string }
  ): Promise<CalendarFeedSnapshot> {
    // Placeholder para futura integracao (Teams/Google/Outlook).
    return DEFAULT_FEED;
  }
};
