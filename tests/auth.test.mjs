import assert from "node:assert";
import {
  createSessionToken,
  decryptSecret,
  encryptSecret,
  hashPassword,
  parseSessionToken,
  verifyPassword,
} from "../lib/auth-crypto.ts";

// Passwords
const stored = hashPassword("rahasia-tim");
assert.ok(stored.includes(":"), "stored format salt:hash");
assert.equal(verifyPassword("rahasia-tim", stored), true, "correct password verifies");
assert.equal(verifyPassword("salah", stored), false, "wrong password rejected");
assert.equal(verifyPassword("salah", "garbage"), false, "malformed stored hash rejected");

// Sessions
const now = 1_000_000_000_000;
const token = createSessionToken(42, now);
assert.equal(parseSessionToken(token, now), 42, "fresh token resolves user id");
assert.equal(parseSessionToken(token + "x", now), null, "tampered signature rejected");
assert.equal(parseSessionToken(token, now + 31 * 24 * 60 * 60 * 1000), null, "expired token rejected");
assert.equal(parseSessionToken(undefined, now), null, "missing token rejected");

// Secrets at rest
const enc = encryptSecret("sk-test-123");
assert.notEqual(enc, "sk-test-123", "ciphertext differs from plaintext");
assert.equal(decryptSecret(enc), "sk-test-123", "roundtrip recovers key");
assert.equal(decryptSecret("bad:data"), "", "malformed ciphertext yields empty");

console.log("auth.test OK");
