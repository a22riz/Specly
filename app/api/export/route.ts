import { zipSync } from "fflate";
import { getProject, getSections } from "@/lib/db";
import { PACKS, PackId } from "@/lib/prompts.ts";
import { renderBundle, renderPack } from "@/lib/render.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("project"));
  const fileParam = url.searchParams.get("file");

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return Response.json({ error: "Proyek tidak valid" }, { status: 400 });
  }
  const project = getProject(projectId);
  if (!project) return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

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

  const bundle = renderBundle(sections, project.title);
  const zip = zipSync(Object.fromEntries(bundle.map((b) => [b.file, new TextEncoder().encode(b.content)])));
  return new Response(new Uint8Array(zip) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-docs.zip"`,
    },
  });
}
