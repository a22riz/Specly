import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getMessages, getProject, getSections, saveSection } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildPrdContext, buildWriteSectionPrompt, PRD_SECTIONS } from "@/lib/prompts";
import { conversationText, extractContent, hasAnyContent, sectionsToWrite } from "@/lib/prd";

type PrdBody = { projectId: number; force?: boolean };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as PrdBody;
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

  const existing = getSections(body.projectId);
  if (hasAnyContent(existing) && !body.force) {
    return Response.json(
      { error: "PRD sudah ada — kirim force untuk menimpa" },
      { status: 409 },
    );
  }

  const convo = conversationText(getMessages(body.projectId));
  const toWrite = sectionsToWrite(existing, body.force);

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller closed (client disconnected). Swallow — loop checks request.signal.aborted.
        }
      };

      // Mutable sections map: start from DB, update as we write, so later
      // sections see the current PRD as context.
      const sectionsMap = new Map(existing.map((s) => [s.key, s.content_md]));
      let written = 0;

      for (const section of toWrite) {
        // Client cancelled — stop writing and saving.
        if (request.signal.aborted) break;

        send("section_start", { key: section.key, title: section.title });

        const sectionsArray = [...sectionsMap.entries()].map(([key, content_md]) => ({
          key,
          content_md,
        }));
        const system = buildWriteSectionPrompt(
          section,
          project.title,
          buildPrdContext(sectionsArray),
          convo,
        );

        try {
          const result = streamText({
            model: provider.chat(config.model),
            system,
            messages: [
              { role: "user" as const, content: `Write the "${section.enTitle}" section now.` },
            ],
            abortSignal: request.signal,
          });

          let full = "";
          for await (const delta of result.textStream) {
            full += delta;
            send("chunk", { text: delta });
          }

          const content = extractContent(full);
          if (content) {
            saveSection(body.projectId, section.key, content);
            sectionsMap.set(section.key, content);
            send("section_done", { key: section.key });
            written++;
          } else {
            send("error", { key: section.key, message: "No content block found in AI response" });
          }
        } catch (err) {
          send("error", {
            key: section.key,
            message: err instanceof Error ? err.message : "AI call failed",
          });
        }
      }

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
