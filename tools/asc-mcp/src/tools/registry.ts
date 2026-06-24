import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fg from "fast-glob";
import type { z, ZodRawShape, ZodTypeAny } from "zod";
import type { AscClient } from "../client/ascClient.js";

/** Runtime context handed to every tool handler. */
export interface ToolContext {
  client: AscClient;
}

/**
 * A tool definition. `inputSchema` is a Zod *raw shape* (a plain object mapping
 * argument names to Zod types), which the MCP SDK turns into a JSON schema and
 * uses to validate/parse arguments before calling `handler`.
 *
 * The handler returns any JSON-serializable value; the server wraps it into MCP
 * tool result content automatically.
 */
export interface ToolDef<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Shape;
  handler: (args: z.objectOutputType<Shape, ZodTypeAny>, ctx: ToolContext) => Promise<unknown>;
}

/**
 * Identity helper that pins the generic so tool authors get full type inference
 * on `args` from their `inputSchema`. Every `*.tool.ts` module must default-
 * export an array of these (or a single one).
 */
export function defineTool<Shape extends ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def as ToolDef<Shape>;
}

/** Shape of a discovered tool module: default or `tools` export. */
export interface ToolModule {
  default?: ToolDef | ToolDef[];
  tools?: ToolDef | ToolDef[];
}

/**
 * Pure aggregation: flatten each module's default/`tools` export into a single
 * list, skipping modules with neither and throwing on duplicate tool names.
 * Separated from IO so it can be unit-tested without dynamic imports.
 */
export function collectToolDefs(
  modules: Array<{ module: ToolModule; source?: string }>,
): ToolDef[] {
  const defs: ToolDef[] = [];
  const seen = new Set<string>();
  for (const { module, source } of modules) {
    const exported = module.default ?? module.tools;
    if (!exported) continue;
    for (const def of Array.isArray(exported) ? exported : [exported]) {
      if (seen.has(def.name)) {
        throw new Error(
          `Duplicate tool name "${def.name}"${source ? ` (from ${source})` : ""}`,
        );
      }
      seen.add(def.name);
      defs.push(def);
    }
  }
  return defs;
}

/**
 * Auto-discover tool modules. Globs `*.tool.js` under `baseDir` (defaults to the
 * compiled `dist/tools` directory next to this module), dynamically imports each,
 * and collects their default (or `tools`) export. Adding a new tool module needs
 * no edit here — drop a `*.tool.ts` file under `src/tools/<domain>/`.
 */
export async function loadTools(baseDir?: string): Promise<ToolDef[]> {
  const dir = baseDir ?? dirname(fileURLToPath(import.meta.url));
  const files = await fg(["**/*.tool.js"], { cwd: dir, absolute: true });
  files.sort();

  const modules: Array<{ module: ToolModule; source?: string }> = [];
  for (const file of files) {
    const module: ToolModule = await import(pathToFileURL(file).href);
    modules.push({ module, source: file });
  }
  return collectToolDefs(modules);
}
