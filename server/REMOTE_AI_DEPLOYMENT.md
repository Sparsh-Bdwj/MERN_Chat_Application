# Remote AI Deployment for MERN Chat Application

## Goal

Use a hosted AI model through an API key so you do not install or run a local model on your device.

## Recommended provider

Use Groq with its OpenAI-compatible API.

Recommended default model:

- `llama-3.1-8b-instant`

## Architecture

```text
React client (Vercel/Netlify)
        |
        v
Node/Express API (Render/Railway/VM)
        |
        | HTTPS + Bearer token (AI_API_KEY)
        v
Groq API (hosted model, no local install)
```

## What is implemented

- New provider-based AI runtime in `server/services/aiService.js`.
- Default provider is `groq`.
- Health endpoint `GET /api/ai/health` checks remote model connectivity.
- Existing summary and smart-replies fallbacks still work if the AI request fails.
- Optional legacy compatibility for `ollama` is still available.

## Backend environment variables

Set these in your backend (`server/.env` or deployment env panel):

```env
AI_PROVIDER=groq
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.1-8b-instant
AI_API_KEY=your_groq_api_key
AI_TIMEOUT_MS=20000
AI_RATE_LIMIT_COOLDOWN_MS=60000
AI_SUMMARY_MAX_CHARS=2800
AI_REPLY_MAX_CHARS=1200

# Optional metadata
APP_PUBLIC_URL=http://localhost:5173
APP_NAME=MERN Chat Application
```

## Setup steps

1. Create an account at Groq and generate an API key.
2. Put the key into `AI_API_KEY` on your backend only.
3. Restart backend server.
4. Call `GET /api/ai/health` while authenticated.
5. Open a chat and test Summary + Smart Replies.

## Optional other free providers

You can switch to any OpenAI-compatible API by changing only:

- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`

If you switch back to OpenRouter, also set:

- `AI_PROVIDER=openrouter`
- `OPENROUTER_FALLBACK_MODELS=google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free`

## Important notes

- Never expose `AI_API_KEY` in frontend code.
- Keep AI calls from backend only.
- If quota/rate limit is hit, app still returns rule-based fallback results.
