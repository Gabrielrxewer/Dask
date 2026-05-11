import { describe, expect, it } from "vitest";
import { fiscalQueryKeys } from "./fiscal-query-keys";

describe("fiscalQueryKeys", () => {
  it("includes cursor pagination params for issued documents", () => {
    const key = fiscalQueryKeys.documents("workspace-1", {
      direction: "OUTBOUND",
      pageSize: 50,
      cursor: "cursor-2"
    });

    expect(key).toEqual([
      "fiscal",
      "workspace-1",
      "documents",
      {
        direction: "OUTBOUND",
        pageSize: 50,
        cursor: "cursor-2"
      }
    ]);
  });

  it("includes cursor pagination params for received documents, drafts and sync runs", () => {
    const receivedKey = fiscalQueryKeys.receivedDocuments("workspace-1", { pageSize: 25, cursor: "received-2" });
    const draftsKey = fiscalQueryKeys.drafts("workspace-1", { pageSize: 25, cursor: "draft-2" });
    const syncRunsKey = fiscalQueryKeys.syncRuns("workspace-1", { pageSize: 25, cursor: "sync-2" });

    expect(receivedKey[receivedKey.length - 1]).toEqual({
      pageSize: 25,
      cursor: "received-2"
    });
    expect(draftsKey[draftsKey.length - 1]).toEqual({
      pageSize: 25,
      cursor: "draft-2"
    });
    expect(syncRunsKey[syncRunsKey.length - 1]).toEqual({
      pageSize: 25,
      cursor: "sync-2"
    });
  });
});
