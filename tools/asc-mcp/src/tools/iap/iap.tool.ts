import { z } from "zod";
import { defineTool } from "../registry.js";

const IAP_TYPES = ["CONSUMABLE", "NON_CONSUMABLE", "NON_RENEWING_SUBSCRIPTION"] as const;

interface IapResource {
  id: string;
  attributes?: { name?: string; productId?: string; inAppPurchaseType?: string; state?: string };
}

export default [
  defineTool({
    name: "asc_list_iaps",
    title: "List in-app purchases",
    description:
      "List an app's in-app purchases (id, name, productId, type, state). " +
      "Use an in-app purchase id with the other IAP tools.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
    },
    handler: async (args, ctx) => {
      const iaps = await ctx.client.paginate<IapResource>(`/v1/apps/${args.appId}/inAppPurchasesV2`, {
        query: {
          "fields[inAppPurchases]": "name,productId,inAppPurchaseType,state",
          limit: 200,
        },
      });
      return {
        count: iaps.length,
        inAppPurchases: iaps.map((i) => ({ id: i.id, ...i.attributes })),
      };
    },
  }),

  defineTool({
    name: "asc_create_iap",
    title: "Create in-app purchase",
    description:
      "Create an in-app purchase. Provide app id, productId (your reverse-DNS product identifier), " +
      "a reference name, and the type. Returns the new in-app purchase id.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      productId: z.string().describe("Product identifier, e.g. com.tokencat.app.tip."),
      name: z.string().max(64).describe("Reference name (App Store Connect internal)."),
      type: z.enum(IAP_TYPES).describe("In-app purchase type."),
      reviewNote: z.string().optional(),
      familySharable: z.boolean().optional(),
    },
    handler: async (args, ctx) => {
      const attributes: Record<string, unknown> = {
        name: args.name,
        productId: args.productId,
        inAppPurchaseType: args.type,
      };
      if (args.reviewNote !== undefined) attributes.reviewNote = args.reviewNote;
      if (args.familySharable !== undefined) attributes.familySharable = args.familySharable;

      const res = await ctx.client.request<{ data: IapResource }>("/v2/inAppPurchases", {
        method: "POST",
        body: {
          data: {
            type: "inAppPurchases",
            attributes,
            relationships: { app: { data: { type: "apps", id: args.appId } } },
          },
        },
      });
      return { id: res.data.id, productId: res.data.attributes?.productId };
    },
  }),

  defineTool({
    name: "asc_update_iap",
    title: "Update in-app purchase",
    description:
      "Update an in-app purchase's editable attributes: name, reviewNote, familySharable. " +
      "Only provided fields change.",
    inputSchema: {
      iapId: z.string().describe("inAppPurchases id."),
      name: z.string().max(64).optional(),
      reviewNote: z.string().optional(),
      familySharable: z.boolean().optional(),
    },
    handler: async (args, ctx) => {
      const { iapId, ...attrs } = args;
      const attributes = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== undefined));
      if (Object.keys(attributes).length === 0) throw new Error("Provide at least one field to update.");
      const res = await ctx.client.request<{ data: IapResource }>(`/v2/inAppPurchases/${iapId}`, {
        method: "PATCH",
        body: { data: { type: "inAppPurchases", id: iapId, attributes } },
      });
      return { id: res.data.id, updated: Object.keys(attributes) };
    },
  }),

  defineTool({
    name: "asc_set_iap_localization",
    title: "Set in-app purchase localization",
    description:
      "Create or set a localized display name and description for an in-app purchase, for one locale.",
    inputSchema: {
      iapId: z.string().describe("inAppPurchases id."),
      locale: z.string().describe('Locale, e.g. "en-US", "ja".'),
      name: z.string().max(30).describe("Localized display name (max 30 chars)."),
      description: z.string().optional().describe("Localized description (max 45 chars)."),
    },
    handler: async (args, ctx) => {
      const attributes: Record<string, unknown> = { locale: args.locale, name: args.name };
      if (args.description !== undefined) attributes.description = args.description;
      const res = await ctx.client.request<{ data: { id: string } }>(
        "/v1/inAppPurchaseLocalizations",
        {
          method: "POST",
          body: {
            data: {
              type: "inAppPurchaseLocalizations",
              attributes,
              relationships: {
                inAppPurchaseV2: { data: { type: "inAppPurchases", id: args.iapId } },
              },
            },
          },
        },
      );
      return { id: res.data.id, locale: args.locale };
    },
  }),

  defineTool({
    name: "asc_set_iap_price",
    title: "Set in-app purchase price",
    description:
      "Set an in-app purchase's price schedule to a single price point. Provide the in-app purchase id, " +
      "base territory, and an inAppPurchasePricePoints id.",
    inputSchema: {
      iapId: z.string().describe("inAppPurchases id."),
      baseTerritory: z.string().describe('Base territory id, e.g. "USA".'),
      pricePointId: z.string().describe("inAppPurchasePricePoints id."),
    },
    handler: async (args, ctx) => {
      const priceLid = "iap-price-0";
      const res = await ctx.client.request<{ data: { id: string } }>(
        "/v1/inAppPurchasePriceSchedules",
        {
          method: "POST",
          body: {
            data: {
              type: "inAppPurchasePriceSchedules",
              relationships: {
                inAppPurchase: { data: { type: "inAppPurchases", id: args.iapId } },
                baseTerritory: { data: { type: "territories", id: args.baseTerritory } },
                manualPrices: { data: [{ type: "inAppPurchasePrices", id: priceLid }] },
              },
            },
            included: [
              {
                type: "inAppPurchasePrices",
                id: priceLid,
                attributes: { startDate: null },
                relationships: {
                  inAppPurchasePricePoint: {
                    data: { type: "inAppPurchasePricePoints", id: args.pricePointId },
                  },
                },
              },
            ],
          },
        },
      );
      return { scheduleId: res.data.id, pricePointId: args.pricePointId };
    },
  }),
];
