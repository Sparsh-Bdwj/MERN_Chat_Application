const PROVIDER_DEFAULTS = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemma-4-31b-it:free",
  },
};

const AI_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();
const activeProviderDefaults =
  PROVIDER_DEFAULTS[AI_PROVIDER] || PROVIDER_DEFAULTS.groq;
const rawAiBaseUrl = process.env.AI_BASE_URL || activeProviderDefaults.baseUrl;
const rawAiModel = process.env.AI_MODEL || activeProviderDefaults.model;
const AI_BASE_URL = (
  /^https?:\/\//i.test(rawAiBaseUrl)
    ? rawAiBaseUrl
    : activeProviderDefaults.baseUrl
).replace(/\/$/, "");
const AI_MODEL = (() => {
  const normalizedModel = String(rawAiModel || "").trim();

  if (!normalizedModel || /^https?:\/\//i.test(normalizedModel)) {
    return activeProviderDefaults.model;
  }

  if (
    AI_PROVIDER === "openrouter" &&
    /^openrouter\/free$/i.test(normalizedModel)
  ) {
    return activeProviderDefaults.model;
  }

  return normalizedModel;
})();
const AI_API_KEY = process.env.AI_API_KEY || "";
const OPENROUTER_FALLBACK_MODELS = (
  process.env.OPENROUTER_FALLBACK_MODELS ||
  "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const AI_TIMEOUT_MS = Number(
  process.env.AI_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || 20000,
);
const AI_RATE_LIMIT_COOLDOWN_MS = Number(
  process.env.AI_RATE_LIMIT_COOLDOWN_MS || 60000,
);
const AI_SUMMARY_MAX_CHARS = Number(
  process.env.AI_SUMMARY_MAX_CHARS ||
    process.env.OLLAMA_SUMMARY_MAX_CHARS ||
    2800,
);
const AI_REPLY_MAX_CHARS = Number(
  process.env.AI_REPLY_MAX_CHARS || process.env.OLLAMA_REPLY_MAX_CHARS || 1200,
);

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
).replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "20m";

const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || "";
const APP_NAME = process.env.APP_NAME || "MERN Chat Application";

let remoteAiCooldownUntil = 0;

const trimText = (text = "", max = 140) => {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
};

const extractJson = (text = "") => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const shrinkTranscript = (transcript = "", maxChars = 2000) => {
  if (transcript.length <= maxChars) return transcript;

  return `...truncated earlier messages...\n${transcript.slice(-maxChars)}`;
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  ...(AI_API_KEY
    ? {
        Authorization: `Bearer ${AI_API_KEY}`,
      }
    : {}),
  ...(AI_PROVIDER === "openrouter"
    ? {
        "HTTP-Referer": APP_PUBLIC_URL || "http://localhost:5173",
        "X-Title": APP_NAME,
      }
    : {}),
});

const aiFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`AI request timed out after ${AI_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const shouldTryNextRemoteModel = (statusCode, errorText) => {
  if (statusCode === 404) {
    return true;
  }

  if (statusCode === 429) {
    return true;
  }

  return /(no endpoints found|rate-limited upstream|temporarily rate-limited|provider returned error|please retry shortly|capacity|overloaded)/i.test(
    errorText || "",
  );
};

const callRemoteModel = async ({ system, prompt, numPredict = 120 }) => {
  if (!AI_API_KEY) {
    throw new Error(
      "AI_API_KEY is missing. Add your remote model key in server/.env",
    );
  }

  if (Date.now() < remoteAiCooldownUntil) {
    const secondsLeft = Math.ceil((remoteAiCooldownUntil - Date.now()) / 1000);
    throw new Error(
      `Remote AI temporarily rate-limited. Using fallback for ${secondsLeft}s.`,
    );
  }

  const modelsToTry =
    AI_PROVIDER === "openrouter"
      ? [AI_MODEL, ...OPENROUTER_FALLBACK_MODELS].filter(
          (model, index, models) => models.indexOf(model) === index,
        )
      : [AI_MODEL];

  let lastErrorMessage = "Unable to reach the configured remote AI service";
  const attemptErrors = [];
  let hitRateLimit = false;

  for (let index = 0; index < modelsToTry.length; index += 1) {
    const model = modelsToTry[index];
    const response = await aiFetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: numPredict,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastErrorMessage = errorText || lastErrorMessage;
      attemptErrors.push(
        `${model}: ${response.status} ${errorText || "request failed"}`,
      );
      if (
        response.status === 429 ||
        /rate-limited upstream|temporarily rate-limited|please retry shortly/i.test(
          errorText,
        )
      ) {
        hitRateLimit = true;
      }

      if (
        AI_PROVIDER === "openrouter" &&
        shouldTryNextRemoteModel(response.status, errorText) &&
        index < modelsToTry.length - 1
      ) {
        continue;
      }

      if (hitRateLimit) {
        remoteAiCooldownUntil = Date.now() + AI_RATE_LIMIT_COOLDOWN_MS;
      }

      throw new Error(lastErrorMessage);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    remoteAiCooldownUntil = 0;
    return String(content || "").trim();
  }

  if (attemptErrors.length) {
    if (hitRateLimit) {
      remoteAiCooldownUntil = Date.now() + AI_RATE_LIMIT_COOLDOWN_MS;
    }

    throw new Error(
      `All remote AI models failed. Attempts: ${attemptErrors.join(" | ")}`,
    );
  }

  throw new Error(lastErrorMessage);
};

const callOllama = async ({
  system,
  prompt,
  format = "json",
  numPredict = 120,
}) => {
  const response = await aiFetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system,
      prompt,
      format,
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: 0.2,
        num_predict: numPredict,
        num_ctx: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || "Unable to reach the configured AI model service",
    );
  }

  const data = await response.json();
  return data.response?.trim() || "";
};

const callModel = async (payload) => {
  if (AI_PROVIDER === "ollama") {
    return callOllama(payload);
  }

  return callRemoteModel(payload);
};

export const getAiRuntimeConfig = () => ({
  provider: AI_PROVIDER,
  baseUrl: AI_PROVIDER === "ollama" ? OLLAMA_BASE_URL : AI_BASE_URL,
  model: AI_PROVIDER === "ollama" ? OLLAMA_MODEL : AI_MODEL,
  secured: Boolean(AI_PROVIDER === "ollama" ? OLLAMA_API_KEY : AI_API_KEY),
  timeoutMs: AI_TIMEOUT_MS,
  keepAlive: AI_PROVIDER === "ollama" ? OLLAMA_KEEP_ALIVE : null,
});

export const checkAiConnection = async () => {
  if (AI_PROVIDER === "ollama") {
    const response = await aiFetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(OLLAMA_API_KEY
          ? {
              Authorization: `Bearer ${OLLAMA_API_KEY}`,
            }
          : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || "Unable to reach the configured AI model service",
      );
    }

    const data = await response.json();

    return {
      ok: true,
      ...getAiRuntimeConfig(),
      availableModels: (data.models || [])
        .map((model) => model.name)
        .slice(0, 10),
    };
  }

  const reply = await callRemoteModel({
    system: "You are a healthcheck assistant. Reply with only: ok",
    prompt: "reply with ok",
    numPredict: 12,
  });

  return {
    ok: /^ok\b/i.test(reply),
    ...getAiRuntimeConfig(),
    availableModels: [AI_MODEL],
  };
};

const buildFallbackSummary = (messages, timeframeLabel) => {
  const messageCount = messages.length;
  const imageCount = messages.filter((message) => message.image).length;
  const textMessages = messages.filter(
    (message) => message.content && message.content.trim(),
  );
  const lastFewMessages = textMessages
    .slice(-3)
    .map(
      (message) => `${message.senderLabel}: ${trimText(message.content, 90)}`,
    );

  if (!messageCount) {
    return {
      summary: `No messages were found for ${timeframeLabel}.`,
      bullets: [],
      source: "fallback",
    };
  }

  return {
    summary: `This chat had ${messageCount} message(s) during ${timeframeLabel}${imageCount ? `, including ${imageCount} image message(s)` : ""}.`,
    bullets: [
      `Conversation volume: ${messageCount} message(s).`,
      imageCount ? `Shared media: ${imageCount} image message(s).` : null,
      lastFewMessages.length
        ? `Recent highlights: ${lastFewMessages.join(" | ")}`
        : "Most messages were short or media-only.",
    ].filter(Boolean),
    source: "fallback",
  };
};

const buildFallbackReplies = (messages) => {
  const lastMessage = messages.at(-1)?.content?.toLowerCase() || "";

  if (lastMessage.includes("thank")) {
    return ["You're welcome!", "Anytime.", "Happy to help."];
  }

  if (
    lastMessage.includes("?") ||
    /can you|could you|will you|when|what|why|how/.test(lastMessage)
  ) {
    return [
      "Sure, give me a moment.",
      "Yes, that works for me.",
      "I'll check and reply shortly.",
    ];
  }

  if (/okay|ok|alright|sounds good|great/.test(lastMessage)) {
    return ["Sounds good.", "Perfect, let's do it.", "Great, I'm on it."];
  }

  return [
    "Sounds good to me.",
    "Sure, let's do that.",
    "Okay, I'll get back to you soon.",
  ];
};

export const generateChatSummary = async ({
  transcript,
  messages,
  timeframeLabel,
}) => {
  try {
    const shortTranscript = shrinkTranscript(transcript, AI_SUMMARY_MAX_CHARS);
    const system = `You summarize private chat conversations. Keep the answer concise, neutral, and useful. Return valid JSON only in this exact shape: {"summary":"short paragraph","bullets":["point 1","point 2","point 3"]}`;

    const prompt = `Summarize this 1-to-1 chat for ${timeframeLabel}. Focus only on the main topics, decisions, and follow-ups. Keep it brief.\n\nChat transcript:\n${shortTranscript}`;

    const raw = await callModel({
      system,
      prompt,
      format: "json",
      numPredict: 140,
    });
    const parsed = extractJson(raw);

    if (parsed?.summary) {
      return {
        summary: parsed.summary,
        bullets: Array.isArray(parsed.bullets)
          ? parsed.bullets.slice(0, 3)
          : [],
        source: AI_PROVIDER,
      };
    }
  } catch (error) {
    console.log("AI summary fallback:", error.message);
  }

  return buildFallbackSummary(messages, timeframeLabel);
};

export const generateReplySuggestions = async ({ transcript, messages }) => {
  try {
    const shortTranscript = shrinkTranscript(transcript, AI_REPLY_MAX_CHARS);
    const system = `You write smart reply suggestions for a chat app. Replies must be short, natural, and ready to send. Return valid JSON only in this exact shape: {"replies":["reply 1","reply 2","reply 3"]}`;

    const prompt = `Based on this conversation, suggest exactly 3 short replies. Each reply should be under 10 words and sound natural.\n\nChat transcript:\n${shortTranscript}`;

    const raw = await callModel({
      system,
      prompt,
      format: "json",
      numPredict: 80,
    });
    const parsed = extractJson(raw);

    if (Array.isArray(parsed?.replies) && parsed.replies.length) {
      return parsed.replies
        .map((reply) => String(reply).trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch (error) {
    console.log("AI smart reply fallback:", error.message);
  }

  return buildFallbackReplies(messages);
};
