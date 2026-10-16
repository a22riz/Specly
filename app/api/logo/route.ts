import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildLogoPrompt, buildLogoRevisePrompt, LOGO_KEY } from "@/lib/prompts";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const { projectId, svg: currentSvg, feedback } = (await request.json()) as {
    projectId: number;
    svg?: string;
    feedback?: string;
  };
  const project = getProject(projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const brandContext = buildContext(
    "brand",
    getSections(projectId).filter((s) => s.key !== LOGO_KEY),
  );
  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });
  const revise = Boolean(feedback?.trim() && currentSvg?.trim());


  try {
    // Stream + accumulate: this gateway handles SSE reliably but fails long non-stream requests.
    const result = streamText({
      // Chat Completions API — what third-party OpenAI-compatible endpoints implement.
      model: provider.chat(config.model),
      system: revise
        ? buildLogoRevisePrompt(project.title, brandContext, currentSvg!.trim(), feedback!.trim())
        : buildLogoPrompt(project.title, brandContext),
      prompt: revise ? "Revisi logonya sekarang." : "Desain logonya sekarang.",
    });
    let text = "";
    for await (const delta of result.textStream) {
      text += delta;
    }
    const match = text.match(/<content>([\s\S]*?)<\/content>/) ?? text.match(/(<svg[\s\S]*?<\/svg>)/);
    let svg = match?.[1]?.trim() ?? "";
    // ponytail: regex sanitize only — fine for an internal tool where each user
    // only renders their own logo via <img> (scripts never execute there).
    // Swap to a real SVG sanitizer (e.g. DOMPurify server-side) before public use.
    svg = svg
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/<\s*(use|image)[^>]*>/gi, "") // external resource loads
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
    if (!svg.startsWith("<svg")) {
      return Response.json({ error: "AI tidak menghasilkan SVG yang valid. Coba lagi." }, { status: 502 });
    }
    return Response.json({ svg });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghubungi AI";
    return Response.json({ error: message }, { status: 502 });
  }
}
