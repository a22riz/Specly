import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PRD_DB_PATH = join(mkdtempSync(join(tmpdir(), "specly-")), "t.sqlite");
const { getDb, getPlan, savePlan } = await import("../lib/db.ts");
getDb().prepare("INSERT INTO users (email, password_hash) VALUES ('t@t','x')").run();
const pid = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1,'P')").run().lastInsertRowid;

assert.equal(getPlan(pid), null, "null before save");
savePlan(pid, { category: "POS", industry: "ritel", scale: "s", platform: "web",
  decisions: [{ id: "payment", label: "Pembayaran", question: "Q", recommended: "Tunai", options: ["Tunai","QRIS"], chosen: "Tunai" }],
  assumptions: [], outline: { "prd.overview": "x" } });
assert.equal(getPlan(pid).category, "POS", "roundtrip");
assert.equal(getPlan(pid).decisions[0].chosen, "Tunai", "chosen persisted verbatim");
assert.equal(getPlan(pid).outline["prd.overview"], "x", "outline untouched");
console.log("db-plan.test OK");
