import { describe, expect, it } from "vitest";
import defs from "./appinfo.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("appinfo tools", () => {
  it("asc_get_appinfo_localizations lists localizations", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "l1", attributes: { locale: "en-US", name: "TokenCat", subtitle: "Token timer cat" } }] },
    }));
    const res = (await run(getTool(defs, "asc_get_appinfo_localizations"), { appInfoId: "i1" })) as {
      localizations: Array<{ id: string; name?: string }>;
    };
    expect(res.localizations[0]).toMatchObject({ id: "l1", name: "TokenCat" });
    expect(requests[0].url).toContain("/v1/appInfos/i1/appInfoLocalizations");
  });

  it("asc_update_appinfo_localization PATCHes provided fields only", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: { id: "l1", attributes: { locale: "ja" } } },
    }));
    const res = (await run(getTool(defs, "asc_update_appinfo_localization"), {
      localizationId: "l1",
      subtitle: "トークン残量ねこ",
    })) as { updated: string[] };
    expect(res.updated).toEqual(["subtitle"]);
    const body = JSON.parse(requests[0].body!);
    expect(requests[0].method).toBe("PATCH");
    expect(body.data).toMatchObject({ type: "appInfoLocalizations", id: "l1" });
    expect(body.data.attributes).toEqual({ subtitle: "トークン残量ねこ" });
  });

  it("rejects empty updates", async () => {
    const { run } = await makeToolRig(() => ({ json: {} }));
    await expect(
      run(getTool(defs, "asc_update_appinfo_localization"), { localizationId: "l1" }),
    ).rejects.toThrow(/at least one field/);
  });
});
