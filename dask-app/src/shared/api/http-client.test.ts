import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, setHttpAuthBridge } from "@/shared/api/http-client";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

afterEach(() => {
  setHttpAuthBridge(null);
  vi.restoreAllMocks();
});

describe("apiClient auth handling", () => {
  it("retries once after refresh and replays the request with new token", async () => {
    let token = "old-token";
    const refreshAccessToken = vi.fn(async () => {
      token = "new-token";
      return token;
    });
    const handleUnauthorized = vi.fn();

    setHttpAuthBridge({
      getAccessToken: () => token,
      refreshAccessToken,
      handleUnauthorized
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { value: 42 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.get<{ value: number }>("/secure/data", {
      authMode: "required"
    });

    expect(result.value).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("marks session unauthorized when refresh fails", async () => {
    const refreshAccessToken = vi.fn(async () => null);
    const handleUnauthorized = vi.fn();

    setHttpAuthBridge({
      getAccessToken: () => "old-token",
      refreshAccessToken,
      handleUnauthorized
    });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: "expired" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.get("/secure/data", {
        authMode: "required"
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("prevents infinite refresh loops by retrying only once", async () => {
    const refreshAccessToken = vi.fn(async () => "new-token");
    const handleUnauthorized = vi.fn();

    setHttpAuthBridge({
      getAccessToken: () => "old-token",
      refreshAccessToken,
      handleUnauthorized
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { message: "still expired" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.get("/secure/data", {
        authMode: "required"
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
