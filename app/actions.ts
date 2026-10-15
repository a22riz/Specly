"use server";

import { revalidatePath } from "next/cache";
import { getAiConfig, listProjects, saveAiConfig, saveSection, getDb } from "@/lib/db";
import type { AiConfig, Project } from "@/lib/db";

export async function fetchAiConfigAction(): Promise<AiConfig> {
  return getAiConfig();
}

export async function saveAiConfigAction(config: AiConfig): Promise<void> {
  if (!config.base_url.trim()) throw new Error("Base URL wajib diisi");
  saveAiConfig(config);
}

export async function createProjectAction(title: string): Promise<Project> {
  const t = title.trim();
  if (!t) throw new Error("Judul wajib diisi");
  const db = getDb();
  const id = db
    .prepare("INSERT INTO projects (title) VALUES (?)")
    .run(t).lastInsertRowid as number;
  revalidatePath("/");
  return getProjectById(id) as Project;
}

export async function deleteProjectAction(id: number): Promise<void> {
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
  revalidatePath("/");
}

export async function saveSectionAction(
  projectId: number,
  key: string,
  contentMd: string,
): Promise<void> {
  saveSection(projectId, key, contentMd);
}

function getProjectById(id: number): Project | undefined {
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}

export async function listProjectsAction(): Promise<Project[]> {
  return listProjects();
}
