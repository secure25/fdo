/**
 * AI provider abstraction. Any OpenAI-compatible endpoint works
 * (OpenAI, Groq, Z.AI, vLLM, llama.cpp server, ...).
 * Every AI consumer must have a deterministic fallback so the platform is
 * fully functional with no keys configured.
 */

import { env, hasAI } from "../env";
import { logger } from "../logger";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompletionRequest = {
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<string>;
  stream(req: CompletionRequest): AsyncGenerator<string>;
}

class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";
  readonly model = env.ai.model;

  private body(req: CompletionRequest, stream: boolean) {
    return {
      model: env.ai.model,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 1200,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
      // NVIDIA NIM thinking models emit reasoning into content unless it is
      // explicitly disabled, which breaks structured-JSON consumers.
      ...(env.ai.baseUrl.includes("integrate.api.nvidia.com")
        ? { chat_template_kwargs: { enable_thinking: false } }
        : {}),
      stream,
      messages: [{ role: "system", content: req.system }, ...req.messages],
    };
  }

  private async post(body: unknown): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), env.ai.timeoutMs);
    try {
      return await fetch(`${env.ai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ai.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async complete(req: CompletionRequest): Promise<string> {
    let res = await this.post(this.body(req, false));
    // Some OpenAI-compatible providers reject response_format for certain
    // models — retry once without it; parseJsonLoose handles raw JSON anyway.
    if (!res.ok && req.json && res.status === 400) {
      const { response_format: _ignored, ...rest } = this.body(req, false) as Record<string, unknown>;
      res = await this.post(rest);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI provider ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return stripReasoningTags(data.choices?.[0]?.message?.content ?? "");
  }

  async *stream(req: CompletionRequest): AsyncGenerator<string> {
    const res = await this.post(this.body(req, true));
    if (!res.ok || !res.body) throw new Error(`AI provider ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore malformed keepalive lines
        }
      }
    }
  }
}

/** Reasoning models may leak <think>…</think> blocks into content; drop them. */
export function stripReasoningTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * Runs an AI call with graceful degradation:
 * - no key configured -> null (caller uses deterministic engine)
 * - provider error    -> logged, null (caller uses deterministic engine)
 */
export async function tryAI<T>(
  run: (ai: AIProvider) => T | Promise<T>,
  opts: { creditOrgId?: string; label: string }
): Promise<T | null> {
  if (!hasAI()) return null;
  const ai = new OpenAICompatibleProvider();
  try {
    return await run(ai);
  } catch (err) {
    logger.warn("AI call failed; falling back to deterministic engine", {
      label: opts.label,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Extract the first JSON object/array from a model response. */
export function parseJsonLoose<T>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  // Reasoning models may emit prose — and even JSON-schema echoes — before the
  // real payload, so try every opening bracket with a balanced-close scan.
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch !== "{" && ch !== "[") continue;
    const slice = balancedSlice(candidate, i);
    if (slice === null) continue;
    try {
      return JSON.parse(slice) as T;
    } catch {
      // try the next opening bracket
    }
  }
  return null;
}

function balancedSlice(candidate: string, start: number): string | null {
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

export const aiAvailable = hasAI;
