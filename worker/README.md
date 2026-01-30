# Chat Proxy Worker

Cloudflare Worker that proxies requests to the Groq API for the chat widget's cloud fallback mode. Keeps your API key secure and handles CORS.

## When You Need This

- Visitors without WebGPU (older devices, some mobile browsers)
- Faster initial response (no model download required)
- Lower-end devices where local inference would be too slow

If you only want local AI chat (WebLLM), you don't need this worker.

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Configure Wrangler

```bash
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml`:
```toml
name = "your-chat-proxy"
main = "src/index.ts"

[vars]
ALLOWED_ORIGIN = "https://yourdomain.com"
```

### 3. Set API Key

Get an API key from [Groq Console](https://console.groq.com/).

```bash
wrangler secret put GROQ_API_KEY
# Paste your API key when prompted
```

### 4. Deploy

```bash
npm run deploy
```

Note the worker URL (e.g., `https://your-chat-proxy.username.workers.dev`).

### 5. Configure Your Blog

Set the environment variable in your blog's build:

```bash
VITE_GROQ_PROXY_URL=https://your-chat-proxy.username.workers.dev
```

Or add to your CI/CD secrets.

## Local Development

```bash
npm run dev
```

Runs the worker locally with Miniflare.

## How It Works

1. Chat widget detects WebGPU is unavailable
2. Falls back to cloud mode, sends messages to your worker
3. Worker validates origin, adds API key, forwards to Groq
4. Streams response back to the browser

## Security

- **API key** is stored as a Cloudflare secret (never exposed to browser)
- **ALLOWED_ORIGIN** restricts which domains can use the proxy
- **CORS headers** prevent unauthorized cross-origin requests

## Customization

### System Prompt

The worker injects a system prompt from `src/system-prompt.ts`. This is generated at build time from your `system-prompt.md` (or the `SYSTEM_PROMPT` secret in CI).

To update:
1. Edit `system-prompt.md` in your content repo
2. Run `npm run inject-prompt` (or rebuild the main site)
3. Redeploy: `npm run deploy`

### Model

Default model is `llama-3.3-70b-versatile`. To change, edit `src/index.ts`:

```typescript
model: 'your-preferred-model',
```

See [Groq docs](https://console.groq.com/docs/models) for available models.
