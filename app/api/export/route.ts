import { zipSync } from "fflate";
import { getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LOGO_KEY, PACKS, PackId } from "@/lib/prompts.ts";
import { renderAgentOnboarding, renderBundle, renderPack } from "@/lib/render.ts";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("project"));
  const fileParam = url.searchParams.get("file");

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return Response.json({ error: "Proyek tidak valid" }, { status: 400 });
  }
  const project = getProject(projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const sections = getSections(projectId);
  const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prd";

  if (fileParam && fileParam in PACKS) {
    const packId = fileParam as PackId;
    const md = renderPack(packId, sections, project.title);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${PACKS[packId].file}"`,
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

  const bundle = renderBundle(sections, project.title).map((b) => {
    if (b.file !== "BRAND_PACK.md") return b;
    const logo = sections.find((s) => s.key === LOGO_KEY)?.content_md.trim();
    return logo
      ? { ...b, content: `${b.content}\n## Logo\n\nBrand logo file: \`LOGO.svg\` (in this bundle). Use it at 32px+; it scales losslessly.\n\n\`\`\`svg\n${logo}\n\`\`\`\n` }
      : b;
  });
  const logo = sections.find((s) => s.key === LOGO_KEY)?.content_md.trim();
  if (logo) bundle.push({ file: "LOGO.svg", content: logo });
  // AGENTS.md: coding agents (Claude Code, Cursor, Codex) read it automatically.
  bundle.push({ file: "AGENTS.md", content: renderAgentOnboarding(sections, project.title) });
  const zip = zipSync(Object.fromEntries(bundle.map((b) => [b.file, new TextEncoder().encode(b.content)])));
  return new Response(new Uint8Array(zip) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-docs.zip"`,
    },
  });
}
