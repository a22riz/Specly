import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildSystemPrompt, findSection, PACK_ORDER, type PackId } from "@/lib/prompts";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  projectId: number;
  pack: PackId;
  sectionKey: string;
  mode: "suggest" | "refine";
  draft?: string;
  messages: ChatMessage[];
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as ChatBody;
  const section = findSection(body.pack, body.sectionKey);
  if (!section) return Response.json({ error: "Section tidak ditemukan" }, { status: 400 });

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

  // Ground the AI in this pack's own sections plus every pack that comes
  // earlier in the authoring flow (PRD → Brand → Design).
  const upstreamPacks = PACK_ORDER.slice(0, PACK_ORDER.indexOf(body.pack));
  const contextMd = buildContext(body.pack, getSections(body.projectId), upstreamPacks);
  const system = buildSystemPrompt(body.pack, section, body.mode, project.title, contextMd);

  const last = body.messages.at(-1);
  const prompt =
    body.mode === "refine"
      ? `Ini catatan mentah saya untuk bagian "${section.title}":\n\n${body.draft ?? ""}\n\nTolong rapikan jadi isi bagian yang final.`
      : (last?.content ?? "Mulai eksplorasi bagian ini dengan saya.");

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  try {
    const result = streamText({
      // Chat Completions API — what third-party OpenAI-compatible endpoints implement.
      model: provider.chat(config.model),
      system,
      messages: [
        ...body.messages.slice(0, -1),
        { role: "user" as const, content: prompt },
      ],
    });
    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghubungi AI";
    return Response.json({ error: message }, { status: 502 });
  }
}
