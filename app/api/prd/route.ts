import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import {
  getAiConfig,
  getMessages,
  getPlan,
  getProject,
  getSections,
  isDiscoveryDone,
  savePlan,
  saveSection,
} from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildPlanPrompt, buildSectionFromPlanPrompt, PRD_SECTIONS } from "@/lib/prompts";
import { mapLimit } from "@/lib/concurrency";
import { conversationText, extractContent, hasAnyContent, sectionsToWrite } from "@/lib/prd";
import { parsePlan } from "@/lib/plan";

type PrdBody = { projectId: number; force?: boolean };

/** Concurrency cap for the parallel section draft. */
const DRAFT_LIMIT = 4;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const parsed: unknown = await request.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const body = parsed as PrdBody;
  if (!Number.isInteger(body.projectId) || body.projectId <= 0) {
    return Response.json({ error: "Proyek wajib diisi" }, { status: 400 });
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

  if (!isDiscoveryDone(body.projectId) && !body.force) {
    return Response.json({ error: "Selesaikan diskusi dulu", reason: "discovery" }, { status: 409 });
  }

  const existing = getSections(body.projectId);
  if (hasAnyContent(existing) && !body.force) {
    return Response.json(
      { error: "PRD sudah ada — kirim force untuk menimpa", reason: "content" },
      { status: 409 },
    );
  }

  const description = conversationText(getMessages(body.projectId));
  const toWrite = sectionsToWrite(existing, body.force);

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });
  const model = provider.chat(config.model);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller closed (client disconnected). Swallow — work checks request.signal.aborted.
        }
      };

      // 1. Plan — reuse an existing saved plan on re-run, else build one.
      let plan = getPlan(body.projectId);
      if (!plan) {
        try {
          const result = streamText({
            model,
            system: buildPlanPrompt(project.title, description),
            messages: [{ role: "user" as const, content: "Produce the plan now." }],
            abortSignal: request.signal,
          });
          plan = parsePlan(await result.text);
          savePlan(body.projectId, plan);
          send("plan", { category: plan.category });
        } catch (err) {
          send("error", {
            key: "plan",
            message: err instanceof Error ? err.message : "AI call failed",
          });
          controller.close();
          return;
        }
      }

      const currentPlan = plan;

      // 2. Draft sections in parallel, cap DRAFT_LIMIT in flight.
      let written = 0;

      await mapLimit(toWrite, DRAFT_LIMIT, async (section) => {
        // Client cancelled — skip the remaining sections.
        if (request.signal.aborted) return;

        send("section_start", { key: section.key });
        try {
          const result = streamText({
            model,
            system: buildSectionFromPlanPrompt(section, project.title, currentPlan, description),
            messages: [
              { role: "user" as const, content: `Write the "${section.enTitle}" section now.` },
            ],
            abortSignal: request.signal,
          });

          const content = extractContent(await result.text);
          if (content) {
            saveSection(body.projectId, section.key, content);
            send("section_done", { key: section.key });
            written++;
          } else {
            send("error", {
              key: section.key,
              message: "No content block found in AI response",
            });
          }
        } catch (err) {
          send("error", {
            key: section.key,
            message: err instanceof Error ? err.message : "AI call failed",
          });
        }
      });

      send("done", { totalSections: PRD_SECTIONS.length, written });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
