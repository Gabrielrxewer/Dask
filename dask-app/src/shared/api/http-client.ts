const BASE_LATENCY_MS = 280;

interface MockResponse<T> {
  ok: boolean;
  data: T;
}

export async function mockRequest<T>(payload: T): Promise<MockResponse<T>> {
  await new Promise(resolve => setTimeout(resolve, BASE_LATENCY_MS));
  return { ok: true, data: payload };
}
