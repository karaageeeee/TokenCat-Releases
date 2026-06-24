import { describe, expect, it } from "vitest";
import { generateKeyPair, exportPKCS8, jwtVerify, importSPKI, exportSPKI } from "jose";
import { TokenProvider } from "./jwt.js";
import type { AscConfig } from "../config.js";

async function makeConfig(): Promise<{ config: AscConfig; publicKeyPem: string }> {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const config: AscConfig = {
    keyId: "TESTKEY123",
    issuerId: "11111111-2222-3333-4444-555555555555",
    privateKey: await exportPKCS8(privateKey),
  };
  return { config, publicKeyPem: await exportSPKI(publicKey) };
}

describe("TokenProvider", () => {
  it("signs a valid ES256 JWT with the expected header and claims", async () => {
    const { config, publicKeyPem } = await makeConfig();
    const provider = new TokenProvider(config);
    const token = await provider.getToken();

    const pubKey = await importSPKI(publicKeyPem, "ES256");
    const { payload, protectedHeader } = await jwtVerify(token, pubKey, {
      audience: "appstoreconnect-v1",
      issuer: config.issuerId,
    });

    expect(protectedHeader.alg).toBe("ES256");
    expect(protectedHeader.kid).toBe(config.keyId);
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(payload.iss).toBe(config.issuerId);
    expect(payload.exp).toBeDefined();
  });

  it("caches the token until it nears expiry", async () => {
    const { config } = await makeConfig();
    const provider = new TokenProvider(config);
    const t0 = Date.now();
    const a = await provider.getToken(t0);
    const b = await provider.getToken(t0 + 1000);
    expect(a).toBe(b);
  });

  it("refreshes the token once it is close to expiry", async () => {
    const { config } = await makeConfig();
    const provider = new TokenProvider(config);
    const t0 = Date.now();
    const a = await provider.getToken(t0);
    // Jump 15 minutes ahead — past the refresh window.
    const c = await provider.getToken(t0 + 15 * 60 * 1000);
    expect(c).not.toBe(a);
  });
});
