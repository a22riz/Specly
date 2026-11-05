import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { addMessage, getAiConfig, getMessages, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildExplorePrompt, buildPrdContext } from "@/lib/prompts";

type ChatBody = { projectId: number; message: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as ChatBody;
  if (
    !Number.isInteger(body.projectId) ||
    body.projectId <= 0 ||
    typeof body.message !== "string" ||
    body.message.trim() === ""
  ) {
    return Response.json({ error: "Proyek dan pesan wajib diisi" }, { status: 400 });
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

  // Persist the user turn first, so the history we stream from includes it.
  addMessage(body.projectId, "user", body.message);

  const prdContext = buildPrdContext(getSections(body.projectId));
  const system = buildExplorePrompt(project.title, prdContext);
  const messages = getMessages(body.projectId).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  try {
    const result = streamText({
      // Chat Completions API — what third-party OpenAI-compatible endpoints implement.
      model: provider.chat(config.model),
      system,
      messages,
      onEnd: ({ text }) => addMessage(body.projectId, "assistant", text),
    });
    // Drain the stream independent of the client so `onEnd` runs (and the
    // assistant reply persists) even if the client disconnects mid-generation.
    void result.consumeStream({ onError: () => {} });
    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghubungi AI";
    return Response.json({ error: message }, { status: 502 });
  }
}
