import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PRD_DB_PATH = join(mkdtempSync(join(tmpdir(), "specly-")), "t.sqlite");
const { getDb, getMessages, addMessage, clearMessages } = await import("../lib/db.ts");

// projects.user_id is FK ON DELETE CASCADE with foreign_keys ON — seed a user first.
getDb().prepare("INSERT INTO users (email, password_hash) VALUES ('t@t', 'x')").run();

const pid = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1, 'P')").run().lastInsertRowid;
const u2 = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1, 'Q')").run().lastInsertRowid;
addMessage(pid, "user", "halo");
addMessage(pid, "assistant", "hai");
addMessage(u2, "user", "lain");

const msgs = getMessages(pid);
assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant"], "ordered by id");
assert.equal(msgs[0].content, "halo", "content stored verbatim");
assert.equal(getMessages(u2).length, 1, "scoped by project");

clearMessages(pid);
assert.equal(getMessages(pid).length, 0, "cleared");
assert.equal(getMessages(u2).length, 1, "clear scoped");
console.log("db-messages.test OK");
