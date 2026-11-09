import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "specly-own-"));
process.env.PRD_DB_PATH = join(dir, "t.sqlite");

const { createProject, createUser, deleteOwnedProject, getOwnedProject } = await import(
  "../lib/db.ts"
);

const u1 = createUser("owner@t", "x");
const u2 = createUser("stranger@t", "x");

const a = createProject(u1.id, "Milik A");
assert.equal(a.user_id, u1.id, "createProject scopes to its owner");
assert.equal(a.title, "Milik A");
const b = createProject(u2.id, "Milik B");

// getOwnedProject returns the row only for the owner — never another user's row.
assert.equal(getOwnedProject(u1.id, a.id)?.title, "Milik A");
assert.equal(getOwnedProject(u2.id, a.id), undefined, "another user gets undefined");
assert.equal(getOwnedProject(u1.id, b.id), undefined, "other direction closed too");
assert.equal(getOwnedProject(u1.id, 9999), undefined, "missing project");

// delete is owner-scoped: a stranger's delete is a no-op.
assert.equal(deleteOwnedProject(u2.id, a.id), 0, "stranger delete affects nothing");
assert.equal(getOwnedProject(u1.id, a.id)?.title, "Milik A", "project survives stranger delete");
assert.equal(deleteOwnedProject(u1.id, a.id), 1, "owner delete removes it");
assert.equal(getOwnedProject(u1.id, a.id), undefined);

console.log("db-ownership.test OK");
