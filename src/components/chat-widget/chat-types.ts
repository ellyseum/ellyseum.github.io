/**
 * Chat Widget Type Definitions
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export type ChatState =
  | 'idle'           // Widget closed, no model loaded
  | 'checking'       // Checking WebGPU support
  | 'ready'          // WebGPU available, waiting for user to load model
  | 'loading'        // Model downloading/initializing
  | 'loaded'         // Model ready, can chat
  | 'generating'     // Currently generating response
  | 'error';         // Error state

export interface LoadProgress {
  progress: number;  // 0-100
  text: string;      // Human-readable status
}

export interface ModelOption {
  id: string;
  name: string;
  size: string;
}

export interface ModelCategory {
  label: string;
  models: ModelOption[];
}

export const MODEL_CATEGORIES: ModelCategory[] = [
  {
    label: 'Cloud (Best Quality)',
    models: [
      { id: 'groq:llama-3.3-70b-versatile', name: 'Llama 3.3 70B', size: 'Cloud' },
      { id: 'groq:openai/gpt-oss-120b', name: 'GPT OSS 120B', size: 'Cloud' },
    ]
  },
  {
    label: '8B Local Models',
    models: [
      { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', name: 'Llama 3.1 8B', size: '~4.5GB' },
    ]
  },
  {
    label: '7B Local Models',
    models: [
      { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 7B', size: '~4GB' },
      { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', name: 'Mistral 7B v0.3', size: '~4GB' },
      { id: 'Hermes-2-Pro-Mistral-7B-q4f16_1-MLC', name: 'Hermes 2 Pro 7B', size: '~4GB' },
    ]
  },
  {
    label: '3B Local Models (Faster)',
    models: [
      { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B', size: '~1.8GB' },
      { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 3B', size: '~1.9GB' },
    ]
  }
];

// Flat list for compatibility
export const AVAILABLE_MODELS: ModelOption[] = MODEL_CATEGORIES.flatMap(cat => cat.models);

// Embedding model for RAG
export const EMBEDDING_MODEL = 'snowflake-arctic-embed-m-q0f32-MLC-b4';

// Groq API proxy URL (Cloudflare Worker)
export const GROQ_PROXY_URL = 'https://chat.api.ellyseum.dev';

// Helper to detect cloud models
export function isCloudModel(modelId: string): boolean {
  return modelId.startsWith('groq:');
}

// Worker -> Main thread messages
export type WorkerMessage =
  | { type: 'webgpu-check'; supported: boolean; error?: string }
  | { type: 'load-progress'; progress: number; text: string; modelType?: 'chat' | 'embedding' }
  | { type: 'load-complete' }
  | { type: 'load-error'; error: string }
  | { type: 'embedding-load-complete' }
  | { type: 'embedding-load-error'; error: string }
  | { type: 'generation-started' }
  | { type: 'token'; token: string }
  | { type: 'generation-complete'; fullResponse: string }
  | { type: 'generation-error'; error: string }
  | { type: 'aborted' };

// Main thread -> Worker messages
export type MainMessage =
  | { type: 'check-webgpu' }
  | { type: 'load-model'; modelId: string }
  | { type: 'load-embedding-model' }
  | { type: 'generate'; messages: ChatMessage[] }
  | { type: 'abort' };
