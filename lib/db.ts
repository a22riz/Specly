import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.PRD_DB_PATH ?? path.join(process.cwd(), "data", "prd.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    api_key TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini'
  );
  INSERT OR IGNORE INTO ai_config (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    content_md TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, key)
  );
`);

export type AiConfig = {
  base_url: string;
  api_key: string;
  model: string;
};

export type Project = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Section = {
  project_id: number;
  key: string;
  content_md: string;
  updated_at: string;
};

export function getDb() {
  return db;
}

export function getAiConfig(): AiConfig {
  return db.prepare("SELECT base_url, api_key, model FROM ai_config WHERE id = 1").get() as AiConfig;
}

export function saveAiConfig(config: AiConfig) {
  db.prepare("UPDATE ai_config SET base_url = ?, api_key = ?, model = ? WHERE id = 1").run(
    config.base_url,
    config.api_key,
    config.model,
  );
}

export function listProjects(): Project[] {
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Project[];
}

export function getProject(id: number): Project | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
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
