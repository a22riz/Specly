import { zipSync } from "fflate";
import { getOwnedProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { renderAgentOnboarding, renderBundle, CARA_PAKAI_MD } from "@/lib/render.ts";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("project"));
  const fileParam = url.searchParams.get("file");

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return Response.json({ error: "Proyek tidak valid" }, { status: 400 });
  }
  const project = getOwnedProject(user.id, projectId);
  if (!project) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const sections = getSections(projectId);
  const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prd";

  if (fileParam === "prd") {
    const [prd] = renderBundle(sections, project.title);
    return new Response(prd.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${prd.file}"`,
      },
    });
  }

  if (fileParam === "onboarding") {
    return new Response(renderAgentOnboarding(sections, project.title), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="AGENTS.md"`,
      },
    });
  }

  const bundle = renderBundle(sections, project.title);
  // AGENTS.md: coding agents (Claude Code, Cursor, Codex) read it automatically.
  bundle.push({ file: "AGENTS.md", content: renderAgentOnboarding(sections, project.title) });
  // Human guide for the product owner — Indonesian, sits next to AGENTS.md.
  bundle.push({ file: "CARA_PAKAI.md", content: CARA_PAKAI_MD });
  const zip = zipSync(Object.fromEntries(bundle.map((b) => [b.file, new TextEncoder().encode(b.content)])));
  return new Response(new Uint8Array(zip) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-docs.zip"`,
    },
  });
}
