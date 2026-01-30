/**
 * Cloudflare Worker - Groq API Proxy for Chat Widget
 * Keeps API key secure, handles CORS, streams responses
 */

import { SYSTEM_PROMPT } from './system-prompt';

interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
}

// SYSTEM_PROMPT is loaded from ./system-prompt.ts (generated at build time)

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';

    // Allow localhost for dev, production domain for prod
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:4000', 'http://127.0.0.1:4000'];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o) || o === '*');

    const corsHeaders = {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': isAllowed ? origin : env.ALLOWED_ORIGIN,
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
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
          temperature: 0.7,
          max_tokens: 1024,
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
