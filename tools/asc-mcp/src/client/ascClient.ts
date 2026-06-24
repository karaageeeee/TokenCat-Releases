import { loadConfig, type AscConfig } from "../config.js";
import { TokenProvider } from "../auth/jwt.js";

export const ASC_BASE_URL = "https://api.appstoreconnect.apple.com";

/** A single error from a JSON:API error response. */
export interface AscApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
}

/** Thrown for any non-2xx response from the App Store Connect API. */
export class AscRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errors: AscApiError[] = [],
  ) {
    super(message);
    this.name = "AscRequestError";
  }
}

export interface RequestOptions {
  method?: string;
  /** Query parameters; arrays are joined with commas (JSON:API style). */
  query?: Record<string, string | number | boolean | string[] | undefined>;
  /** JSON request body (for POST/PATCH/DELETE). */
  body?: unknown;
  /** Override the default JSON content type (used by the upload helper). */
  headers?: Record<string, string>;
}

export interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders?: Array<{ name: string; value: string }>;
}

/**
 * Thin client over the App Store Connect API.
 *
 * Construction is cheap and does not read credentials — config is loaded lazily
 * on the first request, so `tools/list` works without any API key configured.
 *
 * Tool modules should depend only on the public methods here:
 *   - `request<T>()` for JSON:API calls
 *   - `paginate<T>()` to auto-follow cursor pagination
 *   - `uploadAsset()` to run the reserve→PUT→commit flow used by screenshots
 *     and previews
 */
export class AscClient {
  private tokenProvider: TokenProvider | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly configLoader: () => AscConfig;

  constructor(opts?: {
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    configLoader?: () => AscConfig;
  }) {
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.baseUrl = opts?.baseUrl ?? ASC_BASE_URL;
    this.configLoader = opts?.configLoader ?? (() => loadConfig());
  }

  private async authHeader(): Promise<string> {
    if (!this.tokenProvider) {
      this.tokenProvider = new TokenProvider(this.configLoader());
    }
    return `Bearer ${await this.tokenProvider.getToken()}`;
  }

  /**
   * Make a single JSON:API request. `path` may be a relative API path
   * (e.g. "/v1/apps") or an absolute URL (e.g. a pagination `next` link).
   * Retries once on HTTP 429 honoring Retry-After.
   */
  async request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const method = opts.method ?? "GET";

    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = {
        Authorization: await this.authHeader(),
        Accept: "application/json",
        ...opts.headers,
      };
      let bodyInit: string | undefined;
      if (opts.body !== undefined) {
        headers["Content-Type"] ??= "application/json";
        bodyInit = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
      }

      const res = await this.fetchImpl(url, { method, headers, body: bodyInit });

      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status === 204) return undefined as T;

      const text = await res.text();
      const parsed = text ? safeJsonParse(text) : undefined;

      if (!res.ok) {
        const errors: AscApiError[] = Array.isArray((parsed as { errors?: AscApiError[] })?.errors)
          ? (parsed as { errors: AscApiError[] }).errors
          : [];
        const detail = errors.map((e) => e.detail ?? e.title).filter(Boolean).join("; ");
        throw new AscRequestError(
          `App Store Connect API ${res.status} for ${method} ${url}` +
            (detail ? `: ${detail}` : ""),
          res.status,
          errors,
        );
      }

      return parsed as T;
    }
  }

  /**
   * Follow JSON:API cursor pagination, concatenating every page's `data` array.
   * `pageLimit` caps the number of pages fetched (default 50) as a safety net.
   */
  async paginate<T = unknown>(
    path: string,
    opts: RequestOptions = {},
    pageLimit = 50,
  ): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = this.buildUrl(path, opts.query);
    let firstOpts: RequestOptions | undefined = { ...opts, query: undefined };
    for (let page = 0; next && page < pageLimit; page++) {
      const res: { data?: T[]; links?: { next?: string } } = await this.request(next, firstOpts);
      firstOpts = undefined;
      if (Array.isArray(res?.data)) out.push(...res.data);
      next = res?.links?.next;
    }
    return out;
  }

  /**
   * Run the App Store Connect asset upload flow used by screenshots and
   * previews:
   *   1. caller has already created the reservation and passes its
   *      `uploadOperations`;
   *   2. this method PUTs each chunk of `data` to the right byte range;
   * The caller is responsible for the final commit PATCH (it differs per asset
   * type) and for computing the MD5 `sourceFileChecksum`.
   */
  async uploadAsset(operations: UploadOperation[], data: Buffer | Uint8Array): Promise<void> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    for (const op of operations) {
      const headers: Record<string, string> = {};
      for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
      const chunk = buf.subarray(op.offset, op.offset + op.length);
      const res = await this.fetchImpl(op.url, {
        method: op.method,
        headers,
        body: chunk,
      });
      if (!res.ok) {
        throw new AscRequestError(
          `Asset upload chunk failed (${res.status}) at offset ${op.offset}`,
          res.status,
        );
      }
    }
  }

  private buildUrl(
    path: string,
    query?: RequestOptions["query"],
  ): string {
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
    }
    return url.toString();
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
