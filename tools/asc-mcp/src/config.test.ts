import { describe, expect, it } from "vitest";
import { loadConfig, ConfigError } from "./config.js";

const VALID_KEY = "-----BEGIN PRIVATE KEY-----\nMIG...\n-----END PRIVATE KEY-----";

describe("loadConfig", () => {
  it("reads inline PEM credentials from the environment", () => {
    const cfg = loadConfig({
      ASC_KEY_ID: "ABC123",
      ASC_ISSUER_ID: "issuer-uuid",
      ASC_PRIVATE_KEY: VALID_KEY,
    } as NodeJS.ProcessEnv);
    expect(cfg.keyId).toBe("ABC123");
    expect(cfg.issuerId).toBe("issuer-uuid");
    expect(cfg.privateKey).toContain("PRIVATE KEY");
  });

  it("throws ConfigError listing every missing variable", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(ConfigError);
    try {
      loadConfig({} as NodeJS.ProcessEnv);
    } catch (e) {
      expect((e as Error).message).toContain("ASC_KEY_ID");
      expect((e as Error).message).toContain("ASC_ISSUER_ID");
      expect((e as Error).message).toContain("ASC_PRIVATE_KEY");
    }
  });

  it("rejects a private key that is not PEM", () => {
    expect(() =>
      loadConfig({
        ASC_KEY_ID: "ABC123",
        ASC_ISSUER_ID: "issuer-uuid",
        ASC_PRIVATE_KEY: "not-a-key",
      } as NodeJS.ProcessEnv),
    ).toThrow(/PEM/);
  });
});
