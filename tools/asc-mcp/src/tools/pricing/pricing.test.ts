import { describe, expect, it } from "vitest";
import defs from "./pricing.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

describe("pricing tools", () => {
  it("asc_list_price_points filters by territory", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "pp1", attributes: { customerPrice: "0.99" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_price_points"), {
      appId: "1",
      territory: "JPN",
    })) as { pricePoints: Array<{ id: string; customerPrice?: string }> };
    expect(res.pricePoints[0]).toMatchObject({ id: "pp1", customerPrice: "0.99" });
    expect(decodeURIComponent(requests[0].url)).toContain("filter[territory]=JPN");
  });

  it("asc_set_price_schedule builds a manualPrices relationship + included appPrice", async () => {
    const { run, requests } = await makeToolRig(() => ({
      status: 201,
      json: { data: { id: "sched1" } },
    }));
    const res = (await run(getTool(defs, "asc_set_price_schedule"), {
      appId: "1",
      baseTerritory: "USA",
      pricePointId: "pp1",
    })) as { scheduleId: string };
    expect(res.scheduleId).toBe("sched1");

    const body = JSON.parse(requests[0].body!);
    expect(body.data.type).toBe("appPriceSchedules");
    expect(body.data.relationships.app.data).toEqual({ type: "apps", id: "1" });
    expect(body.data.relationships.baseTerritory.data).toEqual({ type: "territories", id: "USA" });
    const lid = body.data.relationships.manualPrices.data[0].id;
    expect(body.included[0]).toMatchObject({ type: "appPrices", id: lid });
    expect(body.included[0].relationships.appPricePoint.data).toEqual({
      type: "appPricePoints",
      id: "pp1",
    });
  });

  it("asc_set_availability sends a territories relationship array", async () => {
    const { run, requests } = await makeToolRig(() => ({
      status: 201,
      json: { data: { id: "avail1" } },
    }));
    await run(getTool(defs, "asc_set_availability"), {
      appId: "1",
      territories: ["USA", "JPN"],
      availableInNewTerritories: true,
    });
    const body = JSON.parse(requests[0].body!);
    expect(body.data.attributes.availableInNewTerritories).toBe(true);
    expect(body.data.relationships.availableTerritories.data).toEqual([
      { type: "territories", id: "USA" },
      { type: "territories", id: "JPN" },
    ]);
  });
});
