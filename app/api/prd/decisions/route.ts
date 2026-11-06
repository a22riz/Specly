import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getPlan, getProject, savePlan } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildDecisionsRefinePrompt } from "@/lib/prompts";
import { mergeDecisions, minimalPlan, parsePlan, planText } from "@/lib/plan";

type DecisionsBody = { projectId: number; instruction: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const parsed: unknown = await request.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const body = parsed as DecisionsBody;
  if (
    !Number.isInteger(body.projectId) ||
    body.projectId <= 0 ||
    typeof body.instruction !== "string" ||
    body.instruction.trim() === ""
  ) {
    return Response.json({ error: "Proyek dan instruksi wajib diisi" }, { status: 400 });
  }

  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const plan = getPlan(body.projectId) ?? minimalPlan();
  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  let text: string;
  try {
    const result = streamText({
      model: provider.chat(config.model),
      system: buildDecisionsRefinePrompt(planText(plan), body.instruction),
      messages: [{ role: "user" as const, content: "Rewrite the decisions now." }],
      abortSignal: request.signal,
    });
    text = await result.text;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI call failed" },
      { status: 500 },
    );
  }

  const next = parsePlan(text).decisions;
  if (next.length === 0) {
    return Response.json({ error: "AI tidak mengembalikan keputusan" }, { status: 400 });
  }

  const merged = mergeDecisions(plan, next);
  savePlan(body.projectId, merged);
  return Response.json({ decisions: merged.decisions });
}
