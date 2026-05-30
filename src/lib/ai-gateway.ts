/**
 * Google Gemini REST API helper.
 *
 * Replaces the previous Lovable AI Gateway / Vercel AI SDK integration.
 * Uses native fetch() — no extra npm packages required.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey(): string {
  let key: string | undefined;
  try {
    key = process.env.GEMINI_API_KEY;
  } catch (e) {
    // Process might not be defined in browser context
  }

  if (!key) {
    key = (import.meta.env as any).VITE_GEMINI_API_KEY || (import.meta.env as any).GEMINI_API_KEY;
  }

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or VITE_GEMINI_API_KEY is not configured. Please add your key to the .env file."
    );
  }
  return key;
}

function buildEndpoint(model: string): string {
  return `${GEMINI_API_BASE}/${model}:generateContent?key=${getApiKey()}`;
}

/** Map OpenAI-style role names to Gemini roles. */
function mapRole(role: string): "user" | "model" {
  return role === "assistant" || role === "model" ? "model" : "user";
}

/** Handle non-OK Gemini API responses with clear error messages. */
async function handleApiError(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  let parsedError: any;
  try {
    parsedError = JSON.parse(body);
  } catch {
    // Not JSON
  }

  const errorMessage = parsedError?.error?.message || body || "";

  if (response.status === 429) {
    throw new Error(
      "Gemini API quota exceeded. The free tier has rate limits — please wait a moment and try again."
    );
  }
  if (response.status === 403 || response.status === 400 && errorMessage.toLowerCase().includes("key")) {
    throw new Error(
      "Gemini API key is invalid or lacks permissions. Check your GEMINI_API_KEY in .env."
    );
  }
  throw new Error(
    `Gemini API error (${response.status}): ${errorMessage || response.statusText}`
  );
}

/**
 * Extract the text reply from a Gemini generateContent response body.
 */
function extractText(data: any): string {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked the request: ${blockReason}`);
    }
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error(`Gemini candidate did not finish successfully. Reason: ${finishReason}`);
    }
    throw new Error("Gemini returned an empty response. Please try again.");
  }
  return text;
}

// ────────────────────────────────────────────────────────────
// Public helpers
// ────────────────────────────────────────────────────────────

export type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Send a multi-turn conversation to Gemini and get a plain-text reply.
 * Accepts OpenAI-style messages (system / user / assistant).
 */
export async function geminiGenerateText(
  messages: GeminiMessage[]
): Promise<string> {
  // Separate system instruction from conversation turns.
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);

  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const m of messages) {
    if (m.role === "system") continue;
    const role = mapRole(m.role);
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      // Merge consecutive messages of the same role to strictly alternate
      contents[contents.length - 1].parts[0].text += "\n\n" + m.content;
    } else {
      contents.push({
        role,
        parts: [{ text: m.content }],
      });
    }
  }

  // Gemini requires the conversation to start with a "user" turn.
  if (contents.length > 0 && contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  const body: Record<string, any> = { contents };

  if (systemParts.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemParts.join("\n\n") }],
    };
  }

  const response = await fetch(buildEndpoint(GEMINI_MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) await handleApiError(response);

  const data = await response.json();
  return extractText(data);
}

/**
 * Send a single prompt to Gemini and get a JSON object back.
 * Uses `responseMimeType: "application/json"` so Gemini returns clean JSON.
 *
 * @param prompt    The user-facing prompt that describes what JSON to produce.
 * @param systemInstruction  Optional system instruction for context.
 */
export async function geminiGenerateJSON<T = any>(
  prompt: string,
  systemInstruction?: string
): Promise<T> {
  const body: Record<string, any> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(buildEndpoint(GEMINI_MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) await handleApiError(response);

  const data = await response.json();
  const text = extractText(data);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. Raw response: ${text.slice(0, 300)}`
    );
  }
}
