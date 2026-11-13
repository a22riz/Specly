import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "specly-aicfg-"));
process.env.PRD_DB_PATH = join(dir, "t.sqlite");

const { createUser, getAiConfig, getDb, mergeAiConfig, saveAiConfig, toAiConfigView } = await import(
  "../lib/db.ts"
);

const stored = { base_url: "https://api.openai.com/v1", api_key: "sk-old-key", model: "gpt-4o-mini" };

// --- F-1: the browser view must never carry the key ---
const view = toAiConfigView(stored);
assert.deepEqual(view, {
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  has_key: true,
});
assert.equal(JSON.stringify(view).includes("sk-old-key"), false, "view never contains the key");
assert.equal(toAiConfigView({ ...stored, api_key: "   " }).has_key, false, "blank key => has_key false");
assert.equal(toAiConfigView({ ...stored, api_key: "" }).has_key, false);

// --- merge: an empty incoming key means "keep the stored one" ---
const kept = mergeAiConfig(stored, {
  base_url: "http://localhost:11434/v1",
  model: "llama3",
  api_key: "",
});
assert.equal(kept.api_key, "sk-old-key", "blank api_key keeps the stored key");
assert.equal(kept.base_url, "http://localhost:11434/v1", "base_url still updates");
assert.equal(kept.model, "llama3", "model still updates");

assert.equal(mergeAiConfig(stored, { api_key: "  sk-new  " }).api_key, "sk-new", "provided key is trimmed in");
assert.deepEqual(mergeAiConfig(stored, {}), stored, "no fields => unchanged");
assert.equal(mergeAiConfig(stored, { base_url: "  " }).base_url, stored.base_url, "blank base keeps stored");

// never invents a key where none exists
const noKey = { base_url: "u", api_key: "", model: "m" };
assert.equal(mergeAiConfig(noKey, { api_key: "" }).api_key, "");

// --- the stored column is ciphertext, and a blank save round-trips ---
const user = createUser("byok@t", "x");
saveAiConfig(user.id, stored);
assert.equal(getAiConfig(user.id).api_key, "sk-old-key", "the server can decrypt its own key");

const raw = getDb().prepare("SELECT api_key FROM ai_config WHERE user_id = ?").get(user.id).api_key;
assert.notEqual(raw, "sk-old-key", "the key is not stored in plaintext");
assert.equal(raw.includes("sk-old-key"), false, "ciphertext leaks nothing");

// client save that leaves the key blank (the new UI does this) must not wipe it
saveAiConfig(
  user.id,
  mergeAiConfig(getAiConfig(user.id), { base_url: stored.base_url, model: stored.model, api_key: "" }),
);
assert.equal(getAiConfig(user.id).api_key, "sk-old-key", "blank save keeps the stored key");

console.log("ai-config.test OK");
