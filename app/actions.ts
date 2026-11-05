"use server";

import { revalidatePath } from "next/cache";
import {
  addMessage,
  createUser,
  deleteUser,
  getAiConfig,
  getDb,
  getUserByEmail,
  getUserById,
  listProjects,
  listUsers,
  saveAiConfig,
  saveSection,
  setDecision,
  setUserBlocked,
  setUserRole,
  setUserVerified,
} from "@/lib/db";
import type { AiConfig, Project } from "@/lib/db";
import { endSession, getSessionUser, startSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth-crypto";
import { deriveTitle } from "@/lib/prd";

// --- Auth ---

export async function registerAction(
  email: string,
  password: string,
): Promise<{ role: "admin" | "member" }> {
  const mail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Format email tidak valid");
  if (password.length < 8) throw new Error("Password minimal 8 karakter");
  if (getUserByEmail(mail)) throw new Error("Email sudah terdaftar — silakan masuk");
  const user = createUser(mail, hashPassword(password));
  if (user.role === "admin") await startSession(user.id); // first user bootstraps the admin
  return { role: user.role };
}

export async function loginAction(email: string, password: string): Promise<void> {
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Email atau password salah");
  }
  if (user.blocked) throw new Error("Akun diblokir. Hubungi admin.");
  if (!user.email_verified) {
    throw new Error("Akun belum diverifikasi. Tunggu persetujuan admin, lalu coba lagi.");
  }
  await startSession(user.id);
}

export async function logoutAction(): Promise<void> {
  await endSession();
}

// --- User management (admin only) ---

async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Hanya admin yang boleh melakukan ini");
  return user;
}

export async function listUsersAction() {
  await requireAdminAction();
  return listUsers();
}

export async function verifyUserAction(id: number, verified: boolean): Promise<void> {
  await requireAdminAction();
  setUserVerified(id, verified);
  revalidatePath("/admin");
}

export async function blockUserAction(id: number, blocked: boolean): Promise<void> {
  await requireAdminAction();
  setUserBlocked(id, blocked);
  revalidatePath("/admin");
}

export async function setUserRoleAction(id: number, role: "admin" | "member"): Promise<void> {
  const admin = await requireAdminAction();
  if (id === admin.id) throw new Error("Tidak bisa mengubah role sendiri");
  setUserRole(id, role);
  revalidatePath("/admin");
}

export async function deleteUserAction(id: number): Promise<void> {
  const admin = await requireAdminAction();
  if (id === admin.id) throw new Error("Tidak bisa menghapus akun sendiri");
  if (!getUserById(id)) throw new Error("User tidak ditemukan");
  deleteUser(id);
  revalidatePath("/admin");
}

// --- Config (per signed-in user, BYOK) ---

export async function fetchAiConfigAction(): Promise<AiConfig> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  return getAiConfig(user.id);
}

export async function saveAiConfigAction(config: AiConfig): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  if (!config.base_url.trim()) throw new Error("Base URL wajib diisi");
  saveAiConfig(user.id, config);
}

// --- Projects (scoped to the signed-in user) ---

export async function createProjectAction(title: string, description?: string): Promise<Project> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  const desc = description?.trim() ?? "";
  const t = title.trim() || deriveTitle(desc);
  if (!t) throw new Error("Judul wajib diisi");
  const id = getDb()
    .prepare("INSERT INTO projects (user_id, title) VALUES (?, ?)")
    .run(user.id, t).lastInsertRowid as number;
  if (desc) addMessage(id, "user", desc);
  revalidatePath("/");
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
}

export async function deleteProjectAction(id: number): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  getDb().prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, user.id);
  revalidatePath("/");
}

export async function saveSectionAction(
  projectId: number,
  key: string,
  contentMd: string,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  const project = getDb().prepare("SELECT user_id FROM projects WHERE id = ?").get(projectId) as
    | { user_id: number }
    | undefined;
  if (!project || project.user_id !== user.id) throw new Error("Proyek tidak ditemukan");
  saveSection(projectId, key, contentMd);
}

export async function setDecisionAction(
  projectId: number,
  id: string,
  chosen: string,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  const project = getDb().prepare("SELECT user_id FROM projects WHERE id = ?").get(projectId) as
    | { user_id: number }
    | undefined;
  if (!project || project.user_id !== user.id) throw new Error("Proyek tidak ditemukan");
  setDecision(projectId, id, chosen);
}

export async function listProjectsAction(): Promise<Project[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return listProjects(user.id);
}
