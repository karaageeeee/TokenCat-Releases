import { importPKCS8, SignJWT } from "jose";
import type { AscConfig } from "../config.js";

const AUDIENCE = "appstoreconnect-v1";
/** Apple allows up to 20 minutes; we use a shorter window and refresh early. */
const TOKEN_TTL_SECONDS = 15 * 60;
/** Refresh this many seconds before expiry to avoid clock-skew rejections. */
const REFRESH_SKEW_SECONDS = 60;

/**
 * Issues and caches ES256 JWTs for the App Store Connect API.
 *
 * The token is reused until it is close to expiry, then re-signed. One provider
 * instance per process is enough.
 */
export class TokenProvider {
  private cachedToken: string | null = null;
  private expiresAtMs = 0;

  constructor(private readonly config: AscConfig) {}

  /** Returns a valid bearer token, signing a fresh one if needed. */
  async getToken(now: number = Date.now()): Promise<string> {
    if (this.cachedToken && now < this.expiresAtMs - REFRESH_SKEW_SECONDS * 1000) {
      return this.cachedToken;
    }
    const token = await this.signToken(Math.floor(now / 1000));
    this.cachedToken = token;
    this.expiresAtMs = now + TOKEN_TTL_SECONDS * 1000;
    return token;
  }

  private async signToken(iatSeconds: number): Promise<string> {
    const key = await importPKCS8(this.config.privateKey, "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId, typ: "JWT" })
      .setIssuer(this.config.issuerId)
      .setIssuedAt(iatSeconds)
      .setExpirationTime(iatSeconds + TOKEN_TTL_SECONDS)
      .setAudience(AUDIENCE)
      .sign(key);
  }
}
