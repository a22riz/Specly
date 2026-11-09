import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { addMessage, getAiConfig, getMessages, getOwnedProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildDiscoveryPrompt, buildPrdContext } from "@/lib/prompts";
import { DISCOVERY_MAX } from "@/lib/discovery";

type DiscoveryBody = { projectId: number; message?: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const parsed: unknown = await request.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const body = parsed as DiscoveryBody;
  if (!Number.isInteger(body.projectId) || body.projectId <= 0) {
    return Response.json({ error: "Proyek wajib diisi" }, { status: 400 });
  }
  if (body.message !== undefined && (typeof body.message !== "string" || body.message.trim() === "")) {
    return Response.json({ error: "Pesan wajib diisi" }, { status: 400 });
  }

  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const project = getOwnedProject(user.id, body.projectId);
  if (!project) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  if (body.message === undefined && getMessages(body.projectId).length === 0) {
    return Response.json({ error: "Kirim pesan dulu" }, { status: 400 });
  }

  // Persist the user turn first, so the history we stream from includes it.
  if (body.message !== undefined) addMessage(body.projectId, "user", body.message);

  const history = getMessages(body.projectId);
  const askedCount = history.filter((m) => m.role === "assistant").length;
  const prdContext = buildPrdContext(getSections(body.projectId));
  const system = buildDiscoveryPrompt(project.title, prdContext, askedCount, DISCOVERY_MAX);
  // ponytail: cap at the last 20 messages to bound prompt size; summarize older turns once this bites.
  const messages = history.slice(-20).map((m) => ({
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
