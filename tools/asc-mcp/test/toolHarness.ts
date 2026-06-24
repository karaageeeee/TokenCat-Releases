import { AscClient } from "../src/client/ascClient.js";
import type { ToolDef, ToolContext } from "../src/tools/registry.js";
import { makeFetchStub, makeTestConfig, type StubResponse, type RecordedRequest } from "./fetchStub.js";

export type { RecordedRequest, StubResponse };

/** Find a tool by name in a module's default-exported array (throws if absent). */
export function getTool(defs: ToolDef[], name: string): ToolDef {
  const tool = defs.find((d) => d.name === name);
  if (!tool) throw new Error(`tool ${name} not found (have: ${defs.map((d) => d.name).join(", ")})`);
  return tool;
}

/**
 * Build a tool test rig: a stubbed AscClient + a recorder. Call the returned
 * `run(tool, args)` to invoke a handler against the canned responses.
 */
export async function makeToolRig(
  responder: (req: RecordedRequest, callIndex: number) => StubResponse,
): Promise<{
  ctx: ToolContext;
  requests: RecordedRequest[];
  run: (tool: ToolDef, args: Record<string, unknown>) => Promise<unknown>;
}> {
  const config = await makeTestConfig();
  const { fetchImpl, requests } = makeFetchStub(responder);
  const client = new AscClient({ fetchImpl, configLoader: () => config });
  const ctx: ToolContext = { client };
  return {
    ctx,
    requests,
    run: (tool, args) => tool.handler(args as never, ctx),
  };
}
