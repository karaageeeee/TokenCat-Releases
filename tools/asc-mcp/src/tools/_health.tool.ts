import { z } from "zod";
import { defineTool } from "./registry.js";

/**
 * Reference tool + pipeline health check. Lists the apps the configured API key
 * can access — the simplest authenticated read. Copy this file's shape when
 * writing new tool modules:
 *   - default-export an array of `defineTool(...)` results
 *   - declare args as a Zod raw shape in `inputSchema`
 *   - use `ctx.client` (never construct your own auth/HTTP)
 *   - return plain JSON-serializable data
 */
interface AppsResponse {
  data: Array<{ id: string; attributes?: { name?: string; bundleId?: string; sku?: string } }>;
}

export default [
  defineTool({
    name: "asc_whoami",
    title: "Who am I (App Store Connect)",
    description:
      "Verify App Store Connect API credentials by listing the apps the key can access. " +
      "Returns each app's id, name and bundleId. Use this first to confirm setup.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Max apps to return (default 50)."),
    },
    handler: async (args, ctx) => {
      const res = await ctx.client.request<AppsResponse>("/v1/apps", {
        query: {
          limit: args.limit ?? 50,
          "fields[apps]": "name,bundleId,sku",
        },
      });
      const apps = (res.data ?? []).map((a) => ({
        id: a.id,
        name: a.attributes?.name,
        bundleId: a.attributes?.bundleId,
        sku: a.attributes?.sku,
      }));
      return { count: apps.length, apps };
    },
  }),
];
