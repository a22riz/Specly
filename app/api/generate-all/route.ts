import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getProject, getSections, saveSection } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildSystemPrompt, PACK_ORDER, PACKS } from "@/lib/prompts";

type GenerateBody = {
  projectId: number;
  idea: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as GenerateBody;
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

      // Build a mutable sections map: start from DB, update as we generate.
      const sectionsMap = new Map(getSections(body.projectId).map((s) => [s.key, s.content_md]));
      const allSectionDefs = PACK_ORDER.flatMap((packId) =>
        PACKS[packId].sections.map((s) => ({ packId, section: s })),
      );
      let generated = 0;
      let skipped = 0;

      for (const { packId, section } of allSectionDefs) {
        // Client cancelled — stop generating and saving.
        if (request.signal.aborted) break;

        // Skip filled sections — never overwrite user work.
        if ((sectionsMap.get(section.key) ?? "").trim()) {
          send("section_skip", { key: section.key, title: section.title });
          skipped++;
          continue;
        }

        send("section_start", { pack: packId, key: section.key, title: section.title });

        const upstreamPacks = PACK_ORDER.slice(0, PACK_ORDER.indexOf(packId));
        const sectionsArray = [...sectionsMap.entries()].map(([key, content_md]) => ({ key, content_md }));
        const contextMd = buildContext(packId, sectionsArray, upstreamPacks);
        const system = buildSystemPrompt(packId, section, "generate", project.title, contextMd);

        try {
          const result = streamText({
            model: provider.chat(config.model),
            system,
            messages: [{ role: "user" as const, content: `Project idea: ${body.idea}\n\nWrite the "${section.enTitle}" section now based on this idea and the context from prior sections.` }],
            abortSignal: request.signal,
          });

          let full = "";
          for await (const delta of result.textStream) {
            full += delta;
            send("chunk", { text: delta });
          }

          const match = full.match(/<content>([\s\S]*?)<\/content>/);
          const content = match?.[1]?.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          if (content) {
            saveSection(body.projectId, section.key, content);
            sectionsMap.set(section.key, content);
            send("section_done", { pack: packId, key: section.key });
            generated++;
          } else {
            send("error", { message: "No content block found in AI response", section: section.key });
          }
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "AI call failed", section: section.key });
        }
      }

      send("done", { totalSections: allSectionDefs.length, generated, skipped });
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
