import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { decryptSecret, encryptSecret } from "./auth-crypto.ts";
import type { Plan } from "./plan.ts";
import { parsePlan } from "./plan.ts";

const DB_PATH = process.env.PRD_DB_PATH ?? path.join(process.cwd(), "data", "prd.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    email_verified INTEGER NOT NULL DEFAULT 0,
    blocked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    api_key TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini'
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    discovery_done INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    content_md TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, key)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, id);
`);

// One-time evolution of an existing users table (fresh installs skip this).
for (const [col, ddl] of [
  ["role", "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'"],
  ["email_verified", "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"],
  ["blocked", "ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0"],
] as const) {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === col)) db.exec(ddl);
}
// One-time evolution of an existing projects table.
{
  const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "plan_json")) db.exec("ALTER TABLE projects ADD COLUMN plan_json TEXT");
  if (!cols.some((c) => c.name === "discovery_done")) {
    db.exec("ALTER TABLE projects ADD COLUMN discovery_done INTEGER NOT NULL DEFAULT 0");
    // Backfill: projects that predate the gate are treated as already discovered.
    db.exec("UPDATE projects SET discovery_done = 1");
  }
}
// Bootstrap guard: an install with users but no admin (pre-role rows) promotes
// its oldest user so the instance is never locked out of /admin.
const adminCount = (db.prepare("SELECT count(*) c FROM users WHERE role = 'admin'").get() as { c: number }).c;
if (adminCount === 0) {
  db.exec(
    "UPDATE users SET role = 'admin', email_verified = 1 WHERE id = (SELECT min(id) FROM users)",
  );
}

export type AiConfig = {
  base_url: string;
  api_key: string;
  model: string;
};

/**
 * The only config shape that may leave the server. It reports whether a key is
 * set, never the key itself — the browser cannot leak a secret it never receives.
 */
export type AiConfigView = {
  base_url: string;
  model: string;
  has_key: boolean;
};

export type User = {
  id: number;
  email: string;
  password_hash: string;
  role: "admin" | "member";
  email_verified: number;
  blocked: number;
  created_at: string;
};

export type Project = {
  id: number;
  user_id: number;
  title: string;
  discovery_done: number;
  created_at: string;
  updated_at: string;
};

export type Section = {
  project_id: number;
  key: string;
  content_md: string;
  updated_at: string;
};

export type Message = {
  id: number;
  project_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function getDb() {
  return db;
}

export function getAiConfig(userId: number): AiConfig {
  const row = db
    .prepare("SELECT base_url, api_key, model FROM ai_config WHERE user_id = ?")
    .get(userId) as { base_url: string; api_key: string; model: string } | undefined;
  if (!row) return { base_url: "https://api.openai.com/v1", api_key: "", model: "gpt-4o-mini" };
  // Server-only: the decrypted key is used to call the AI provider. Anything that
  // crosses to the browser must go through `toAiConfigView` instead.
  return { ...row, api_key: decryptSecret(row.api_key) };
}

/** Project a config down to the client-safe view: no key, only `has_key`. */
export function toAiConfigView(config: AiConfig): AiConfigView {
  return {
    base_url: config.base_url,
    model: config.model,
    has_key: config.api_key.trim() !== "",
  };
}

/**
 * Merge a client save into the stored config. A blank/absent `api_key` means
 * "keep the stored key": the browser never receives the key, so it cannot resend
 * it, and an untouched field must not wipe the credential. Blank base_url/model
 * likewise fall back to the stored value.
 */
export function mergeAiConfig(stored: AiConfig, incoming: Partial<AiConfig>): AiConfig {
  const key = typeof incoming.api_key === "string" ? incoming.api_key.trim() : "";
  return {
    base_url: incoming.base_url?.trim() || stored.base_url,
    model: incoming.model?.trim() || stored.model,
    api_key: key || stored.api_key,
  };
}

export function saveAiConfig(userId: number, config: AiConfig) {
  db.prepare(
    `INSERT INTO ai_config (user_id, base_url, api_key, model) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET base_url = excluded.base_url, api_key = excluded.api_key, model = excluded.model`,
  ).run(userId, config.base_url.trim(), encryptSecret(config.api_key.trim()), config.model.trim());
}

// --- Users ---

export function getUserByEmail(email: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
    | User
    | undefined;
}

export function getUserById(id: number): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function createUser(email: string, passwordHash: string): User {
  // First user ever bootstraps the admin (self-verified); everyone else is a
  // member awaiting admin approval.
  const isFirst = (db.prepare("SELECT count(*) c FROM users").get() as { c: number }).c === 0;
  const id = db
    .prepare("INSERT INTO users (email, password_hash, role, email_verified) VALUES (?, ?, ?, ?)")
    .run(email.trim().toLowerCase(), passwordHash, isFirst ? "admin" : "member", isFirst ? 1 : 0)
    .lastInsertRowid as number;
  return getUserById(id) as User;
}

// --- User management (admin) ---

export function listUsers(): Omit<User, "password_hash">[] {
  return db
    .prepare("SELECT id, email, role, email_verified, blocked, created_at FROM users ORDER BY created_at")
    .all() as Omit<User, "password_hash">[];
}

/** Users with per-user activity counts for the admin dashboard. */
export function listUsersWithStats() {
  return db
    .prepare(
      `SELECT u.id, u.email, u.role, u.email_verified, u.blocked, u.created_at,
        (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS project_count,
        (SELECT COUNT(*) FROM sections s JOIN projects p ON p.id = s.project_id
          WHERE p.user_id = u.id AND s.key LIKE 'prd.%'
            AND s.content_md != '' AND s.content_md != '_Belum diisi._') AS prd_filled
      FROM users u ORDER BY u.created_at`,
    )
    .all() as (Omit<User, "password_hash"> & { project_count: number; prd_filled: number })[];
}

export function setUserVerified(id: number, verified: boolean) {
  db.prepare("UPDATE users SET email_verified = ? WHERE id = ? AND role = 'member'").run(
    verified ? 1 : 0,
    id,
  );
}

export function setUserBlocked(id: number, blocked: boolean) {
  db.prepare("UPDATE users SET blocked = ? WHERE id = ? AND role = 'member'").run(
    blocked ? 1 : 0,
    id,
  );
}

export function setUserRole(id: number, role: "admin" | "member") {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function deleteUser(id: number) {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'member'").run(id);
}

export function listProjects(userId: number): Project[] {
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as Project[];
}

export function getProject(id: number): Project | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}

/**
 * Project scoped to its owner — the single ownership check. Returns undefined
 * when the project is missing OR belongs to another user, so callers cannot
 * accidentally serve someone else's project by checking id alone.
 */
export function getOwnedProject(userId: number, projectId: number): Project | undefined {
  const project = getProject(projectId);
  return project && project.user_id === userId ? project : undefined;
}

export function createProject(userId: number, title: string): Project {
  const id = db
    .prepare("INSERT INTO projects (user_id, title) VALUES (?, ?)")
    .run(userId, title).lastInsertRowid as number;
  return getProject(id) as Project;
}

/** Deletes only when the project belongs to the user; returns rows affected. */
export function deleteOwnedProject(userId: number, projectId: number): number {
  return db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, userId)
    .changes;
}

export function getSections(projectId: number): Section[] {
  return db.prepare("SELECT * FROM sections WHERE project_id = ?").all(projectId) as Section[];
}

export function saveSection(projectId: number, key: string, contentMd: string) {
  db.prepare(
    `INSERT INTO sections (project_id, key, content_md) VALUES (?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET content_md = excluded.content_md, updated_at = datetime('now')`,
  ).run(projectId, key, contentMd);
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(projectId);
}

// --- Conversation (per project) ---

export function getMessages(projectId: number): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE project_id = ? ORDER BY id")
    .all(projectId) as Message[];
}

export function addMessage(projectId: number, role: Message["role"], content: string) {
  db.prepare("INSERT INTO messages (project_id, role, content) VALUES (?, ?, ?)").run(
    projectId,
    role,
    content,
  );
}

export function clearMessages(projectId: number) {
  db.prepare("DELETE FROM messages WHERE project_id = ?").run(projectId);
}

// --- Plan (per project) ---

export function getPlan(projectId: number): Plan | null {
  const row = db.prepare("SELECT plan_json FROM projects WHERE id = ?").get(projectId) as
    | { plan_json: string | null }
    | undefined;
  if (!row || !row.plan_json) return null;
  // Normalize through parsePlan so stored shapes stay consistent.
  return parsePlan(row.plan_json);
}

export function savePlan(projectId: number, plan: Plan) {
  db.prepare("UPDATE projects SET plan_json = ?, updated_at = datetime('now') WHERE id = ?").run(
    JSON.stringify(plan),
    projectId,
  );
}

// --- Discovery gate (per project) ---

export function isDiscoveryDone(projectId: number): boolean {
  const row = db.prepare("SELECT discovery_done FROM projects WHERE id = ?").get(projectId) as
    | { discovery_done: number }
    | undefined;
  return !!row?.discovery_done;
}

export function markDiscoveryDone(projectId: number): void {
  db.prepare("UPDATE projects SET discovery_done = 1 WHERE id = ?").run(projectId);
}
