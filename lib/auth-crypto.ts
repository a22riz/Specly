import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Pure node:crypto helpers — no Next.js imports so tests can run them directly.
 * lib/auth.ts builds session/cookie logic on top of these.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_COOKIE = "specly_session";

/** Server secret for HMAC sessions + AES key encryption. */
function serverSecret(): Buffer {
  // ponytail: zero-config fallback writes data/secret.key; set SPECLY_SECRET env
  // (any random string) when deploying so the secret is not on the data disk.
  if (process.env.SPECLY_SECRET) {
    return crypto.createHash("sha256").update(process.env.SPECLY_SECRET).digest();
  }
  const file = process.env.PRD_DB_PATH
    ? path.join(path.dirname(process.env.PRD_DB_PATH), "secret.key")
    : path.join(process.cwd(), "data", "secret.key");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return crypto.createHash("sha256").update(fs.readFileSync(file, "utf8").trim()).digest();
}

// --- Passwords (scrypt, stored as "salt:hash" hex) ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

// --- Session tokens ("userId.expiry.hmac") ---

export function createSessionToken(userId: number, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_TTL_MS}`;
  const sig = crypto.createHmac("sha256", serverSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function parseSessionToken(token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const payload = `${id}.${exp}`;
  const expected = crypto.createHmac("sha256", serverSecret()).update(payload).digest();
  const given = Buffer.from(sig, "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const expiry = Number(exp);
  const userId = Number(id);
  if (!Number.isSafeInteger(expiry) || expiry <= now) return null;
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_S = SESSION_TTL_MS / 1000;

// --- Secrets at rest (AES-256-GCM, stored as "iv:tag:cipher" hex) ---

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", serverSecret(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", serverSecret(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return ""; // wrong secret or tampered data — caller treats as unset key
  }
}
