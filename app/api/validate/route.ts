import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildValidationPrompt, PACK_ORDER } from "@/lib/prompts";

type ValidateBody = { projectId: number };
type Finding = { severity: "error" | "warning" | "info"; section: string; message: string; suggestion: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as ValidateBody;
  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json({ error: "AI belum dikonfigurasi" }, { status: 400 });
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const sections = getSections(body.projectId);
  const contextMd = buildContext(PACK_ORDER[0], sections, PACK_ORDER.slice(1));
  const prompt = buildValidationPrompt(contextMd);

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  try {
    const result = await generateText({
      model: provider.chat(config.model),
      system: prompt,
      messages: [{ role: "user" as const, content: "Validate this blueprint and return the findings JSON array." }],
    });

    const text = result.text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    let findings: Finding[] = [];
    try {
      const parsed = JSON.parse(text);
      findings = Array.isArray(parsed) ? parsed : [];
    } catch {
      findings = [];
    }
    return Response.json({ findings });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menghubungi AI" },
      { status: 502 },
    );
  }
}
