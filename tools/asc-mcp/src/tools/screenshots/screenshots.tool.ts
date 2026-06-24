import { z } from "zod";
import { defineTool } from "../registry.js";
import { uploadAsset } from "../../lib/assetUpload.js";

interface ScreenshotSetResource {
  id: string;
  attributes?: { screenshotDisplayType?: string };
}

export default [
  defineTool({
    name: "asc_list_screenshot_sets",
    title: "List screenshot sets",
    description:
      "List a version localization's screenshot sets (id + display type, e.g. " +
      "APP_DESKTOP for Mac). Get the localization id from asc_get_version_localizations.",
    inputSchema: {
      localizationId: z.string().describe("appStoreVersionLocalizations id."),
    },
    handler: async (args, ctx) => {
      const sets = await ctx.client.paginate<ScreenshotSetResource>(
        `/v1/appStoreVersionLocalizations/${args.localizationId}/appScreenshotSets`,
        { query: { limit: 50 } },
      );
      return {
        count: sets.length,
        sets: sets.map((s) => ({ id: s.id, displayType: s.attributes?.screenshotDisplayType })),
      };
    },
  }),

  defineTool({
    name: "asc_upload_screenshot",
    title: "Upload screenshot",
    description:
      "Upload a screenshot image into a screenshot set (reserve → upload → commit, with checksum). " +
      "Provide the screenshot set id and an absolute path to the image file.",
    inputSchema: {
      screenshotSetId: z.string().describe("appScreenshotSets id."),
      filePath: z.string().describe("Absolute path to the image file (e.g. /path/to/shot.png)."),
    },
    handler: async (args, ctx) => {
      const { id } = await uploadAsset(ctx.client, {
        reservePath: "/v1/appScreenshots",
        resourceType: "appScreenshots",
        relationship: { name: "appScreenshotSet", type: "appScreenshotSets", id: args.screenshotSetId },
        filePath: args.filePath,
      });
      return { id, uploaded: true };
    },
  }),

  defineTool({
    name: "asc_delete_screenshot",
    title: "Delete screenshot",
    description: "Delete a screenshot by its appScreenshots id.",
    inputSchema: {
      screenshotId: z.string().describe("appScreenshots id."),
    },
    handler: async (args, ctx) => {
      await ctx.client.request(`/v1/appScreenshots/${args.screenshotId}`, { method: "DELETE" });
      return { id: args.screenshotId, deleted: true };
    },
  }),
];
