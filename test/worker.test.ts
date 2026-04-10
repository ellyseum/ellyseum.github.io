import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker/src/index';

describe('Cloudflare Worker', () => {
  const env = {
    GROQ_API_KEY: 'test-key',
    ALLOWED_ORIGINS: 'https://example.com, https://staging.example.com',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => 
      Promise.resolve(new Response(JSON.stringify({ choices: [{ delta: { content: 'hello' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    ));
  });

  it('allows matching origin', async () => {
    const req = new Request('https://proxy.worker', {
      method: 'POST',
      headers: {
        'Origin': 'https://example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  it('rejects forbidden origin', async () => {
    const req = new Request('https://proxy.worker', {
      method: 'POST',
      headers: {
        'Origin': 'https://evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden origin');
  });

  it('handles context field by appending to SYSTEM_PROMPT', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const req = new Request('https://proxy.worker', {
      method: 'POST',
      headers: {
        'Origin': 'https://example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: 'hi' }],
        context: '\n\nRelevant context: some data'
      }),
    });

    await worker.fetch(req, env);
    
    const lastFetchCall = fetchSpy.mock.calls[0];
    const body = JSON.parse(lastFetchCall[1].body as string);
    const systemMsg = body.messages.find(m => m.role === 'system');
    
    expect(systemMsg.content).toContain('Relevant context: some data');
  });

  it('allows wildcard in ALLOWED_ORIGINS', async () => {
    const wildcardEnv = {
      ...env,
      ALLOWED_ORIGINS: '*',
    };
    const req = new Request('https://proxy.worker', {
      method: 'POST',
      headers: {
        'Origin': 'https://random.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    const res = await worker.fetch(req, wildcardEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://random.com');
  });
});
