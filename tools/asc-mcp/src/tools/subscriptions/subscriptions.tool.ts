import { z } from "zod";
import { defineTool } from "../registry.js";

const PERIODS = [
  "ONE_WEEK",
  "ONE_MONTH",
  "TWO_MONTHS",
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR",
] as const;

interface GroupResource {
  id: string;
  attributes?: { referenceName?: string };
}

export default [
  defineTool({
    name: "asc_list_subscription_groups",
    title: "List subscription groups",
    description:
      "List an app's auto-renewable subscription groups (id + reference name). " +
      "Use a group id with asc_create_subscription.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
    },
    handler: async (args, ctx) => {
      const groups = await ctx.client.paginate<GroupResource>(
        `/v1/apps/${args.appId}/subscriptionGroups`,
        { query: { "fields[subscriptionGroups]": "referenceName", limit: 200 } },
      );
      return {
        count: groups.length,
        groups: groups.map((g) => ({ id: g.id, referenceName: g.attributes?.referenceName })),
      };
    },
  }),

  defineTool({
    name: "asc_create_subscription",
    title: "Create subscription",
    description:
      "Create an auto-renewable subscription in a group. Provide the group id, productId, a reference " +
      "name, the renewal period, and the group level (1 = highest tier). Returns the new subscription id.",
    inputSchema: {
      groupId: z.string().describe("subscriptionGroups id."),
      productId: z.string().describe("Product identifier, e.g. com.tokencat.app.pro.monthly."),
      name: z.string().max(64).describe("Reference name (App Store Connect internal)."),
      subscriptionPeriod: z.enum(PERIODS).describe("Renewal period."),
      groupLevel: z.number().int().min(1).describe("Rank within the group (1 = highest)."),
      familySharable: z.boolean().optional(),
      reviewNote: z.string().optional(),
    },
    handler: async (args, ctx) => {
      const attributes: Record<string, unknown> = {
        name: args.name,
        productId: args.productId,
        subscriptionPeriod: args.subscriptionPeriod,
        groupLevel: args.groupLevel,
      };
      if (args.familySharable !== undefined) attributes.familySharable = args.familySharable;
      if (args.reviewNote !== undefined) attributes.reviewNote = args.reviewNote;

      const res = await ctx.client.request<{ data: { id: string } }>("/v1/subscriptions", {
        method: "POST",
        body: {
          data: {
            type: "subscriptions",
            attributes,
            relationships: {
              group: { data: { type: "subscriptionGroups", id: args.groupId } },
            },
          },
        },
      });
      return { id: res.data.id, productId: args.productId };
    },
  }),

  defineTool({
    name: "asc_set_subscription_localization",
    title: "Set subscription localization",
    description:
      "Create or set a localized display name and description for a subscription, for one locale.",
    inputSchema: {
      subscriptionId: z.string().describe("subscriptions id."),
      locale: z.string().describe('Locale, e.g. "en-US", "ja".'),
      name: z.string().max(30).describe("Localized display name (max 30 chars)."),
      description: z.string().optional().describe("Localized description (max 45 chars)."),
    },
    handler: async (args, ctx) => {
      const attributes: Record<string, unknown> = { locale: args.locale, name: args.name };
      if (args.description !== undefined) attributes.description = args.description;
      const res = await ctx.client.request<{ data: { id: string } }>("/v1/subscriptionLocalizations", {
        method: "POST",
        body: {
          data: {
            type: "subscriptionLocalizations",
            attributes,
            relationships: {
              subscription: { data: { type: "subscriptions", id: args.subscriptionId } },
            },
          },
        },
      });
      return { id: res.data.id, locale: args.locale };
    },
  }),

  defineTool({
    name: "asc_set_subscription_price",
    title: "Set subscription price",
    description:
      "Set a subscription's price in a territory using a subscriptionPricePoints id. " +
      "The price point encodes both the territory and the amount.",
    inputSchema: {
      subscriptionId: z.string().describe("subscriptions id."),
      pricePointId: z.string().describe("subscriptionPricePoints id."),
      startDate: z.string().optional().describe("ISO date the price takes effect (default immediately)."),
      preserveCurrentPrice: z
        .boolean()
        .optional()
        .describe("Keep existing subscribers at their current price."),
    },
    handler: async (args, ctx) => {
      const attributes: Record<string, unknown> = {};
      if (args.startDate !== undefined) attributes.startDate = args.startDate;
      if (args.preserveCurrentPrice !== undefined)
        attributes.preserveCurrentPrice = args.preserveCurrentPrice;

      const res = await ctx.client.request<{ data: { id: string } }>("/v1/subscriptionPrices", {
        method: "POST",
        body: {
          data: {
            type: "subscriptionPrices",
            attributes,
            relationships: {
              subscription: { data: { type: "subscriptions", id: args.subscriptionId } },
              subscriptionPricePoint: {
                data: { type: "subscriptionPricePoints", id: args.pricePointId },
              },
            },
          },
        },
      });
      return { id: res.data.id, pricePointId: args.pricePointId };
    },
  }),
];
