/**
 * Chat Widget Styles
 * CSS-in-JS injected at runtime
 * z-index 200 to sit above header (100)
 */

export const CHAT_STYLES = `
/* Chat Widget Container */
.chat-widget {
  --chat-bg: rgba(1, 1, 8, 0.95);
  --chat-border: rgba(139, 92, 246, 0.3);
  --chat-primary: #8b5cf6;
  --chat-secondary: #ec4899;
  --chat-text: #e5e7eb;
  --chat-text-muted: #9ca3af;
  --chat-user-bg: rgba(139, 92, 246, 0.2);
  --chat-assistant-bg: rgba(30, 30, 40, 0.8);
  --chat-input-bg: rgba(30, 30, 40, 0.6);
  --chat-radius: 12px;
  --chat-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 200;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Toggle Button */
.chat-toggle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chat-primary), var(--chat-secondary));
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  transition: transform var(--chat-transition), box-shadow var(--chat-transition);
}

.chat-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 30px rgba(139, 92, 246, 0.6);
}

.chat-toggle:focus-visible {
  outline: 2px solid var(--chat-primary);
  outline-offset: 4px;
}

.chat-toggle svg {
  width: 28px;
  height: 28px;
  fill: white;
  transition: transform var(--chat-transition);
}

.chat-toggle[aria-expanded="true"] svg {
  transform: rotate(90deg);
}

/* Chat Panel */
.chat-panel {
  position: absolute;
  bottom: 72px;
  right: 0;
  width: 380px;
  height: 520px;
  background: var(--chat-bg);
  border: 1px solid var(--chat-border);
  border-radius: var(--chat-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  pointer-events: none;
  transition: opacity var(--chat-transition), transform var(--chat-transition);
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

.chat-panel.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--chat-border);
  background: rgba(139, 92, 246, 0.05);
}

.chat-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--chat-text);
  white-space: nowrap;
}

.chat-header-status {
  font-size: 11px;
  color: var(--chat-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.chat-header-status::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chat-text-muted);
}

.chat-header-status.ready::before {
  background: #22c55e;
}

.chat-header-status.loading::before {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

.chat-model-suffix {
  opacity: 0.6;
}

.chat-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--chat-text-muted);
  transition: background var(--chat-transition), border-color var(--chat-transition);
}

.chat-close:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--chat-border);
}

.chat-close svg {
  width: 18px;
  height: 18px;
}

/* Messages Container */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--chat-border);
  border-radius: 3px;
}

/* Message Bubbles */
.chat-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: var(--chat-radius);
  font-size: 14px;
  line-height: 1.5;
  color: var(--chat-text);
  animation: messageIn 0.3s ease;
}

.chat-message.user {
  align-self: flex-end;
  background: var(--chat-user-bg);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.chat-message.assistant {
  align-self: flex-start;
  background: var(--chat-assistant-bg);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.chat-link {
  color: var(--chat-primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--chat-transition);
}

.chat-link:hover {
  border-bottom-color: var(--chat-primary);
}

/* Typing Indicator */
.chat-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: var(--chat-assistant-bg);
  border-radius: var(--chat-radius);
  align-self: flex-start;
}

.chat-typing span {
  width: 6px;
  height: 6px;
  background: var(--chat-text-muted);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.chat-typing span:nth-child(1) { animation-delay: -0.32s; }
.chat-typing span:nth-child(2) { animation-delay: -0.16s; }

/* Load AI Section */
.chat-load-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.chat-load-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.chat-load-section h4 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.chat-load-section p {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--chat-text-muted);
  line-height: 1.5;
}

.chat-warning {
  color: #fbbf24 !important;
  font-size: 11px !important;
  margin-bottom: 16px !important;
}

/* Model Selector */
.chat-model-select {
  width: 100%;
  max-width: 240px;
  padding: 10px 12px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--chat-input-bg);
  border: 1px solid var(--chat-border);
  color: var(--chat-text);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--chat-transition);
}

.chat-model-select:focus {
  outline: none;
  border-color: var(--chat-primary);
}

.chat-model-select option {
  background: #1a1a2e;
  color: var(--chat-text);
}

.chat-load-btn {
  padding: 12px 24px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--chat-primary), var(--chat-secondary));
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--chat-transition), box-shadow var(--chat-transition);
}

.chat-load-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
}

.chat-load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Progress Bars */
.chat-progress-container {
  width: 100%;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-progress {
  width: 100%;
}

.chat-progress-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--chat-text);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chat-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.chat-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--chat-primary), var(--chat-secondary));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.chat-progress-text {
  margin-top: 6px;
  font-size: 10px;
  color: var(--chat-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Error State */
.chat-error {
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--chat-radius);
  color: #fca5a5;
  font-size: 13px;
  line-height: 1.5;
  margin: 16px;
}

/* Input Area */
.chat-input-area {
  padding: 16px;
  border-top: 1px solid var(--chat-border);
  background: rgba(0, 0, 0, 0.2);
}

.chat-input-form {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--chat-input-bg);
  border: 1px solid var(--chat-border);
  color: var(--chat-text);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  transition: border-color var(--chat-transition);
}

.chat-input:focus {
  outline: none;
  border-color: var(--chat-primary);
}

.chat-input::placeholder {
  color: var(--chat-text-muted);
}

.chat-send {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--chat-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--chat-transition), transform var(--chat-transition);
}

.chat-send:hover:not(:disabled) {
  background: #7c3aed;
  transform: scale(1.05);
}

.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-send svg {
  width: 20px;
  height: 20px;
  fill: white;
}

.chat-send.stop {
  background: #ef4444;
}

.chat-send.stop:hover {
  background: #dc2626;
}

/* Animations */
@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Mobile Styles - Bottom Sheet */
@media (max-width: 640px) {
  .chat-widget {
    bottom: 16px;
    right: 16px;
  }

  .chat-toggle {
    width: 52px;
    height: 52px;
  }

  /* Hide toggle button when chat is open on mobile */
  .chat-toggle[aria-expanded="true"] {
    display: none;
  }

  .chat-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    height: 70vh;
    max-height: 600px;
    border-radius: var(--chat-radius) var(--chat-radius) 0 0;
    transform: translateY(100%);
  }

  .chat-panel.open {
    transform: translateY(0);
  }

  .chat-message {
    max-width: 90%;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .chat-panel,
  .chat-toggle,
  .chat-toggle svg,
  .chat-message,
  .chat-send,
  .chat-load-btn {
    transition: none;
  }

  .chat-typing span {
    animation: none;
    opacity: 0.5;
  }

  .chat-header-status.loading::before {
    animation: none;
  }
}
`;

export function injectChatStyles(): void {
  if (document.getElementById('chat-widget-styles')) return;

  const style = document.createElement('style');
  style.id = 'chat-widget-styles';
  style.textContent = CHAT_STYLES;
  document.head.appendChild(style);
}
