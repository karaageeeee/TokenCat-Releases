import { z } from "zod";
import { defineTool } from "../registry.js";

const PLATFORMS = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"] as const;

interface VersionResource {
  id: string;
  attributes?: { versionString?: string; appStoreState?: string; platform?: string };
}
interface VersionLocResource {
  id: string;
  attributes?: {
    locale?: string;
    description?: string;
    keywords?: string;
    whatsNew?: string;
    promotionalText?: string;
    marketingUrl?: string;
    supportUrl?: string;
  };
}

export default [
  defineTool({
    name: "asc_list_versions",
    title: "List App Store versions",
    description:
      "List an app's App Store versions (id, versionString, state) for a platform. " +
      "Use a version id with the localization tools.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      platform: z.enum(PLATFORMS).optional().describe("Platform filter (default MAC_OS)."),
    },
    handler: async (args, ctx) => {
      const versions = await ctx.client.paginate<VersionResource>(
        `/v1/apps/${args.appId}/appStoreVersions`,
        {
          query: {
            "filter[platform]": args.platform ?? "MAC_OS",
            "fields[appStoreVersions]": "versionString,appStoreState,platform",
            limit: 50,
          },
        },
      );
      return {
        count: versions.length,
        versions: versions.map((v) => ({
          id: v.id,
          versionString: v.attributes?.versionString,
          state: v.attributes?.appStoreState,
          platform: v.attributes?.platform,
        })),
      };
    },
  }),

  defineTool({
    name: "asc_create_version",
    title: "Create App Store version",
    description:
      "Create a new editable App Store version for an app (e.g. to prepare a new release). " +
      "Returns the new version id.",
    inputSchema: {
      appId: z.string().describe("App Store Connect app id."),
      versionString: z.string().describe('Marketing version, e.g. "2.25".'),
      platform: z.enum(PLATFORMS).optional().describe("Platform (default MAC_OS)."),
    },
    handler: async (args, ctx) => {
      const res = await ctx.client.request<{ data: VersionResource }>("/v1/appStoreVersions", {
        method: "POST",
        body: {
          data: {
            type: "appStoreVersions",
            attributes: {
              platform: args.platform ?? "MAC_OS",
              versionString: args.versionString,
            },
            relationships: { app: { data: { type: "apps", id: args.appId } } },
          },
        },
      });
      return { id: res.data.id, versionString: res.data.attributes?.versionString };
    },
  }),

  defineTool({
    name: "asc_get_version_localizations",
    title: "Get version localizations",
    description:
      "List a version's localizations (id + locale + current metadata). " +
      "Use a localization id with asc_update_version_localization.",
    inputSchema: {
      versionId: z.string().describe("appStoreVersions id."),
    },
    handler: async (args, ctx) => {
      const locs = await ctx.client.paginate<VersionLocResource>(
        `/v1/appStoreVersions/${args.versionId}/appStoreVersionLocalizations`,
        { query: { limit: 50 } },
      );
      return {
        count: locs.length,
        localizations: locs.map((l) => ({ id: l.id, ...l.attributes })),
      };
    },
  }),

  defineTool({
    name: "asc_update_version_localization",
    title: "Update version localization",
    description:
      "Update one locale's store metadata for a version: description, keywords (comma-separated, " +
      "max 100 chars), whatsNew, promotionalText, marketingUrl, supportUrl. Only provided fields change.",
    inputSchema: {
      localizationId: z.string().describe("appStoreVersionLocalizations id."),
      description: z.string().optional(),
      keywords: z.string().optional().describe("Comma-separated, max 100 characters total."),
      whatsNew: z.string().optional().describe('"What\'s New in This Version" text.'),
      promotionalText: z.string().optional(),
      marketingUrl: z.string().url().optional(),
      supportUrl: z.string().url().optional(),
    },
    handler: async (args, ctx) => {
      const { localizationId, ...attrs } = args;
      const attributes = Object.fromEntries(
        Object.entries(attrs).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(attributes).length === 0) {
        throw new Error("Provide at least one field to update.");
      }
      const res = await ctx.client.request<{ data: VersionLocResource }>(
        `/v1/appStoreVersionLocalizations/${localizationId}`,
        {
          method: "PATCH",
          body: {
            data: { type: "appStoreVersionLocalizations", id: localizationId, attributes },
          },
        },
      );
      return { id: res.data.id, updated: Object.keys(attributes), locale: res.data.attributes?.locale };
    },
  }),
];
