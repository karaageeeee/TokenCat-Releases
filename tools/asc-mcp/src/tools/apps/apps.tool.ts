import { z } from "zod";
import { defineTool } from "../registry.js";

interface AppResource {
  id: string;
  attributes?: { name?: string; bundleId?: string; sku?: string; primaryLocale?: string };
}
interface AppInfoResource {
  id: string;
  attributes?: {
    appStoreState?: string;
    state?: string;
    appStoreAgeRating?: string;
    kidsAgeBand?: string | null;
  };
}

const slimApp = (a: AppResource) => ({
  id: a.id,
  name: a.attributes?.name,
  bundleId: a.attributes?.bundleId,
  sku: a.attributes?.sku,
  primaryLocale: a.attributes?.primaryLocale,
});

export default [
  defineTool({
    name: "asc_list_apps",
    title: "List apps",
    description:
      "List apps in the App Store Connect account (id, name, bundleId, sku). " +
      "Optionally filter by bundleId. Use the returned app id with other tools.",
    inputSchema: {
      bundleId: z.string().optional().describe("Exact bundleId to filter by, e.g. com.tokencat.app."),
      limit: z.number().int().min(1).max(200).optional().describe("Max apps (default 100)."),
    },
    handler: async (args, ctx) => {
      const apps = await ctx.client.paginate<AppResource>("/v1/apps", {
        query: {
          limit: args.limit ?? 100,
          "filter[bundleId]": args.bundleId,
          "fields[apps]": "name,bundleId,sku,primaryLocale",
        },
      });
      return { count: apps.length, apps: apps.map(slimApp) };
    },
  }),

  defineTool({
    name: "asc_get_app",
    title: "Get app",
    description: "Get a single app's core attributes by its App Store Connect id.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id (numeric string)."),
    },
    handler: async (args, ctx) => {
      const res = await ctx.client.request<{ data: AppResource }>(`/v1/apps/${args.appId}`, {
        query: { "fields[apps]": "name,bundleId,sku,primaryLocale" },
      });
      return slimApp(res.data);
    },
  }),

  defineTool({
    name: "asc_get_app_info",
    title: "Get app info records",
    description:
      "List the app's appInfo records (one per editable/live state) with their ids and review state. " +
      "Use an appInfo id with the appinfo-localization tools.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
    },
    handler: async (args, ctx) => {
      const infos = await ctx.client.paginate<AppInfoResource>(`/v1/apps/${args.appId}/appInfos`, {
        query: { "fields[appInfos]": "appStoreState,state,appStoreAgeRating,kidsAgeBand" },
      });
      return {
        count: infos.length,
        appInfos: infos.map((i) => ({
          id: i.id,
          state: i.attributes?.state ?? i.attributes?.appStoreState,
          ageRating: i.attributes?.appStoreAgeRating,
        })),
      };
    },
  }),
];
