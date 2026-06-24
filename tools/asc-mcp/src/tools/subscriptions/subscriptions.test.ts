import { describe, expect, it } from "vitest";
import defs from "./subscriptions.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("subscriptions tools", () => {
  it("asc_list_subscription_groups lists groups", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "g1", attributes: { referenceName: "Pro" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_subscription_groups"), { appId: "1" })) as {
      groups: Array<{ id: string; referenceName?: string }>;
    };
    expect(res.groups[0]).toEqual({ id: "g1", referenceName: "Pro" });
    expect(requests[0].url).toContain("/subscriptionGroups");
  });

  it("asc_create_subscription posts period + groupLevel and group relationship", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 201, json: { data: { id: "s1" } } }));
    await run(getTool(defs, "asc_create_subscription"), {
      groupId: "g1",
      productId: "com.tokencat.app.pro.monthly",
      name: "Pro Monthly",
      subscriptionPeriod: "ONE_MONTH",
      groupLevel: 1,
    });
    const body = JSON.parse(requests[0].body!);
    expect(body.data.type).toBe("subscriptions");
    expect(body.data.attributes).toMatchObject({
      productId: "com.tokencat.app.pro.monthly",
      subscriptionPeriod: "ONE_MONTH",
      groupLevel: 1,
    });
    expect(body.data.relationships.group.data).toEqual({ type: "subscriptionGroups", id: "g1" });
  });

  it("asc_set_subscription_price links subscription + price point", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 201, json: { data: { id: "p1" } } }));
    await run(getTool(defs, "asc_set_subscription_price"), {
      subscriptionId: "s1",
      pricePointId: "spp1",
      preserveCurrentPrice: true,
    });
    const body = JSON.parse(requests[0].body!);
    expect(body.data.attributes).toEqual({ preserveCurrentPrice: true });
    expect(body.data.relationships.subscription.data).toEqual({ type: "subscriptions", id: "s1" });
    expect(body.data.relationships.subscriptionPricePoint.data).toEqual({
      type: "subscriptionPricePoints",
      id: "spp1",
    });
  });
});
