import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { buildContext, buildLogoPrompt, LOGO_KEY } from "@/lib/prompts";

export async function POST(request: Request) {
  const { projectId } = (await request.json()) as { projectId: number };
  const project = getProject(projectId);
  if (!project) return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

  const config = getAiConfig();
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

  try {
    // Stream + accumulate: this gateway handles SSE reliably but fails long non-stream requests.
    const result = streamText({
      // Chat Completions API — what third-party OpenAI-compatible endpoints implement.
      model: provider.chat(config.model),
      system: buildLogoPrompt(project.title, brandContext),
      prompt: "Desain logonya sekarang.",
    });
    let text = "";
    for await (const delta of result.textStream) {
      text += delta;
    }
    const match = text.match(/<content>([\s\S]*?)<\/content>/) ?? text.match(/(<svg[\s\S]*?<\/svg>)/);
    let svg = match?.[1]?.trim() ?? "";
    // ponytail: regex sanitize only — fine for a local tool; swap to a real
    // SVG sanitizer (e.g. DOMPurify server-side) before exposing publicly.
    svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
    if (!svg.startsWith("<svg")) {
      return Response.json({ error: "AI tidak menghasilkan SVG yang valid. Coba lagi." }, { status: 502 });
    }
    return Response.json({ svg });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghubungi AI";
    return Response.json({ error: message }, { status: 502 });
  }
}
