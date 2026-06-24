import { readFileSync } from "node:fs";

/**
 * App Store Connect API credentials.
 *
 * Create an API key in App Store Connect → Users and Access → Integrations →
 * App Store Connect API. You get an Issuer ID (UUID), a Key ID, and a
 * downloadable `.p8` private key (downloadable once).
 */
export interface AscConfig {
  /** Key ID, e.g. "2X9R4HXF34". Becomes the JWT `kid` header. */
  keyId: string;
  /** Issuer ID (UUID). Becomes the JWT `iss` claim. */
  issuerId: string;
  /** PEM contents of the `.p8` private key (PKCS#8, EC P-256). */
  privateKey: string;
}

/** Thrown when credentials are missing or invalid. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Resolve credentials from the environment.
 *
 * - `ASC_KEY_ID`     — required
 * - `ASC_ISSUER_ID`  — required
 * - `ASC_PRIVATE_KEY` (PEM text) OR `ASC_PRIVATE_KEY_PATH` (path to `.p8`) — one required
 *
 * Intentionally lazy: it is only called the first time a tool makes an API
 * request, so `tools/list` and the MCP handshake work without credentials.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AscConfig {
  const keyId = env.ASC_KEY_ID?.trim();
  const issuerId = env.ASC_ISSUER_ID?.trim();
  const inlineKey = env.ASC_PRIVATE_KEY?.trim();
  const keyPath = env.ASC_PRIVATE_KEY_PATH?.trim();

  const missing: string[] = [];
  if (!keyId) missing.push("ASC_KEY_ID");
  if (!issuerId) missing.push("ASC_ISSUER_ID");
  if (!inlineKey && !keyPath) missing.push("ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_PATH");
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing App Store Connect credentials: ${missing.join(", ")}. ` +
        `See tools/asc-mcp/README.md for setup.`,
    );
  }

  let privateKey: string;
  if (inlineKey) {
    privateKey = inlineKey;
  } else {
    try {
      privateKey = readFileSync(keyPath as string, "utf8");
    } catch (err) {
      throw new ConfigError(
        `Could not read ASC_PRIVATE_KEY_PATH (${keyPath}): ${(err as Error).message}`,
      );
    }
  }

  if (!privateKey.includes("PRIVATE KEY")) {
    throw new ConfigError(
      "Private key does not look like a PEM `.p8` file (missing 'PRIVATE KEY' header).",
    );
  }

  return { keyId: keyId as string, issuerId: issuerId as string, privateKey };
}
