import { describe, expect, it } from "vitest";
import defs from "./versions.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("versions tools", () => {
  it("asc_list_versions defaults to MAC_OS platform filter", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "v1", attributes: { versionString: "2.25", appStoreState: "PREPARE_FOR_SUBMISSION" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_versions"), { appId: "1" })) as {
      versions: Array<{ versionString?: string }>;
    };
    expect(res.versions[0].versionString).toBe("2.25");
    expect(decodeURIComponent(requests[0].url)).toContain("filter[platform]=MAC_OS");
  });

  it("asc_create_version posts the right JSON:API body", async () => {
    const { run, requests } = await makeToolRig(() => ({
      status: 201,
      json: { data: { id: "v2", attributes: { versionString: "2.26" } } },
    }));
    const res = (await run(getTool(defs, "asc_create_version"), {
      appId: "1",
      versionString: "2.26",
    })) as { id: string };
    expect(res.id).toBe("v2");
    const body = JSON.parse(requests[0].body!);
    expect(requests[0].method).toBe("POST");
    expect(body.data.type).toBe("appStoreVersions");
    expect(body.data.attributes).toMatchObject({ platform: "MAC_OS", versionString: "2.26" });
    expect(body.data.relationships.app.data).toEqual({ type: "apps", id: "1" });
  });

  it("asc_update_version_localization PATCHes only provided fields", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: { id: "loc1", attributes: { locale: "en-US" } } },
    }));
    const res = (await run(getTool(defs, "asc_update_version_localization"), {
      localizationId: "loc1",
      keywords: "cat,timer,menubar",
      whatsNew: "Bug fixes",
    })) as { updated: string[] };
    expect(res.updated.sort()).toEqual(["keywords", "whatsNew"]);
    const body = JSON.parse(requests[0].body!);
    expect(requests[0].method).toBe("PATCH");
    expect(body.data.attributes).toEqual({ keywords: "cat,timer,menubar", whatsNew: "Bug fixes" });
    expect(body.data.attributes.description).toBeUndefined();
  });

  it("asc_update_version_localization rejects empty updates", async () => {
    const { run } = await makeToolRig(() => ({ json: {} }));
    await expect(
      run(getTool(defs, "asc_update_version_localization"), { localizationId: "loc1" }),
    ).rejects.toThrow(/at least one field/);
  });
});
