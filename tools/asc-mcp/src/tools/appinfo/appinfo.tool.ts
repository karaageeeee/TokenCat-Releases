import { z } from "zod";
import { defineTool } from "../registry.js";

interface AppInfoLocResource {
  id: string;
  attributes?: {
    locale?: string;
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
    privacyPolicyText?: string;
  };
}

export default [
  defineTool({
    name: "asc_get_appinfo_localizations",
    title: "Get app info localizations",
    description:
      "List an appInfo's localizations (id + locale + name/subtitle/privacy policy). " +
      "Get the appInfo id from asc_get_app_info. Use a localization id with asc_update_appinfo_localization.",
    inputSchema: {
      appInfoId: z.string().describe("appInfos id (from asc_get_app_info)."),
    },
    handler: async (args, ctx) => {
      const locs = await ctx.client.paginate<AppInfoLocResource>(
        `/v1/appInfos/${args.appInfoId}/appInfoLocalizations`,
        { query: { limit: 50 } },
      );
      return {
        count: locs.length,
        localizations: locs.map((l) => ({ id: l.id, ...l.attributes })),
      };
    },
  }),

  defineTool({
    name: "asc_update_appinfo_localization",
    title: "Update app info localization",
    description:
      "Update one locale's app-level metadata: name (max 30 chars), subtitle (max 30 chars), " +
      "privacyPolicyUrl, privacyPolicyText. Only provided fields change. (Name/subtitle are only " +
      "editable while the app/version is in an editable state.)",
    inputSchema: {
      localizationId: z.string().describe("appInfoLocalizations id."),
      name: z.string().max(30).optional(),
      subtitle: z.string().max(30).optional(),
      privacyPolicyUrl: z.string().url().optional(),
      privacyPolicyText: z.string().optional(),
    },
    handler: async (args, ctx) => {
      const { localizationId, ...attrs } = args;
      const attributes = Object.fromEntries(
        Object.entries(attrs).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(attributes).length === 0) {
        throw new Error("Provide at least one field to update.");
      }
      const res = await ctx.client.request<{ data: AppInfoLocResource }>(
        `/v1/appInfoLocalizations/${localizationId}`,
        {
          method: "PATCH",
          body: { data: { type: "appInfoLocalizations", id: localizationId, attributes } },
        },
      );
      return { id: res.data.id, updated: Object.keys(attributes), locale: res.data.attributes?.locale };
    },
  }),
];
