import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "specly-"));
process.env.PRD_DB_PATH = join(dir, "t.sqlite");

// Pre-seed a legacy projects table (no discovery_done) so the import runs the migration.
{
  const Database = (await import("better-sqlite3")).default;
  const legacy = new Database(process.env.PRD_DB_PATH);
  legacy.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
    CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL);
    INSERT INTO users (email, password_hash) VALUES ('legacy@t','x');
    INSERT INTO projects (user_id, title) VALUES (1,'Legacy');
  `);
  legacy.close();
}

const { getDb, isDiscoveryDone, markDiscoveryDone } = await import("../lib/db.ts");

// Pre-existing project: migration backfills discovery_done = 1 (skips the gate).
assert.equal(isDiscoveryDone(1), true, "legacy project backfilled as done");

getDb().prepare("INSERT INTO users (email, password_hash) VALUES ('t@t','x')").run();
const projectId = getDb()
  .prepare("INSERT INTO projects (user_id, title) VALUES (2,'P')")
  .run().lastInsertRowid;

assert.equal(isDiscoveryDone(projectId), false);
markDiscoveryDone(projectId);
assert.equal(isDiscoveryDone(projectId), true);
markDiscoveryDone(projectId); // idempotent
assert.equal(isDiscoveryDone(projectId), true);
console.log("db-discovery.test OK");
