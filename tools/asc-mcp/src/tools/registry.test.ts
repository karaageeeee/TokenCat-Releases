import { describe, expect, it } from "vitest";
import { collectToolDefs, defineTool, type ToolDef } from "./registry.js";
import { z } from "zod";

const t = (name: string): ToolDef => ({ name, description: name, handler: async () => ({}) });

describe("collectToolDefs", () => {
  it("flattens default (array) and `tools` (single) exports", () => {
    const defs = collectToolDefs([
      { module: { default: [t("fixture_one"), t("fixture_two")] } },
      { module: { tools: t("fixture_three") } },
    ]);
    expect(defs.map((d) => d.name).sort()).toEqual([
      "fixture_one",
      "fixture_three",
      "fixture_two",
    ]);
  });

  it("skips modules that export neither default nor tools", () => {
    const defs = collectToolDefs([{ module: {} }, { module: { default: t("only") } }]);
    expect(defs.map((d) => d.name)).toEqual(["only"]);
  });

  it("throws on duplicate tool names, citing the source", () => {
    expect(() =>
      collectToolDefs([
        { module: { default: t("dup_name") }, source: "x.tool.js" },
        { module: { default: t("dup_name") }, source: "y.tool.js" },
      ]),
    ).toThrow(/Duplicate tool name "dup_name" \(from y\.tool\.js\)/);
  });
});

describe("defineTool", () => {
  it("returns the definition unchanged (identity) with inference", () => {
    const def = defineTool({
      name: "t",
      description: "d",
      inputSchema: { id: z.string() },
      handler: async (args) => args.id,
    });
    expect(def.name).toBe("t");
    expect(typeof def.handler).toBe("function");
  });
});
