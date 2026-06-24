import { z } from "zod";
import { defineTool } from "../registry.js";
import { uploadAsset } from "../../lib/assetUpload.js";

interface PreviewSetResource {
  id: string;
  attributes?: { previewType?: string };
}

export default [
  defineTool({
    name: "asc_list_preview_sets",
    title: "List app preview sets",
    description:
      "List a version localization's app preview (video) sets (id + preview type). " +
      "Get the localization id from asc_get_version_localizations.",
    inputSchema: {
      localizationId: z.string().describe("appStoreVersionLocalizations id."),
    },
    handler: async (args, ctx) => {
      const sets = await ctx.client.paginate<PreviewSetResource>(
        `/v1/appStoreVersionLocalizations/${args.localizationId}/appPreviewSets`,
        { query: { limit: 50 } },
      );
      return {
        count: sets.length,
        sets: sets.map((s) => ({ id: s.id, previewType: s.attributes?.previewType })),
      };
    },
  }),

  defineTool({
    name: "asc_upload_preview",
    title: "Upload app preview",
    description:
      "Upload an app preview video into a preview set (reserve → upload → commit, with checksum). " +
      "Provide the preview set id, an absolute path to the video file, and optionally the poster " +
      "frame time code.",
    inputSchema: {
      previewSetId: z.string().describe("appPreviewSets id."),
      filePath: z.string().describe("Absolute path to the video file (e.g. /path/to/preview.mp4)."),
      mimeType: z.string().optional().describe('Video MIME type, e.g. "video/mp4".'),
      previewFrameTimeCode: z
        .string()
        .optional()
        .describe('Poster frame time code, e.g. "00:00:05:00".'),
    },
    handler: async (args, ctx) => {
      const { id } = await uploadAsset(ctx.client, {
        reservePath: "/v1/appPreviews",
        resourceType: "appPreviews",
        relationship: { name: "appPreviewSet", type: "appPreviewSets", id: args.previewSetId },
        filePath: args.filePath,
        reserveAttributes: args.mimeType ? { mimeType: args.mimeType } : undefined,
        commitAttributes: args.previewFrameTimeCode
          ? { previewFrameTimeCode: args.previewFrameTimeCode }
          : undefined,
      });
      return { id, uploaded: true };
    },
  }),

  defineTool({
    name: "asc_delete_preview",
    title: "Delete app preview",
    description: "Delete an app preview by its appPreviews id.",
    inputSchema: {
      previewId: z.string().describe("appPreviews id."),
    },
    handler: async (args, ctx) => {
      await ctx.client.request(`/v1/appPreviews/${args.previewId}`, { method: "DELETE" });
      return { id: args.previewId, deleted: true };
    },
  }),
];
