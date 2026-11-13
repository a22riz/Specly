import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getOwnedProject, getPlan, getSections, savePlan, saveSection } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildReviewPrompt } from "@/lib/prompts";
import { escalationToDecision, parseReview, planReview } from "@/lib/review";
import { mergeDecisions, minimalPlan } from "@/lib/plan";
import { hasAnyContent } from "@/lib/prd";

type ReviewBody = { projectId: number };

// shortcut: one non-streamed call returning JSON (no SSE) — a review is a single
// result, so a spinner in the editor is enough. Upgrade: stream `findings` if
// reviews get slow.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const parsed: unknown = await request.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const body = parsed as ReviewBody;
  if (!Number.isInteger(body.projectId) || body.projectId <= 0) {
    return Response.json({ error: "Proyek wajib diisi" }, { status: 400 });
  }

  const project = getOwnedProject(user.id, body.projectId);
  if (!project) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const sections = getSections(body.projectId);
  if (!hasAnyContent(sections)) {
    return Response.json({ error: "Belum ada PRD untuk ditinjau" }, { status: 409 });
  }

  const plan = getPlan(body.projectId) ?? minimalPlan();
  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  let text: string;
  let usage = { input: 0, output: 0 };
  try {
    const result = streamText({
      model: provider.chat(config.model),
      system: buildReviewPrompt(project.title, plan, sections),
      messages: [{ role: "user" as const, content: "Review the PRD now." }],
      abortSignal: request.signal,
    });
    text = await result.text;
    try {
      const u = await result.usage;
      usage = { input: u?.inputTokens ?? 0, output: u?.outputTokens ?? 0 };
    } catch {
      // Usage absent on this provider — fall back to zeros.
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI call failed" },
      { status: 500 },
    );
  }

  const { fixes, escalations, notes } = planReview(parseReview(text).findings, sections);

  const applied = fixes.map(({ finding, key, before }) => {
    const after = finding.revisedContent!;
    saveSection(body.projectId, key, after);
    return {
      key,
      issue: finding.issue,
      rule: finding.rule ?? "",
      before,
      removed: finding.removed ?? "",
      after,
    };
  });

  const next = escalations.map((e, i) => escalationToDecision(e.finding, `R${i + 1}`));
  const merged = next.length ? mergeDecisions(plan, next) : plan;
  if (next.length) savePlan(body.projectId, merged);

  return Response.json({
    applied,
    escalated: escalations.length,
    notes: notes.map((n) => ({
      section: n.section,
      weight: n.weight === "high" ? "medium" : n.weight,
      issue: n.issue,
    })),
    decisions: merged.decisions,
    usage,
  });
}
