/**
 * LLM Web Worker
 * Handles WebLLM inference off the main thread
 * Includes RAG retrieval to keep main thread responsive
 */

import * as webllm from '@mlc-ai/web-llm';
import type { MainMessage, WorkerMessage, ChatMessage } from '@/components/chat-widget/chat-types';
import { EMBEDDING_MODEL } from '@/components/chat-widget/chat-types';
import { JOCELYN_SYSTEM_PROMPT } from '@/data/jocelyn-context';

let chatEngine: webllm.MLCEngineInterface | null = null;
let embeddingEngine: webllm.MLCEngineInterface | null = null;
let abortController: AbortController | null = null;

// ============ RAG State ============
interface EmbeddingChunk {
  id: string;
  category: string;
  content: string;
  embedding: number[];
}

interface EmbeddingsData {
  model: string;
  dimensions: number;
  chunks: EmbeddingChunk[];
}

interface BM25Index {
  documents: { id: string; tokens: string[]; length: number }[];
  avgDocLength: number;
  documentFrequency: Map<string, number>;
  totalDocs: number;
  chunks: EmbeddingChunk[];
}

let embeddingsData: EmbeddingsData | null = null;
let bm25Index: BM25Index | null = null;

// ============ RAG Functions ============
async function loadEmbeddingsData(): Promise<boolean> {
  try {
    const response = await fetch('/assets/data/embeddings.json');
    if (!response.ok) return false;
    embeddingsData = await response.json();
    if (embeddingsData) {
      bm25Index = buildBM25Index(embeddingsData.chunks);
    }
    return true;
  } catch {
    return false;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1);
}

function buildBM25Index(chunks: EmbeddingChunk[]): BM25Index {
  const documents: { id: string; tokens: string[]; length: number }[] = [];
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.content);
    documents.push({ id: chunk.id, tokens, length: tokens.length });
    totalLength += tokens.length;
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  return { documents, avgDocLength: totalLength / documents.length, documentFrequency, totalDocs: documents.length, chunks };
}

function bm25Score(queryTokens: string[], docTokens: string[], docLength: number, index: BM25Index): number {
  const k1 = 1.5, b = 0.75;
  let score = 0;
  const termFreq = new Map<string, number>();
  for (const token of docTokens) termFreq.set(token, (termFreq.get(token) || 0) + 1);

  for (const term of queryTokens) {
    const tf = termFreq.get(term) || 0;
    if (tf === 0) continue;
    const df = index.documentFrequency.get(term) || 0;
    const idf = Math.log((index.totalDocs - df + 0.5) / (df + 0.5) + 1);
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / index.avgDocLength))));
  }
  return score;
}

function retrieveByEmbedding(queryEmbedding: number[], topK: number = 3): { chunk: EmbeddingChunk; score: number }[] {
  if (!embeddingsData) return [];
  const scores = embeddingsData.chunks.map(chunk => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

function retrieveByBM25(query: string, topK: number = 3): { chunk: EmbeddingChunk; score: number }[] {
  if (!bm25Index) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scores: { chunk: EmbeddingChunk; score: number }[] = [];
  for (let i = 0; i < bm25Index.documents.length; i++) {
    const doc = bm25Index.documents[i];
    const score = bm25Score(queryTokens, doc.tokens, doc.length, bm25Index);
    if (score > 0) scores.push({ chunk: bm25Index.chunks[i], score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

async function getRAGContext(query: string): Promise<string> {
  if (!embeddingsData) return '';

  let results: { chunk: EmbeddingChunk; score: number }[] = [];

  // Try embedding-based retrieval if embedding engine is available
  if (embeddingEngine) {
    try {
      const embedResult = await embeddingEngine.embeddings.create({ input: [query], model: EMBEDDING_MODEL });
      const queryEmbedding = Array.from(embedResult.data[0].embedding);
      results = retrieveByEmbedding(queryEmbedding, 3);
      if (results.length > 0 && results[0].score > 0.3) {
        return '\n\nRelevant context:\n' + results.map(r => r.chunk.content).join('\n\n');
      }
    } catch {
      // Fall through to BM25
    }
  }

  // Fallback to BM25
  results = retrieveByBM25(query, 3);
  if (results.length > 0) {
    return '\n\nRelevant context:\n' + results.map(r => r.chunk.content).join('\n\n');
  }

  return '';
}

function postMessage(message: WorkerMessage): void {
  self.postMessage(message);
}

async function checkWebGPU(): Promise<void> {
  try {
    // Check if WebGPU is available
    if (!navigator.gpu) {
      postMessage({
        type: 'webgpu-check',
        supported: false,
        error: 'WebGPU not available. Try Chrome 113+, Edge 113+, or Safari 18+.'
      });
      return;
    }

    // Try to get an adapter to verify it actually works
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      postMessage({
        type: 'webgpu-check',
        supported: false,
        error: 'No WebGPU adapter found. Your GPU may not be supported.'
      });
      return;
    }

    postMessage({ type: 'webgpu-check', supported: true });
  } catch (error) {
    postMessage({
      type: 'webgpu-check',
      supported: false,
      error: error instanceof Error ? error.message : 'Unknown WebGPU error'
    });
  }
}

async function loadModel(modelId: string): Promise<void> {
  try {
    const initProgressCallback = (report: webllm.InitProgressReport) => {
      // Parse progress from text like "Loading model from cache[1/5]..."
      let progress = 0;
      const match = report.text.match(/\[(\d+)\/(\d+)\]/);
      if (match) {
        progress = (parseInt(match[1]) / parseInt(match[2])) * 100;
      } else if (report.progress !== undefined) {
        progress = report.progress * 100;
      }

      postMessage({
        type: 'load-progress',
        progress: Math.min(progress, 99), // Never show 100 until actually complete
        text: report.text,
        modelType: 'chat'
      });
    };

    chatEngine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback,
      logLevel: 'SILENT'
    });

    postMessage({ type: 'load-complete' });
  } catch (error) {
    postMessage({
      type: 'load-error',
      error: error instanceof Error ? error.message : 'Failed to load model'
    });
  }
}

async function loadEmbeddingModel(): Promise<void> {
  try {
    // Load embeddings data first (lightweight JSON fetch)
    await loadEmbeddingsData();

    const initProgressCallback = (report: webllm.InitProgressReport) => {
      let progress = 0;
      const match = report.text.match(/\[(\d+)\/(\d+)\]/);
      if (match) {
        progress = (parseInt(match[1]) / parseInt(match[2])) * 100;
      } else if (report.progress !== undefined) {
        progress = report.progress * 100;
      }

      postMessage({
        type: 'load-progress',
        progress: Math.min(progress, 99),
        text: `[Embeddings] ${report.text}`,
        modelType: 'embedding'
      });
    };

    embeddingEngine = await webllm.CreateMLCEngine(EMBEDDING_MODEL, {
      initProgressCallback,
      logLevel: 'SILENT'
    });

    postMessage({ type: 'embedding-load-complete' });
  } catch (error) {
    postMessage({
      type: 'embedding-load-error',
      error: error instanceof Error ? error.message : 'Failed to load embedding model'
    });
  }
}

async function generate(messages: ChatMessage[]): Promise<void> {
  if (!chatEngine) {
    postMessage({ type: 'generation-error', error: 'Model not loaded' });
    return;
  }

  abortController = new AbortController();

  try {
    // Get RAG context from last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const context = lastUserMsg ? await getRAGContext(lastUserMsg.content) : '';

    // Signal that we're starting generation (RAG is done, streaming about to begin)
    postMessage({ type: 'generation-started' });

    // Build system prompt with RAG context
    const systemPrompt = context
      ? `${JOCELYN_SYSTEM_PROMPT}${context}`
      : JOCELYN_SYSTEM_PROMPT;

    // Build messages with system prompt
    const llmMessages: webllm.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    let fullResponse = '';

    const asyncChunkGenerator = await chatEngine.chat.completions.create({
      messages: llmMessages,
      temperature: 0.4,
      max_tokens: 512,
      stream: true,
      stream_options: { include_usage: false }
    });

    for await (const chunk of asyncChunkGenerator) {
      if (abortController.signal.aborted) {
        postMessage({ type: 'aborted' });
        return;
      }

      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullResponse += delta;
        postMessage({ type: 'token', token: delta });
      }
    }

    postMessage({ type: 'generation-complete', fullResponse });
  } catch (error) {
    if (abortController.signal.aborted) {
      postMessage({ type: 'aborted' });
    } else {
      postMessage({
        type: 'generation-error',
        error: error instanceof Error ? error.message : 'Generation failed'
      });
    }
  } finally {
    abortController = null;
  }
}

function abort(): void {
  if (abortController) {
    abortController.abort();
  }
}

// Message handler
self.onmessage = async (e: MessageEvent<MainMessage>) => {
  const { type } = e.data;

  switch (type) {
    case 'check-webgpu':
      await checkWebGPU();
      break;
    case 'load-model':
      await loadModel(e.data.modelId);
      break;
    case 'load-embedding-model':
      await loadEmbeddingModel();
      break;
    case 'generate':
      await generate(e.data.messages);
      break;
    case 'abort':
      abort();
      break;
  }
};
