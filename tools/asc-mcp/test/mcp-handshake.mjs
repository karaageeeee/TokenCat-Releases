#!/usr/bin/env node
// MCP handshake smoke test. Spawns the built server (dist/index.js) over stdio,
// performs `initialize` then `tools/list`, prints the tool names, and asserts
// that any tool names passed as CLI args are present.
//
// Usage:
//   node test/mcp-handshake.mjs                       # list all tools
//   node test/mcp-handshake.mjs asc_whoami asc_list_apps   # assert presence
//
// Exits 0 on success, 1 on failure. Requires `npm run build` first. Works with
// NO App Store Connect credentials (tools/list does not hit the API).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "index.js");
const expected = process.argv.slice(2);

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
});

let buffer = "";
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function send(id, method, params) {
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

try {
  await send(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "handshake", version: "0.0.0" },
  });
  notify("notifications/initialized", {});
  const res = await send(2, "tools/list", {});
  const names = (res.result?.tools ?? []).map((t) => t.name).sort();
  console.log(`Discovered ${names.length} tool(s):`);
  for (const n of names) console.log(`  - ${n}`);

  const missing = expected.filter((e) => !names.includes(e));
  if (missing.length > 0) {
    console.error(`\nFAIL: missing expected tool(s): ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nOK${expected.length ? ` (all ${expected.length} expected tools present)` : ""}`);
  }
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exitCode = 1;
} finally {
  child.kill();
}
