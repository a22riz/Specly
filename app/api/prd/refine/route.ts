import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getPlan, getProject, getSections, saveSection } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildRefinePrompt, PRD_SECTIONS } from "@/lib/prompts";
import { extractContent } from "@/lib/prd";
import { minimalPlan } from "@/lib/plan";

type RefineBody = { projectId: number; key: string; instruction: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const parsed: unknown = await request.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const body = parsed as RefineBody;
  if (
    !Number.isInteger(body.projectId) ||
    body.projectId <= 0 ||
    typeof body.key !== "string" ||
    typeof body.instruction !== "string" ||
    body.instruction.trim() === ""
  ) {
    return Response.json({ error: "Proyek, bagian, dan instruksi wajib diisi" }, { status: 400 });
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const section = PRD_SECTIONS.find((s) => s.key === body.key);
  if (!section) {
    return Response.json({ error: "Bagian tidak dikenal" }, { status: 409 });
  }

  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const plan = getPlan(body.projectId) ?? minimalPlan();
  const current =
    getSections(body.projectId).find((s) => s.key === body.key)?.content_md ?? "";

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

      try {
        const result = streamText({
          model,
          system: buildRefinePrompt(section, project.title, plan, current, body.instruction),
          messages: [{ role: "user" as const, content: `Rewrite the "${section.enTitle}" section now.` }],
          abortSignal: request.signal,
        });

        for await (const chunk of result.textStream) {
          send("chunk", { key: section.key, text: chunk });
        }

        const content = extractContent(await result.text);
        if (content) {
          saveSection(body.projectId, section.key, content);
          send("section_done", { key: section.key });
        } else {
          send("error", { key: section.key, message: "No content block found in AI response" });
        }
      } catch (err) {
        send("error", {
          key: section.key,
          message: err instanceof Error ? err.message : "AI call failed",
        });
      }

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
