/**
 * Chat UI Component
 * Handles all DOM creation and manipulation for the chat widget
 */

import type { ChatMessage, ChatState, LoadProgress } from './chat-types';
import { MODEL_CATEGORIES, AVAILABLE_MODELS } from './chat-types';
import { injectChatStyles } from './chat-styles';
import { SITE_CONFIG } from '@/data/site-config';

// SVG Icons
const CHAT_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
</svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
</svg>`;

const SEND_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>`;

const STOP_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 6h12v12H6z"/>
</svg>`;

const AI_ICON = `<svg class="chat-load-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
</svg>`;

export type ChatUIEvents = {
  onToggle: (isOpen: boolean) => void;
  onLoadModel: (modelId: string) => void;
  onSendMessage: (message: string) => void;
  onAbort: () => void;
};

// Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to extract display text from URL (removes https:// prefix)
function urlToDisplay(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

// Build link patterns from SITE_CONFIG
function buildLinkPatterns(): [RegExp, () => string][] {
  const patterns: [RegExp, () => string][] = [];

  // Email
  if (SITE_CONFIG.email) {
    const escaped = escapeRegex(SITE_CONFIG.email);
    patterns.push([
      new RegExp(escaped, 'g'),
      () => `<a href="mailto:${SITE_CONFIG.email}" class="chat-link">${SITE_CONFIG.email}</a>`
    ]);
  }

  // GitHub
  if (SITE_CONFIG.github) {
    const display = urlToDisplay(SITE_CONFIG.github);
    const escaped = escapeRegex(display);
    patterns.push([
      new RegExp(escaped, 'g'),
      () => `<a href="${SITE_CONFIG.github}" target="_blank" rel="noopener" class="chat-link">${display}</a>`
    ]);
  }

  // LinkedIn
  if (SITE_CONFIG.linkedin) {
    const display = urlToDisplay(SITE_CONFIG.linkedin);
    const escaped = escapeRegex(display);
    patterns.push([
      new RegExp(escaped, 'g'),
      () => `<a href="${SITE_CONFIG.linkedin}" target="_blank" rel="noopener" class="chat-link">${display}</a>`
    ]);
  }

  // Portfolio
  if (SITE_CONFIG.portfolio) {
    const display = urlToDisplay(SITE_CONFIG.portfolio);
    const escaped = escapeRegex(display);
    patterns.push([
      new RegExp(escaped, 'g'),
      () => `<a href="${SITE_CONFIG.portfolio}" target="_blank" rel="noopener" class="chat-link">${display}</a>`
    ]);
  }

  // Blog domain
  if (SITE_CONFIG.domain) {
    const escaped = escapeRegex(SITE_CONFIG.domain);
    patterns.push([
      new RegExp(escaped, 'g'),
      () => `<a href="https://${SITE_CONFIG.domain}" target="_blank" rel="noopener" class="chat-link">${SITE_CONFIG.domain}</a>`
    ]);
  }

  return patterns;
}

// Whitelist of known links to make clickable
const LINK_PATTERNS = buildLinkPatterns();

function linkifyContent(text: string): string {
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply whitelisted link patterns
  for (const [pattern, replacement] of LINK_PATTERNS) {
    html = html.replace(pattern, replacement);
  }

  return html;
}

export class ChatUI {
  private container: HTMLElement;
  private panel: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private inputForm: HTMLFormElement | null = null;
  private inputField: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private loadSection: HTMLElement | null = null;
  private loadButton: HTMLButtonElement | null = null;
  private modelSelect: HTMLSelectElement | null = null;
  private chatProgressBar: HTMLElement | null = null;
  private chatProgressText: HTMLElement | null = null;
  private embeddingProgressBar: HTMLElement | null = null;
  private embeddingProgressText: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private toggleButton: HTMLButtonElement | null = null;

  private isOpen = false;
  private isGenerating = false;
  private currentModelName = '';
  private events: ChatUIEvents;

  constructor(events: ChatUIEvents) {
    this.events = events;
    injectChatStyles();
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'chat-widget';
    container.setAttribute('role', 'complementary');
    container.setAttribute('aria-label', `Chat with ${SITE_CONFIG.author || 'AI'} assistant`);

    // Toggle Button
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'chat-toggle';
    this.toggleButton.setAttribute('aria-label', 'Open chat');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.innerHTML = CHAT_ICON;
    this.toggleButton.addEventListener('click', () => this.toggle());

    // Panel
    this.panel = this.createPanel();

    container.appendChild(this.panel);
    container.appendChild(this.toggleButton);

    // Keyboard handling
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.toggleButton?.focus();
      }
    });

    return container;
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat conversation');

    // Header
    const header = document.createElement('div');
    header.className = 'chat-header';
    header.innerHTML = `
      <div class="chat-header-title">
        <h3>Chat with ${SITE_CONFIG.author || 'AI'}</h3>
        <span class="chat-header-status">Checking...</span>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-close';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    this.statusIndicator = header.querySelector('.chat-header-status');

    // Load Section (initially visible)
    this.loadSection = this.createLoadSection();

    // Messages Container (initially hidden)
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat-messages';
    this.messagesContainer.setAttribute('role', 'log');
    this.messagesContainer.setAttribute('aria-live', 'polite');
    this.messagesContainer.style.display = 'none';

    // Input Area (initially hidden)
    const inputArea = this.createInputArea();
    inputArea.style.display = 'none';

    panel.appendChild(header);
    panel.appendChild(this.loadSection);
    panel.appendChild(this.messagesContainer);
    panel.appendChild(inputArea);

    return panel;
  }

  private createLoadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'chat-load-section';
    section.innerHTML = `
      ${AI_ICON}
      <h4 class="chat-load-title">Cloud AI Chat</h4>
      <p class="chat-load-desc">Powered by Llama 3.3 70B. Messages go through a secure proxy.</p>
      <p class="chat-warning">AI can make mistakes and hallucinate. Verify important info.</p>
    `;

    // Model selector with categories
    this.modelSelect = document.createElement('select');
    this.modelSelect.className = 'chat-model-select';
    this.modelSelect.setAttribute('aria-label', 'Select AI model');

    let firstCloudValue = '';
    MODEL_CATEGORIES.forEach(category => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = category.label;

      category.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        const isCloud = model.id.startsWith('groq:');

        if (isCloud) {
          option.textContent = `${model.name} (${model.size})`;
          if (!firstCloudValue) {
            firstCloudValue = model.id;
            option.selected = true;
          }
        } else {
          // Local models start disabled until WebGPU check passes
          option.textContent = `${model.name} (${model.size}) - checking...`;
          option.disabled = true;
        }
        optgroup.appendChild(option);
      });

      this.modelSelect!.appendChild(optgroup);
    });

    // Update description when model changes
    this.modelSelect.addEventListener('change', () => {
      const isCloud = this.modelSelect?.value.startsWith('groq:');
      const title = section.querySelector('.chat-load-title');
      const desc = section.querySelector('.chat-load-desc');
      if (title && desc) {
        if (isCloud) {
          title.textContent = 'Cloud AI Chat';
          desc.textContent = 'Powered by Llama 3.3 70B. Messages go through a secure proxy.';
        } else {
          title.textContent = 'Local AI Chat';
          desc.textContent = 'Runs entirely in your browser via WebGPU. First load downloads the model (cached after).';
        }
      }
    });

    section.appendChild(this.modelSelect);

    this.loadButton = document.createElement('button');
    this.loadButton.className = 'chat-load-btn';
    this.loadButton.textContent = 'Load AI';
    this.loadButton.addEventListener('click', () => {
      const modelId = this.modelSelect?.value || AVAILABLE_MODELS[0].id;
      this.events.onLoadModel(modelId);
    });
    section.appendChild(this.loadButton);

    // Progress containers (hidden initially)
    const progressContainer = document.createElement('div');
    progressContainer.className = 'chat-progress-container';
    progressContainer.style.display = 'none';

    // Chat model progress
    const chatProgress = document.createElement('div');
    chatProgress.className = 'chat-progress';
    chatProgress.innerHTML = `
      <div class="chat-progress-label">Chat Model</div>
      <div class="chat-progress-bar">
        <div class="chat-progress-fill" style="width: 0%"></div>
      </div>
      <div class="chat-progress-text">Waiting...</div>
    `;
    this.chatProgressBar = chatProgress.querySelector('.chat-progress-fill');
    this.chatProgressText = chatProgress.querySelector('.chat-progress-text');
    progressContainer.appendChild(chatProgress);

    // Embedding model progress
    const embeddingProgress = document.createElement('div');
    embeddingProgress.className = 'chat-progress';
    embeddingProgress.innerHTML = `
      <div class="chat-progress-label">RAG Embeddings</div>
      <div class="chat-progress-bar">
        <div class="chat-progress-fill" style="width: 0%"></div>
      </div>
      <div class="chat-progress-text">Waiting...</div>
    `;
    this.embeddingProgressBar = embeddingProgress.querySelector('.chat-progress-fill');
    this.embeddingProgressText = embeddingProgress.querySelector('.chat-progress-text');
    progressContainer.appendChild(embeddingProgress);

    section.appendChild(progressContainer);

    return section;
  }

  private createInputArea(): HTMLElement {
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-input-area';

    this.inputForm = document.createElement('form');
    this.inputForm.className = 'chat-input-form';
    this.inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.inputField = document.createElement('textarea');
    this.inputField.className = 'chat-input';
    this.inputField.placeholder = 'Type a message...';
    this.inputField.rows = 1;
    this.inputField.setAttribute('aria-label', 'Message input');
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
    // Auto-resize
    this.inputField.addEventListener('input', () => {
      if (this.inputField) {
        this.inputField.style.height = 'auto';
        this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';
      }
    });

    this.sendButton = document.createElement('button');
    this.sendButton.type = 'button'; // Not submit, we handle manually
    this.sendButton.className = 'chat-send';
    this.sendButton.setAttribute('aria-label', 'Send message');
    this.sendButton.innerHTML = SEND_ICON;
    this.sendButton.addEventListener('click', () => {
      if (this.isGenerating) {
        this.events.onAbort();
      } else {
        this.handleSubmit();
      }
    });

    this.inputForm.appendChild(this.inputField);
    this.inputForm.appendChild(this.sendButton);
    inputArea.appendChild(this.inputForm);

    return inputArea;
  }

  private handleSubmit(): void {
    if (!this.inputField || this.isGenerating) return;
    const message = this.inputField.value.trim();
    if (!message) return;

    this.events.onSendMessage(message);
    this.inputField.value = '';
    this.inputField.style.height = 'auto';
    // Keep focus on input
    this.inputField.focus();
  }

  // Public methods

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.panel?.classList.add('open');
    this.toggleButton?.setAttribute('aria-expanded', 'true');
    this.events.onToggle(true);

    // Focus first focusable element
    setTimeout(() => {
      if (this.loadButton && this.loadSection?.style.display !== 'none') {
        this.loadButton.focus();
      } else if (this.inputField) {
        this.inputField.focus();
      }
    }, 300);
  }

  close(): void {
    this.isOpen = false;
    this.panel?.classList.remove('open');
    this.toggleButton?.setAttribute('aria-expanded', 'false');
    this.events.onToggle(false);
  }

  updateState(state: ChatState): void {
    if (!this.statusIndicator) return;

    switch (state) {
      case 'checking':
        this.statusIndicator.textContent = 'Checking WebGPU...';
        this.statusIndicator.className = 'chat-header-status';
        break;
      case 'ready':
        this.statusIndicator.textContent = 'Ready to load';
        this.statusIndicator.className = 'chat-header-status';
        break;
      case 'loading':
        this.statusIndicator.textContent = 'Loading model...';
        this.statusIndicator.className = 'chat-header-status loading';
        break;
      case 'loaded':
        this.statusIndicator.innerHTML = this.currentModelName || 'Online';
        this.statusIndicator.className = 'chat-header-status ready';
        break;
      case 'generating':
        this.statusIndicator.textContent = 'Thinking...';
        this.statusIndicator.className = 'chat-header-status loading';
        break;
      case 'error':
        this.statusIndicator.textContent = 'Error';
        this.statusIndicator.className = 'chat-header-status';
        break;
    }
  }

  showError(message: string): void {
    if (!this.loadSection) return;

    // Clear load section content
    this.loadSection.innerHTML = `
      <div class="chat-error">
        <strong>Unable to start chat</strong><br><br>
        ${message}
      </div>
    `;
    this.loadSection.style.display = 'flex';
    if (this.messagesContainer) this.messagesContainer.style.display = 'none';
  }

  showLoadProgress(progress: LoadProgress, modelType: 'chat' | 'embedding' = 'chat'): void {
    if (!this.loadSection) return;

    // Hide load button, show progress container
    if (this.loadButton) this.loadButton.style.display = 'none';
    if (this.modelSelect) this.modelSelect.style.display = 'none';
    const progressContainer = this.loadSection.querySelector('.chat-progress-container') as HTMLElement;
    if (progressContainer) progressContainer.style.display = 'block';

    // Update the appropriate progress bar
    if (modelType === 'chat' && this.chatProgressBar && this.chatProgressText) {
      this.chatProgressBar.style.width = `${progress.progress}%`;
      this.chatProgressText.textContent = progress.text;
    } else if (modelType === 'embedding' && this.embeddingProgressBar && this.embeddingProgressText) {
      this.embeddingProgressBar.style.width = `${progress.progress}%`;
      this.embeddingProgressText.textContent = progress.text;
    }
  }

  showCloudLoading(): void {
    if (!this.loadSection) return;

    // Hide load button and model select, show simple connecting message
    if (this.loadButton) this.loadButton.style.display = 'none';
    if (this.modelSelect) this.modelSelect.style.display = 'none';

    // Hide the progress container (no need for progress bars with cloud)
    const progressContainer = this.loadSection.querySelector('.chat-progress-container') as HTMLElement;
    if (progressContainer) progressContainer.style.display = 'none';

    // Update the load section description
    const description = this.loadSection.querySelector('p:not(.chat-warning)');
    if (description) {
      description.textContent = 'Connecting to cloud...';
    }
  }

  markEmbeddingComplete(): void {
    if (this.embeddingProgressBar && this.embeddingProgressText) {
      this.embeddingProgressBar.style.width = '100%';
      this.embeddingProgressText.textContent = 'Ready';
    }
  }

  markEmbeddingError(): void {
    if (this.embeddingProgressText) {
      this.embeddingProgressText.textContent = 'Failed (using fallback)';
    }
  }

  showChat(): void {
    if (this.loadSection) this.loadSection.style.display = 'none';
    if (this.messagesContainer) this.messagesContainer.style.display = 'flex';

    const inputArea = this.panel?.querySelector('.chat-input-area') as HTMLElement;
    if (inputArea) inputArea.style.display = 'block';

    this.inputField?.focus();
  }

  addMessage(message: ChatMessage): void {
    if (!this.messagesContainer) return;

    const el = document.createElement('div');
    el.className = `chat-message ${message.role}`;

    // Only linkify assistant messages (user input stays as text for security)
    if (message.role === 'assistant') {
      el.innerHTML = linkifyContent(message.content);
    } else {
      el.textContent = message.content;
    }

    this.messagesContainer.appendChild(el);
    this.scrollToBottom();
  }

  updateLastAssistantMessage(content: string): void {
    if (!this.messagesContainer) return;

    const messages = this.messagesContainer.querySelectorAll('.chat-message.assistant');
    const lastMessage = messages[messages.length - 1] as HTMLElement;
    if (lastMessage) {
      lastMessage.innerHTML = linkifyContent(content);
      this.scrollToBottom();
    }
  }

  showTypingIndicator(): void {
    if (!this.messagesContainer) return;

    // Remove existing typing indicator
    this.hideTypingIndicator();

    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chat-typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    this.messagesContainer.appendChild(typing);
    this.scrollToBottom();
  }

  hideTypingIndicator(): void {
    const typing = document.getElementById('chat-typing-indicator');
    typing?.remove();
  }

  setInputEnabled(enabled: boolean): void {
    if (this.inputField) this.inputField.disabled = !enabled;
    // Don't disable button - it becomes stop button when generating
  }

  setGenerating(generating: boolean): void {
    this.isGenerating = generating;
    if (this.sendButton) {
      if (generating) {
        this.sendButton.innerHTML = STOP_ICON;
        this.sendButton.setAttribute('aria-label', 'Stop generation');
        this.sendButton.classList.add('stop');
      } else {
        this.sendButton.innerHTML = SEND_ICON;
        this.sendButton.setAttribute('aria-label', 'Send message');
        this.sendButton.classList.remove('stop');
        // Re-focus input after generation completes
        this.inputField?.focus();
      }
    }
  }

  setModelName(modelId: string, isCloud: boolean = false): void {
    // Extract friendly name from model ID
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    let name: string;
    let suffix: string;

    if (model) {
      name = model.name;
      suffix = isCloud ? 'Cloud' : 'Local';
    } else if (modelId.startsWith('groq:')) {
      name = 'Llama 3.3 70B';
      suffix = 'Cloud';
    } else {
      name = modelId.split('-')[0];
      suffix = 'Local';
    }

    this.currentModelName = `${name} <span class="chat-model-suffix">(${suffix})</span>`;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  enableLocalModels(): void {
    if (!this.modelSelect) return;

    const options = this.modelSelect.querySelectorAll('option');
    options.forEach(option => {
      if (!option.value.startsWith('groq:')) {
        option.disabled = false;
        // Remove "- checking..." suffix
        const model = AVAILABLE_MODELS.find(m => m.id === option.value);
        if (model) {
          option.textContent = `${model.name} (${model.size})`;
        }
      }
    });
  }

  disableLocalModels(): void {
    if (!this.modelSelect) return;

    // Update local model options from "checking..." to "requires WebGPU"
    const options = this.modelSelect.querySelectorAll('option');
    options.forEach(option => {
      if (!option.value.startsWith('groq:')) {
        const model = AVAILABLE_MODELS.find(m => m.id === option.value);
        if (model) {
          option.textContent = `${model.name} (${model.size}) - requires WebGPU`;
        }
      }
    });

    // Update description to mention cloud-only
    const desc = this.loadSection?.querySelector('.chat-load-desc');
    if (desc) {
      desc.textContent = 'Local models unavailable. Using cloud AI via secure proxy.';
    }
  }

  disableCloudModels(): void {
    if (!this.modelSelect) return;

    // Disable cloud model options and update their text
    const options = this.modelSelect.querySelectorAll('option');
    let firstLocalEnabled = false;
    options.forEach(option => {
      if (option.value.startsWith('groq:')) {
        option.disabled = true;
        const model = AVAILABLE_MODELS.find(m => m.id === option.value);
        if (model) {
          option.textContent = `${model.name} (${model.size}) - unavailable`;
        }
      } else if (!option.disabled && !firstLocalEnabled) {
        // Select first available local model
        option.selected = true;
        firstLocalEnabled = true;
        // Trigger change event to update description
        this.modelSelect?.dispatchEvent(new Event('change'));
      }
    });

    // Update description if no models are available at all
    if (!firstLocalEnabled) {
      const desc = this.loadSection?.querySelector('.chat-load-desc');
      if (desc) {
        desc.textContent = 'No chat models available. Cloud proxy not configured and WebGPU not supported.';
      }
      if (this.loadButton) {
        this.loadButton.disabled = true;
        this.loadButton.textContent = 'Chat Unavailable';
      }
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
