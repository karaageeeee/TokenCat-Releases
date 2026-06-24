import { describe, expect, it } from "vitest";
import defs from "./apps.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("apps tools", () => {
  it("asc_list_apps filters by bundleId and slims the response", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "123", attributes: { name: "TokenCat", bundleId: "com.tokencat.app" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_apps"), { bundleId: "com.tokencat.app" })) as {
      count: number;
      apps: Array<{ id: string; bundleId?: string }>;
    };
    expect(res.count).toBe(1);
    expect(res.apps[0]).toMatchObject({ id: "123", bundleId: "com.tokencat.app" });
    expect(decodeURIComponent(requests[0].url)).toContain("filter[bundleId]=com.tokencat.app");
  });

  it("asc_get_app fetches by id", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: { id: "123", attributes: { name: "TokenCat" } } },
    }));
    const res = (await run(getTool(defs, "asc_get_app"), { appId: "123" })) as { name?: string };
    expect(res.name).toBe("TokenCat");
    expect(requests[0].url).toContain("/v1/apps/123");
  });

  it("asc_get_app_info lists appInfo ids", async () => {
    const { run } = await makeToolRig(() => ({
      json: { data: [{ id: "info-1", attributes: { state: "PREPARE_FOR_SUBMISSION" } }] },
    }));
    const res = (await run(getTool(defs, "asc_get_app_info"), { appId: "123" })) as {
      appInfos: Array<{ id: string; state?: string }>;
    };
    expect(res.appInfos[0]).toMatchObject({ id: "info-1", state: "PREPARE_FOR_SUBMISSION" });
  });
});
