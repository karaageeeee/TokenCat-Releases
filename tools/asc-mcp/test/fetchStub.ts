import type { AscConfig } from "../src/config.js";

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface StubResponse {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

/**
 * Build a `fetch` stub for `AscClient` tests. Pass a responder that maps each
 * request to a canned response; every call is recorded in `requests`.
 *
 * Usage:
 *   const { fetchImpl, requests } = makeFetchStub((req) => ({ json: { data: [] } }));
 *   const client = new AscClient({ fetchImpl, configLoader: () => testConfig });
 */
export function makeFetchStub(
  responder: (req: RecordedRequest, callIndex: number) => StubResponse,
): { fetchImpl: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  let callIndex = 0;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers as Record<string, string>) ?? {})) {
      headers[k.toLowerCase()] = v;
    }
    const recorded: RecordedRequest = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    requests.push(recorded);

    const r = responder(recorded, callIndex++);
    const status = r.status ?? 200;
    const bodyText = r.text ?? (r.json !== undefined ? JSON.stringify(r.json) : "");
    return new Response(status === 204 ? null : bodyText, {
      status,
      headers: r.headers ?? { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { fetchImpl, requests };
}

/** A throwaway config whose private key is a freshly generated EC P-256 key. */
export async function makeTestConfig(): Promise<AscConfig> {
  const { generateKeyPair, exportPKCS8 } = await import("jose");
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  return {
    keyId: "TESTKEY123",
    issuerId: "11111111-2222-3333-4444-555555555555",
    privateKey: await exportPKCS8(privateKey),
  };
}
