/**
 * Chat Widget - Main Orchestrator
 * Coordinates between UI and LLM worker
 */

import type { ChatMessage, ChatState, WorkerMessage, MainMessage } from './chat-types';
import { isCloudModel, isCloudChatEnabled, GROQ_PROXY_URL } from './chat-types';
import { ChatUI } from './chat-ui';
import { GREETING_MESSAGE_LOCAL, GREETING_MESSAGE_CLOUD } from '@/data/jocelyn-context';

export class ChatWidget {
  private ui: ChatUI;
  private worker: Worker | null = null;
  private state: ChatState = 'idle';
  private messages: ChatMessage[] = [];
  private currentResponse = '';
  private webGPUSupported = false;
  private hasGreeted = false;
  private isCloud = false;
  private selectedModelId = '';
  private abortController: AbortController | null = null;
  // Promise resolvers for in-flight RAG context requests, keyed by request id.
  private ragContextResolvers = new Map<string, (context: string) => void>();
  private ragRequestId = 0;

  constructor() {
    this.ui = new ChatUI({
      onToggle: (isOpen) => this.handleToggle(isOpen),
      onLoadModel: (modelId) => this.loadModel(modelId),
      onSendMessage: (msg) => this.sendMessage(msg),
      onAbort: () => this.abort()
    });
  }

  private handleToggle(isOpen: boolean): void {
    if (isOpen && this.state === 'idle') {
      this.checkWebGPU();
    }
  }

  private initWorker(): void {
    if (this.worker) return;

    this.worker = new Worker(new URL('../../workers/llm-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      this.handleWorkerMessage(e.data);
    };
    this.worker.onerror = (e) => {
      console.error('LLM Worker error:', e);
      this.setState('error');
      this.ui.showError('Worker initialization failed. Please refresh and try again.');
    };
  }

  private postMessage(message: MainMessage): void {
    if (!this.worker) {
      this.initWorker();
    }
    this.worker?.postMessage(message);
  }

  private handleWorkerMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case 'webgpu-check':
        this.webGPUSupported = msg.supported;
        this.setState('ready');
        if (msg.supported) {
          // WebGPU available - enable local models
          this.ui.enableLocalModels();
        } else {
          // WebGPU not available - update local models to show "requires WebGPU"
          this.ui.disableLocalModels();
        }
        // Disable cloud models if proxy URL is not configured
        if (!isCloudChatEnabled()) {
          this.ui.disableCloudModels();
        }
        break;

      case 'load-progress':
        this.ui.showLoadProgress({ progress: msg.progress, text: msg.text }, msg.modelType || 'chat');
        break;

      case 'load-complete':
        this.setState('loaded');
        this.ui.showChat();
        // Add greeting message (only once)
        if (!this.hasGreeted) {
          this.hasGreeted = true;
          const greeting: ChatMessage = {
            role: 'assistant',
            content: GREETING_MESSAGE_LOCAL,
            timestamp: Date.now()
          };
          this.messages.push(greeting);
          this.ui.addMessage(greeting);
        }
        break;

      case 'embedding-load-complete':
        this.ui.markEmbeddingComplete();
        console.log('Embedding model loaded for RAG');
        break;

      case 'embedding-load-error':
        console.warn('Embedding model failed to load, using BM25 fallback:', msg.error);
        this.ui.markEmbeddingError();
        break;

      case 'load-error':
        this.setState('error');
        this.ui.showError(`Failed to load model: ${msg.error}`);
        break;

      case 'generation-started':
        // Worker has started processing, replace typing indicator with message placeholder
        this.ui.hideTypingIndicator();
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: '',
          timestamp: Date.now()
        };
        this.messages.push(assistantMsg);
        this.ui.addMessage(assistantMsg);
        break;

      case 'token':
        this.currentResponse += msg.token;
        this.ui.updateLastAssistantMessage(this.currentResponse);
        break;

      case 'generation-complete':
        this.ui.hideTypingIndicator();
        // Update the message in our state
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = msg.fullResponse;
        }
        this.currentResponse = '';
        this.setState('loaded');
        this.ui.setInputEnabled(true);
        this.ui.setGenerating(false);
        break;

      case 'generation-error':
        this.ui.hideTypingIndicator();
        this.setState('loaded');
        this.ui.setInputEnabled(true);
        this.ui.setGenerating(false);
        // Show error in chat
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `Sorry, something went wrong: ${msg.error}`,
          timestamp: Date.now()
        };
        this.messages.push(errorMsg);
        this.ui.addMessage(errorMsg);
        break;

      case 'aborted':
        this.ui.hideTypingIndicator();
        this.setState('loaded');
        this.ui.setInputEnabled(true);
        this.ui.setGenerating(false);
        break;

      case 'rag-context-result': {
        const resolver = this.ragContextResolvers.get(msg.requestId);
        if (resolver) {
          this.ragContextResolvers.delete(msg.requestId);
          resolver(msg.context);
        }
        break;
      }
    }
  }

  /**
   * Ask the worker to retrieve RAG context for a query and resolve with
   * the resulting context string (or '' on no match). Used by the cloud
   * path to ground messages before forwarding to the proxy.
   *
   * If an AbortSignal is supplied and fires during retrieval, the
   * promise resolves with '' immediately so the UI's Stop button feels
   * responsive instead of waiting on the worker to reply or the 5s
   * timeout to fire.
   */
  private requestRAGContext(query: string, signal?: AbortSignal): Promise<string> {
    const requestId = String(++this.ragRequestId);
    return new Promise<string>((resolve) => {
      const cleanup = () => {
        this.ragContextResolvers.delete(requestId);
      };

      this.ragContextResolvers.set(requestId, resolve);

      // Bail out after 5s if the worker hasn't loaded chunks yet.
      // First-message cold starts can hit this — the response goes out
      // ungrounded; warn so the case is visible in DevTools.
      const timeoutId = setTimeout(() => {
        if (this.ragContextResolvers.has(requestId)) {
          cleanup();
          console.warn(
            '[chat] RAG context request timed out after 5s; ' +
            'forwarding to LLM without retrieved context'
          );
          resolve('');
        }
      }, 5000);

      // Short-circuit on abort so Stop doesn't wait on retrieval.
      const onAbort = () => {
        if (this.ragContextResolvers.has(requestId)) {
          clearTimeout(timeoutId);
          cleanup();
          resolve('');
        }
      };
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.postMessage({ type: 'rag-context', requestId, query });
    });
  }

  private setState(state: ChatState): void {
    this.state = state;
    this.ui.updateState(state);
  }

  private checkWebGPU(): void {
    this.setState('checking');
    this.initWorker();
    this.postMessage({ type: 'check-webgpu' });
  }

  private async loadModel(modelId: string): Promise<void> {
    this.selectedModelId = modelId;
    this.isCloud = isCloudModel(modelId);
    this.ui.setModelName(modelId, this.isCloud);

    if (this.isCloud) {
      // Groq cloud model - no download needed
      this.setState('loading');
      this.ui.showCloudLoading();

      // Small delay for UX, then go straight to loaded
      setTimeout(() => {
        this.setState('loaded');
        this.ui.showChat();
        if (!this.hasGreeted) {
          this.hasGreeted = true;
          const greeting: ChatMessage = {
            role: 'assistant',
            content: GREETING_MESSAGE_CLOUD,
            timestamp: Date.now()
          };
          this.messages.push(greeting);
          this.ui.addMessage(greeting);
        }
      }, 500);
      return;
    }

    // Local WebGPU model
    if (!this.webGPUSupported) return;
    this.setState('loading');

    // Load chat model and embedding model in parallel (worker handles RAG data)
    this.postMessage({ type: 'load-model', modelId });
    this.postMessage({ type: 'load-embedding-model' });
  }

  private sendMessage(content: string): void {
    if (this.state !== 'loaded') return;

    // Add user message immediately (no delay)
    const userMsg: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this.messages.push(userMsg);
    this.ui.addMessage(userMsg);

    // Show typing indicator while we wait for response
    this.ui.showTypingIndicator();

    // Start generation
    this.setState('generating');
    this.ui.setInputEnabled(false);
    this.ui.setGenerating(true);
    this.currentResponse = '';

    if (this.isCloud) {
      this.generateWithGroq();
    } else {
      // Local model - worker handles RAG internally
      const chatHistory = this.messages
        .filter(m => m.role !== 'system');
      this.postMessage({ type: 'generate', messages: chatHistory });
    }
  }

  private async generateWithGroq(): Promise<void> {
    // Guard against missing proxy URL
    if (!GROQ_PROXY_URL) {
      this.ui.hideTypingIndicator();
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Cloud chat is not available. The proxy URL is not configured.',
        timestamp: Date.now()
      };
      this.messages.push(errorMsg);
      this.ui.addMessage(errorMsg);
      this.finishGeneration();
      return;
    }

    // Prepare messages for Groq API. The Cloudflare worker prepends its
    // own SYSTEM_PROMPT, but doesn't do RAG retrieval — we pre-retrieve
    // here so cloud users get the same grounded answers as local-WebGPU
    // users.
    //
    // Create the AbortController BEFORE awaiting RAG retrieval. The
    // retrieval can take seconds on a cold worker; if Stop is clicked
    // during that window the controller needs to already exist for the
    // abort to bail out the still-pending Groq request.
    this.abortController = new AbortController();

    const chatHistoryRaw = this.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const lastUser = [...chatHistoryRaw].reverse().find(m => m.role === 'user');
    // Pass the abort signal so a Stop click during retrieval resolves
    // the rag-context promise immediately (instead of blocking until
    // the worker replies or the 5s timeout fires).
    const ragContext = lastUser
      ? await this.requestRAGContext(lastUser.content, this.abortController.signal)
      : '';

    // If the user hit Stop during retrieval, bail out before fetch.
    if (this.abortController.signal.aborted) {
      this.finishGeneration();
      return;
    }

    let hasAddedMessage = false;

    try {
      // Strip 'groq:' prefix to get the actual model name
      const modelName = this.selectedModelId.replace(/^groq:/, '');

      const response = await fetch(GROQ_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send ragContext as a separate field — the worker concats it
        // onto its SYSTEM_PROMPT, mirroring the local-WebGPU path's
        // single-system-message structure.
        body: JSON.stringify({ messages: chatHistoryRaw, model: modelName, context: ragContext || undefined }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                // On first token, replace typing indicator with message
                if (!hasAddedMessage) {
                  hasAddedMessage = true;
                  this.ui.hideTypingIndicator();
                  const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now()
                  };
                  this.messages.push(assistantMsg);
                  this.ui.addMessage(assistantMsg);
                }
                this.currentResponse += token;
                this.ui.updateLastAssistantMessage(this.currentResponse);
              }
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }

      // Update final message state
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = this.currentResponse;
      }
      this.finishGeneration();

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.finishGeneration();
        return;
      }
      console.error('Groq error:', error);
      this.ui.hideTypingIndicator();
      if (!hasAddedMessage) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `Sorry, something went wrong. ${(error as Error).message}`,
          timestamp: Date.now()
        };
        this.messages.push(assistantMsg);
        this.ui.addMessage(assistantMsg);
      } else {
        this.ui.updateLastAssistantMessage(`Sorry, something went wrong. ${(error as Error).message}`);
      }
      this.finishGeneration();
    }
  }

  private finishGeneration(): void {
    this.ui.hideTypingIndicator();
    this.currentResponse = '';
    this.setState('loaded');
    this.ui.setInputEnabled(true);
    this.ui.setGenerating(false);
    this.abortController = null;
  }

  private abort(): void {
    if (this.state === 'generating') {
      if (this.isCloud && this.abortController) {
        this.abortController.abort();
      } else {
        this.postMessage({ type: 'abort' });
      }
    }
  }

  destroy(): void {
    this.worker?.terminate();
    this.ui.destroy();
  }

  /** Preload worker without opening chat - call on hover for faster startup */
  preload(): void {
    if (!this.worker) {
      this.initWorker();
      // Also check WebGPU so it's ready when chat opens
      this.postMessage({ type: 'check-webgpu' });
    }
  }
}

// Factory function for easy initialization
export function initChatWidget(): ChatWidget {
  return new ChatWidget();
}
