import { describe, expect, it } from "vitest";
import { AscClient, AscRequestError } from "./ascClient.js";
import { makeFetchStub, makeTestConfig } from "../../test/fetchStub.js";

async function makeClient(
  responder: Parameters<typeof makeFetchStub>[0],
): Promise<{ client: AscClient; requests: ReturnType<typeof makeFetchStub>["requests"] }> {
  const config = await makeTestConfig();
  const { fetchImpl, requests } = makeFetchStub(responder);
  const client = new AscClient({ fetchImpl, configLoader: () => config });
  return { client, requests };
}

describe("AscClient.request", () => {
  it("sends a bearer token and serializes query params (arrays comma-joined)", async () => {
    const { client, requests } = await makeClient(() => ({ json: { data: [{ id: "1" }] } }));
    await client.request("/v1/apps", {
      query: { limit: 5, "fields[apps]": ["name", "bundleId"] },
    });

    expect(requests).toHaveLength(1);
    const req = requests[0];
    expect(req.headers.authorization).toMatch(/^Bearer .+\..+\..+$/);
    expect(req.url).toContain("/v1/apps");
    expect(req.url).toContain("limit=5");
    expect(decodeURIComponent(req.url)).toContain("fields[apps]=name,bundleId");
  });

  it("serializes a JSON body for POST and sets content-type", async () => {
    const { client, requests } = await makeClient(() => ({ status: 201, json: { data: {} } }));
    await client.request("/v1/appStoreVersions", {
      method: "POST",
      body: { data: { type: "appStoreVersions" } },
    });
    const req = requests[0];
    expect(req.method).toBe("POST");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(req.body!)).toEqual({ data: { type: "appStoreVersions" } });
  });

  it("returns undefined for 204 No Content", async () => {
    const { client } = await makeClient(() => ({ status: 204 }));
    await expect(client.request("/v1/appScreenshots/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws AscRequestError with parsed error details on non-2xx", async () => {
    const { client } = await makeClient(() => ({
      status: 409,
      json: { errors: [{ status: "409", detail: "State not allowed" }] },
    }));
    await expect(client.request("/v1/apps")).rejects.toMatchObject({
      name: "AscRequestError",
      statusCode: 409,
    });
    await expect(client.request("/v1/apps")).rejects.toThrow(/State not allowed/);
  });

  it("retries once on HTTP 429 then succeeds", async () => {
    let calls = 0;
    const { client, requests } = await makeClient(() => {
      calls++;
      return calls === 1
        ? { status: 429, headers: { "retry-after": "0" } }
        : { json: { data: [] } };
    });
    const res = await client.request<{ data: unknown[] }>("/v1/apps");
    expect(res.data).toEqual([]);
    expect(requests.length).toBe(2);
  });
});

describe("AscClient.paginate", () => {
  it("follows links.next and concatenates data across pages", async () => {
    const { client } = await makeClient((req) => {
      if (req.url.includes("cursor=PAGE2")) {
        return { json: { data: [{ id: "3" }] } };
      }
      return {
        json: {
          data: [{ id: "1" }, { id: "2" }],
          links: { next: "https://api.appstoreconnect.apple.com/v1/apps?cursor=PAGE2" },
        },
      };
    });
    const all = await client.paginate<{ id: string }>("/v1/apps");
    expect(all.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });
});

describe("AscClient.uploadAsset", () => {
  it("PUTs each chunk to its operation URL with the given headers", async () => {
    const { client, requests } = await makeClient(() => ({ status: 200 }));
    const data = Buffer.from("hello world");
    await client.uploadAsset(
      [
        {
          method: "PUT",
          url: "https://upload.example/part1",
          offset: 0,
          length: 5,
          requestHeaders: [{ name: "Content-Type", value: "image/png" }],
        },
        { method: "PUT", url: "https://upload.example/part2", offset: 5, length: 6 },
      ],
      data,
    );
    expect(requests.map((r) => r.url)).toEqual([
      "https://upload.example/part1",
      "https://upload.example/part2",
    ]);
    expect(requests[0].headers["content-type"]).toBe("image/png");
  });

  it("throws if a chunk upload fails", async () => {
    const { client } = await makeClient(() => ({ status: 500 }));
    await expect(
      client.uploadAsset(
        [{ method: "PUT", url: "https://upload.example/p", offset: 0, length: 1 }],
        Buffer.from("x"),
      ),
    ).rejects.toBeInstanceOf(AscRequestError);
  });
});
