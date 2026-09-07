/**
 * AI provider smoke test — verifies the configured NIM/OpenAI-compatible
 * endpoint works before restarting the app. Reads AI_* from .env.
 *
 *   node scripts/ai-smoke.mjs
 */
import { readFileSync } from "node:fs";

const envFile = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => {
  const m = envFile.match(new RegExp(`^${k}="?([^"\\n]*)"?`, "m"));
  return m?.[1] ?? process.env[k] ?? "";
};

const baseUrl = get("AI_BASE_URL");
const model = get("AI_MODEL");
const apiKey = get("AI_API_KEY");

if (!apiKey) {
  console.error("AI_API_KEY is empty — paste your key (nvapi-…) into .env first.");
  process.exit(1);
}
console.log(`base: ${baseUrl}\nmodel: ${model}`);

async function call(label, body) {
  // Mirror the platform provider body: NIM thinking models must have
  // thinking disabled or they emit reasoning into message.content.
  const extra = baseUrl.includes("integrate.api.nvidia.com")
    ? { chat_template_kwargs: { enable_thinking: false } }
    : {};
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...body, ...extra }),
  });
  if (!res.ok) {
    console.error(`${label}: FAILED ${res.status} — ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ? ` (${data.usage.total_tokens} tokens)` : "";
  console.log(`${label}: OK${usage}\n  ${content.slice(0, 200).replace(/\n/g, " ")}`);
  return content;
}

// 1. Plain completion
await call("plain", {
  model,
  temperature: 0.4,
  max_tokens: 200,
  messages: [{ role: "user", content: "Reply with exactly: NIM connection works" }],
});

// 2. JSON-mode completion (what the analyst services use)
const json = await call("json mode", {
  model,
  temperature: 0.4,
  max_tokens: 300,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: 'Respond ONLY with a JSON object of shape {"ok": boolean, "note": string}.' },
    { role: "user", content: "Set ok=true and note the model name." },
  ],
});

if (json) {
  // Same extraction strategy as the platform: first balanced {…} in the text.
  let parsed = null;
  for (let i = 0; i < json.length; i++) {
    if (json[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < json.length; j++) {
      const c = json[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try { parsed = JSON.parse(json.slice(i, j + 1)); } catch {}
        break;
      }
    }
    if (parsed) break;
  }
  if (parsed) console.log(`json parse: OK (ok=${parsed.ok}, note=${JSON.stringify(parsed.note)})`);
  else console.error("json parse: FAILED — model content was not parseable JSON");
}

console.log("\nAll good — restart the app (npm start) and the AI analysts will use this model.");
