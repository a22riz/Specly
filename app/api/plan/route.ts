import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildPlanContext, buildPlanPrompt } from "@/lib/prompts";
import { parsePlanResponse } from "@/lib/plan";

type PlanBody = { projectId: number };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as PlanBody;
  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json({ error: "AI belum dikonfigurasi" }, { status: 400 });
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const contextMd = buildPlanContext(getSections(body.projectId));
  const prompt = buildPlanPrompt(contextMd);

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  try {
    const result = await generateText({
      model: provider.chat(config.model),
      system: prompt,
      messages: [{ role: "user" as const, content: "Analyze this blueprint and return the plan JSON." }],
    });

    const plan = parsePlanResponse(result.text);
    if (!plan) {
      return Response.json({ error: "Gagal membuat rencana" }, { status: 502 });
    }
    return Response.json({ plan });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menghubungi AI" },
      { status: 502 },
    );
  }
}
