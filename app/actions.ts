"use server";

import { revalidatePath } from "next/cache";
import {
  addMessage,
  createProject,
  createUser,
  deleteOwnedProject,
  deleteUser,
  getAiConfig,
  getOwnedProject,
  getPlan,
  getUserByEmail,
  getUserById,
  listProjects,
  listUsers,
  markDiscoveryDone,
  mergeAiConfig,
  saveAiConfig,
  savePlan,
  saveSection,
  setUserBlocked,
  setUserRole,
  setUserVerified,
  toAiConfigView,
} from "@/lib/db";
import type { AiConfigView, Project } from "@/lib/db";
import { endSession, getSessionUser, startSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth-crypto";
import { deriveTitle } from "@/lib/prd";
import { PRD_SECTIONS } from "@/lib/prompts";
import { minimalPlan, normalizeDecisions, type Decision } from "@/lib/plan";

// A valid hash for a non-existent account. verifyPassword runs against it even
// when the email is unknown, so login timing cannot reveal which emails exist.
const DUMMY_HASH = hashPassword("__specly_dummy__");

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
  // Always run the scrypt verify (against a dummy hash when the user is unknown)
  // so response time does not leak whether the email is registered.
  const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
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

export async function fetchAiConfigAction(): Promise<AiConfigView> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  // Client-safe view: never returns the API key (only whether one is set).
  return toAiConfigView(getAiConfig(user.id));
}

export async function saveAiConfigAction(
  config: AiConfigView & { api_key?: string },
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  const baseUrl = config.base_url.trim();
  if (!baseUrl) throw new Error("Base URL wajib diisi");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Base URL harus diawali http:// atau https://");
  }
  // An empty api_key means "keep the stored key" — the browser never held it.
  saveAiConfig(user.id, mergeAiConfig(getAiConfig(user.id), { ...config, base_url: baseUrl }));
}

// --- Projects (scoped to the signed-in user) ---

export async function createProjectAction(title: string, description?: string): Promise<Project> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  const desc = description?.trim() ?? "";
  if (!desc) throw new Error("Ceritakan dulu idemu");
  const t = title.trim() || deriveTitle(desc);
  if (!t) throw new Error("Judul wajib diisi");
  const project = createProject(user.id, t);
  addMessage(project.id, "user", desc);
  revalidatePath("/");
  return project;
}

export async function deleteProjectAction(id: number): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  deleteOwnedProject(user.id, id);
  revalidatePath("/");
}

export async function saveSectionAction(
  projectId: number,
  key: string,
  contentMd: string,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  if (!getOwnedProject(user.id, projectId)) throw new Error("Proyek tidak ditemukan");
  if (!PRD_SECTIONS.some((s) => s.key === key)) throw new Error("Bagian tidak dikenal");
  saveSection(projectId, key, contentMd);
}

export async function finishDiscoveryAction(projectId: number): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  if (!getOwnedProject(user.id, projectId)) throw new Error("Proyek tidak ditemukan");
  markDiscoveryDone(projectId);
}

export async function saveDecisionsAction(
  projectId: number,
  decisions: Decision[],
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu");
  if (!getOwnedProject(user.id, projectId)) throw new Error("Proyek tidak ditemukan");
  savePlan(projectId, {
    ...(getPlan(projectId) ?? minimalPlan()),
    decisions: normalizeDecisions(decisions),
  });
}

export async function listProjectsAction(): Promise<Project[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return listProjects(user.id);
}
