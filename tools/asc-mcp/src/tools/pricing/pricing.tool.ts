import { z } from "zod";
import { defineTool } from "../registry.js";

// Note: App Store pricing/availability endpoints have changed across API
// versions. These use the v1 appPriceSchedules / appPricePoints /
// appAvailabilities shapes; verify against current Apple docs for your account.

interface PricePointResource {
  id: string;
  attributes?: { customerPrice?: string; proceeds?: string };
  relationships?: { territory?: { data?: { id?: string } } };
}

export default [
  defineTool({
    name: "asc_list_price_points",
    title: "List price points",
    description:
      "List available price points for an app in a territory (id + customer price). " +
      'Territory is an ISO-style id, e.g. "USA" or "JPN". Use a price point id with asc_set_price_schedule.',
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      territory: z.string().describe('Territory id, e.g. "USA", "JPN".'),
      limit: z.number().int().min(1).max(200).optional(),
    },
    handler: async (args, ctx) => {
      const points = await ctx.client.paginate<PricePointResource>(
        `/v1/apps/${args.appId}/appPricePoints`,
        {
          query: {
            "filter[territory]": args.territory,
            "fields[appPricePoints]": "customerPrice,proceeds,territory",
            limit: args.limit ?? 100,
          },
        },
      );
      return {
        count: points.length,
        pricePoints: points.map((p) => ({
          id: p.id,
          customerPrice: p.attributes?.customerPrice,
          proceeds: p.attributes?.proceeds,
        })),
      };
    },
  }),

  defineTool({
    name: "asc_get_price_schedule",
    title: "Get price schedule",
    description: "Get an app's current price schedule (base territory + manual prices).",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
    },
    handler: async (args, ctx) => {
      const res = await ctx.client.request<{ data?: { id?: string }; included?: unknown[] }>(
        `/v1/apps/${args.appId}/appPriceSchedule`,
        { query: { include: "baseTerritory,manualPrices" } },
      );
      return { scheduleId: res.data?.id, included: res.included ?? [] };
    },
  }),

  defineTool({
    name: "asc_set_price_schedule",
    title: "Set price schedule",
    description:
      "Set an app's price schedule to a single manual price (the common case). Provide the app id, " +
      "the base territory, and the price point id (from asc_list_price_points). Replaces the current schedule.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      baseTerritory: z.string().describe('Base territory id, e.g. "USA".'),
      pricePointId: z.string().describe("appPricePoints id from asc_list_price_points."),
      startDate: z.string().optional().describe("ISO date the price takes effect (default immediately)."),
    },
    handler: async (args, ctx) => {
      const priceLid = "price-0";
      const res = await ctx.client.request<{ data: { id: string } }>("/v1/appPriceSchedules", {
        method: "POST",
        body: {
          data: {
            type: "appPriceSchedules",
            relationships: {
              app: { data: { type: "apps", id: args.appId } },
              baseTerritory: { data: { type: "territories", id: args.baseTerritory } },
              manualPrices: { data: [{ type: "appPrices", id: priceLid }] },
            },
          },
          included: [
            {
              type: "appPrices",
              id: priceLid,
              attributes: { startDate: args.startDate ?? null },
              relationships: {
                appPricePoint: { data: { type: "appPricePoints", id: args.pricePointId } },
              },
            },
          ],
        },
      });
      return { scheduleId: res.data.id, pricePointId: args.pricePointId };
    },
  }),

  defineTool({
    name: "asc_get_availability",
    title: "Get app availability",
    description: "Get the territories an app is available in.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
    },
    handler: async (args, ctx) => {
      const territories = await ctx.client.paginate<{ id: string }>(
        `/v1/apps/${args.appId}/availableTerritories`,
        { query: { limit: 200, "fields[territories]": "currency" } },
      );
      return { count: territories.length, territories: territories.map((t) => t.id) };
    },
  }),

  defineTool({
    name: "asc_set_availability",
    title: "Set app availability",
    description:
      "Set the territories an app is available in. Provide the full list of territory ids " +
      '(e.g. ["USA","JPN"]). availableInNewTerritories controls auto-enabling future territories.',
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      territories: z.array(z.string()).min(1).describe('Territory ids, e.g. ["USA","JPN"].'),
      availableInNewTerritories: z.boolean().optional().describe("Auto-enable future territories."),
    },
    handler: async (args, ctx) => {
      const res = await ctx.client.request<{ data: { id: string } }>("/v1/appAvailabilities", {
        method: "POST",
        body: {
          data: {
            type: "appAvailabilities",
            attributes: { availableInNewTerritories: args.availableInNewTerritories ?? false },
            relationships: {
              app: { data: { type: "apps", id: args.appId } },
              availableTerritories: {
                data: args.territories.map((id) => ({ type: "territories", id })),
              },
            },
          },
        },
      });
      return { availabilityId: res.data.id, territories: args.territories };
    },
  }),
];
