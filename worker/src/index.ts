/**
 * Cloudflare Worker - Groq API Proxy for Chat Widget
 * Keeps API key secure, handles CORS, streams responses
 */

import { SYSTEM_PROMPT } from './system-prompt';

interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGINS: string; // Comma-separated list of allowed origins
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

// SYSTEM_PROMPT is loaded from ./system-prompt.ts (generated at build time)

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';

    // Parse comma-separated allowed origins. Match exactly — startsWith
    // would let "https://ellyseum.me.evil.com" through since it begins
    // with "https://ellyseum.me". The wildcard "*" is honored for dev.
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    const isAllowed = allowedOrigins.some(o => o === '*' || origin === o);

    const corsHeaders = {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': isAllowed ? origin : (allowedOrigins[0] || ''),
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Reject disallowed origins outright. Browsers also enforce CORS via
    // the response header, but non-browser clients (curl, scripts) ignore
    // CORS and would otherwise burn the GROQ quota for the proxy owner.
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body: ChatRequest = await request.json();

      // Build messages with system prompt (injected at build time)
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...body.messages.map(m => ({ role: m.role, content: m.content }))
      ];

      // Call Groq API
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model || 'llama-3.3-70b-versatile',
          messages,
          temperature: body.temperature ?? 0.7,
          max_tokens: Math.min(body.max_tokens || 1024, 32768),
          stream: true,
        }),
      });

      if (!groqResponse.ok) {
        const error = await groqResponse.text();
        console.error('Groq API error:', error);
        return new Response(JSON.stringify({ error: 'AI service error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Stream the response back
      return new Response(groqResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
