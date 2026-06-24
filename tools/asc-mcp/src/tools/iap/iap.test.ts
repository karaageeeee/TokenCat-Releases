import { describe, expect, it } from "vitest";
import defs from "./iap.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("iap tools", () => {
  it("asc_list_iaps reads inAppPurchasesV2", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "iap1", attributes: { name: "Tip", productId: "com.tokencat.app.tip" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_iaps"), { appId: "1" })) as {
      inAppPurchases: Array<{ id: string }>;
    };
    expect(res.inAppPurchases[0].id).toBe("iap1");
    expect(requests[0].url).toContain("/inAppPurchasesV2");
  });

  it("asc_create_iap posts type + productId and omits unset optionals", async () => {
    const { run, requests } = await makeToolRig(() => ({
      status: 201,
      json: { data: { id: "iap2", attributes: { productId: "com.tokencat.app.tip" } } },
    }));
    await run(getTool(defs, "asc_create_iap"), {
      appId: "1",
      productId: "com.tokencat.app.tip",
      name: "Tip Jar",
      type: "NON_CONSUMABLE",
    });
    const body = JSON.parse(requests[0].body!);
    expect(requests[0].url).toContain("/v2/inAppPurchases");
    expect(body.data.attributes).toEqual({
      name: "Tip Jar",
      productId: "com.tokencat.app.tip",
      inAppPurchaseType: "NON_CONSUMABLE",
    });
    expect(body.data.relationships.app.data).toEqual({ type: "apps", id: "1" });
  });

  it("asc_set_iap_localization links via inAppPurchaseV2 relationship", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 201, json: { data: { id: "loc1" } } }));
    await run(getTool(defs, "asc_set_iap_localization"), {
      iapId: "iap1",
      locale: "ja",
      name: "チップ",
    });
    const body = JSON.parse(requests[0].body!);
    expect(body.data.relationships.inAppPurchaseV2.data).toEqual({ type: "inAppPurchases", id: "iap1" });
    expect(body.data.attributes).toEqual({ locale: "ja", name: "チップ" });
  });

  it("asc_set_iap_price builds the price schedule with included price", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 201, json: { data: { id: "sch1" } } }));
    await run(getTool(defs, "asc_set_iap_price"), {
      iapId: "iap1",
      baseTerritory: "USA",
      pricePointId: "ipp1",
    });
    const body = JSON.parse(requests[0].body!);
    expect(body.data.type).toBe("inAppPurchasePriceSchedules");
    expect(body.data.relationships.inAppPurchase.data).toEqual({ type: "inAppPurchases", id: "iap1" });
    expect(body.included[0].relationships.inAppPurchasePricePoint.data).toEqual({
      type: "inAppPurchasePricePoints",
      id: "ipp1",
    });
  });

  it("asc_update_iap rejects empty updates", async () => {
    const { run } = await makeToolRig(() => ({ json: {} }));
    await expect(run(getTool(defs, "asc_update_iap"), { iapId: "iap1" })).rejects.toThrow(
      /at least one field/,
    );
  });
});
