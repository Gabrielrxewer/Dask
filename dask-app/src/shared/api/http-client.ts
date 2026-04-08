const BASE_LATENCY_MS = 220;

export async function withMockLatency<T>(payload: T, latencyMs = BASE_LATENCY_MS): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, latencyMs));
  return payload;
}

export interface MockResponse<T> {
  ok: boolean;
  data: T;
}

export async function mockRequest<T>(payload: T): Promise<MockResponse<T>> {
  const data = await withMockLatency(payload);
  return { ok: true, data };
}
