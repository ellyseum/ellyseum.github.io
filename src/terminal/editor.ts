/**
 * Markdown editor with AI assistant
 * Lazy loaded on auth (Layer 3)
 *
 * Uses existing Groq worker for AI rewrites
 */

import { marked } from 'marked';
import type { GitHubClient } from './github';
import { SITE_CONFIG } from '../data/site-config';

interface EditorOptions {
  path: string;
  content: string;
  github: GitHubClient;
  isNew?: boolean;
  onSave?: () => void;
}

let currentEditor: HTMLDivElement | null = null;

export function openEditor(options: EditorOptions): void {
  // Close any existing editor
  closeEditor();

  const { path, content, github, isNew, onSave } = options;

  // Create editor container
  const editor = document.createElement('div');
  editor.id = 'secret-editor';
  editor.innerHTML = `
    <div class="editor-backdrop"></div>
    <div class="editor-window">
      <div class="editor-header">
        <span class="editor-path">${path}</span>
        <div class="editor-actions">
          <button class="editor-btn editor-btn-ai" title="AI Assistant">✨ AI</button>
          <button class="editor-btn editor-btn-save" title="Save changes">💾 Save</button>
          <button class="editor-btn editor-btn-close" title="Close">×</button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-pane editor-source">
          <textarea class="editor-textarea" spellcheck="false">${escapeHtml(content)}</textarea>
        </div>
        <div class="editor-pane editor-preview">
          <div class="editor-preview-content"></div>
        </div>
      </div>
      <div class="editor-ai-panel" hidden>
        <div class="ai-header">
          <span>AI Assistant</span>
          <button class="ai-close">×</button>
        </div>
        <div class="ai-body">
          <textarea class="ai-input" placeholder="Describe what you want to change...
Examples:
• Make the intro punchier
• Fix any grammar issues
• Add a conclusion paragraph
• Rewrite in a more casual tone"></textarea>
          <div class="ai-actions">
            <select class="ai-voice-select">
              <option value="">Default voice</option>
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="witty">Witty</option>
            </select>
            <button class="ai-submit">Apply Changes</button>
          </div>
        </div>
        <div class="ai-loading" hidden>
          <span class="ai-spinner"></span> Thinking...
        </div>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #secret-editor {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: editorFadeIn 0.2s ease-out;
    }

    @keyframes editorFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .editor-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
    }

    .editor-window {
      position: relative;
      width: min(1200px, 95vw);
      height: min(800px, 90vh);
      background: #0f0f14;
      border: 1px solid #333;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      animation: editorSlideIn 0.3s ease-out;
    }

    @keyframes editorSlideIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .editor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1a1a24;
      border-bottom: 1px solid #333;
      border-radius: 8px 8px 0 0;
    }

    .editor-path {
      font-family: monospace;
      font-size: 13px;
      color: #9ca3af;
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }

    .editor-btn {
      padding: 6px 12px;
      border: 1px solid #444;
      border-radius: 4px;
      background: #1f1f2e;
      color: #e5e7eb;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .editor-btn:hover {
      background: #2a2a3e;
      border-color: #555;
    }

    .editor-btn-ai {
      border-color: #7c3aed;
      color: #c4b5fd;
    }

    .editor-btn-ai:hover {
      background: #7c3aed33;
    }

    .editor-btn-save {
      border-color: #22c55e;
      color: #86efac;
    }

    .editor-btn-save:hover {
      background: #22c55e33;
    }

    .editor-btn-close {
      padding: 6px 10px;
      font-size: 18px;
      line-height: 1;
    }

    .editor-btn-close:hover {
      color: #ef4444;
      border-color: #ef4444;
    }

    .editor-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .editor-pane {
      flex: 1;
      overflow: auto;
    }

    .editor-source {
      border-right: 1px solid #333;
    }

    .editor-textarea {
      width: 100%;
      height: 100%;
      padding: 16px;
      border: none;
      background: #0a0a0f;
      color: #e5e7eb;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      outline: none;
    }

    .editor-preview {
      background: #0f0f14;
    }

    .editor-preview-content {
      padding: 24px 32px;
      color: #e5e7eb;
      font-family: system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.8;
      max-width: 100%;
    }

    .preview-title {
      font-size: 2.2em;
      font-weight: 700;
      color: #f9fafb;
      margin: 0 0 0.3em;
      line-height: 1.2;
      padding: 24px 32px 0;
    }

    .preview-subtitle {
      font-size: 1.2em;
      color: #9ca3af;
      margin: 0 0 0.5em;
      padding: 0 32px;
      font-style: italic;
    }

    .preview-date {
      font-size: 0.85em;
      color: #6b7280;
      margin: 0 0 1.5em;
      padding: 0 32px;
    }

    .editor-preview-content h1,
    .editor-preview-content h2,
    .editor-preview-content h3 {
      color: #f9fafb;
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      font-weight: 600;
    }

    .editor-preview-content h1 { font-size: 1.8em; }
    .editor-preview-content h2 { font-size: 1.5em; color: #c4b5fd; }
    .editor-preview-content h3 { font-size: 1.25em; }

    .editor-preview-content p {
      margin: 1.2em 0;
    }

    .editor-preview-content code {
      background: #1f1f2e;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: "JetBrains Mono", "Fira Code", monospace;
    }

    .editor-preview-content pre {
      background: #0a0a12;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #1f1f2e;
      margin: 1.5em 0;
    }

    .editor-preview-content pre code {
      background: none;
      padding: 0;
    }

    .editor-preview-content blockquote {
      border-left: 3px solid #7c3aed;
      margin: 1.5em 0;
      padding: 0.5em 0 0.5em 1.5em;
      color: #9ca3af;
      background: #7c3aed08;
      border-radius: 0 8px 8px 0;
    }

    .editor-preview-content a {
      color: #a78bfa;
      text-decoration: none;
      border-bottom: 1px solid #a78bfa33;
      transition: border-color 0.2s;
    }

    .editor-preview-content a:hover {
      border-color: #a78bfa;
    }

    .editor-preview-content ul,
    .editor-preview-content ol {
      margin: 1.2em 0;
      padding-left: 1.5em;
    }

    .editor-preview-content li {
      margin: 0.4em 0;
    }

    .editor-preview-content img {
      max-width: 100%;
      border-radius: 8px;
      margin: 1.5em 0;
    }

    .editor-preview-content hr {
      border: none;
      border-top: 1px solid #333;
      margin: 2em 0;
    }

    /* AI Panel */
    .editor-ai-panel {
      position: absolute;
      right: 16px;
      top: 60px;
      width: 320px;
      background: #1a1a24;
      border: 1px solid #7c3aed;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid #333;
      color: #c4b5fd;
      font-size: 13px;
      font-weight: 500;
    }

    .ai-close {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
    }

    .ai-close:hover {
      color: #ef4444;
    }

    .ai-body {
      padding: 12px;
    }

    .ai-input {
      width: 100%;
      height: 120px;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 6px;
      background: #0f0f14;
      color: #e5e7eb;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      resize: none;
      outline: none;
    }

    .ai-input:focus {
      border-color: #7c3aed;
    }

    .ai-input::placeholder {
      color: #6b7280;
    }

    .ai-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .ai-voice-select {
      flex: 1;
      padding: 8px;
      border: 1px solid #333;
      border-radius: 4px;
      background: #0f0f14;
      color: #e5e7eb;
      font-size: 12px;
      outline: none;
    }

    .ai-submit {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: #7c3aed;
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .ai-submit:hover {
      background: #6d28d9;
    }

    .ai-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ai-loading {
      padding: 16px;
      text-align: center;
      color: #9ca3af;
    }

    .ai-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #333;
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Mobile */
    @media (max-width: 768px) {
      .editor-body {
        flex-direction: column;
      }

      .editor-source {
        border-right: none;
        border-bottom: 1px solid #333;
      }

      .editor-ai-panel {
        right: 8px;
        left: 8px;
        width: auto;
      }
    }
  `;
  editor.appendChild(style);

  // Get elements
  const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
  const preview = editor.querySelector('.editor-preview-content') as HTMLDivElement;
  const aiPanel = editor.querySelector('.editor-ai-panel') as HTMLDivElement;
  const aiInput = editor.querySelector('.ai-input') as HTMLTextAreaElement;
  const aiVoice = editor.querySelector('.ai-voice-select') as HTMLSelectElement;
  const aiSubmit = editor.querySelector('.ai-submit') as HTMLButtonElement;
  const aiLoading = editor.querySelector('.ai-loading') as HTMLDivElement;
  const aiBody = editor.querySelector('.ai-body') as HTMLDivElement;

  // Update preview on input
  function updatePreview() {
    const md = textarea.value;
    // Extract frontmatter and content
    const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    let frontmatter: Record<string, string> = {};
    let content = md;

    if (fmMatch) {
      // Parse frontmatter
      const fmLines = fmMatch[1].split('\n');
      for (const line of fmLines) {
        const match = line.match(/^(\w+):\s*["']?([^"'\n]*)["']?/);
        if (match) {
          frontmatter[match[1]] = match[2];
        }
      }
      content = fmMatch[2];
    }

    // Build preview with title/subtitle from frontmatter
    let html = '';
    if (frontmatter.title) {
      html += `<h1 class="preview-title">${frontmatter.title}</h1>`;
    }
    if (frontmatter.subtitle) {
      html += `<p class="preview-subtitle">${frontmatter.subtitle}</p>`;
    }
    if (frontmatter.date) {
      html += `<p class="preview-date">${frontmatter.date}</p>`;
    }
    html += '<div class="preview-content">' + (marked.parse(content) as string) + '</div>';

    preview.innerHTML = html;
  }

  textarea.addEventListener('input', updatePreview);
  updatePreview();

  // Close handlers
  editor.querySelector('.editor-backdrop')?.addEventListener('click', closeEditor);
  editor.querySelector('.editor-btn-close')?.addEventListener('click', closeEditor);

  // ESC to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeEditor();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Save handler
  editor.querySelector('.editor-btn-save')?.addEventListener('click', async () => {
    const saveBtn = editor.querySelector('.editor-btn-save') as HTMLButtonElement;
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';

    try {
      // Convert path to file path for GitHub
      let filePath = path;
      if (path.startsWith('/')) {
        filePath = path.slice(1);
      }
      if (path.startsWith('/_drafts/')) {
        filePath = path.slice(1); // _drafts/filename.md
      } else if (path.match(/\/\d{4}\/\d{2}\/\d{2}\//)) {
        // Convert URL path to _posts path
        const match = path.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)/);
        if (match) {
          const [, year, month, day, slug] = match;
          filePath = `_posts/${year}-${month}-${day}-${slug}.md`;
        }
      }

      await github.saveFile(
        filePath,
        textarea.value,
        isNew ? `Create: ${filePath}` : `Update: ${filePath}`
      );

      saveBtn.textContent = '✓ Saved!';
      onSave?.();

      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save';
      }, 2000);
    } catch (e) {
      saveBtn.textContent = '❌ Error';
      console.error('Save failed:', e);

      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save';
      }, 2000);
    }
  });

  // AI Panel toggle
  editor.querySelector('.editor-btn-ai')?.addEventListener('click', () => {
    aiPanel.hidden = !aiPanel.hidden;
    if (!aiPanel.hidden) {
      aiInput.focus();
    }
  });

  editor.querySelector('.ai-close')?.addEventListener('click', () => {
    aiPanel.hidden = true;
  });

  // AI Submit
  aiSubmit.addEventListener('click', async () => {
    const instruction = aiInput.value.trim();
    if (!instruction) return;

    const voice = aiVoice.value;

    aiBody.hidden = true;
    aiLoading.hidden = false;
    aiSubmit.disabled = true;

    try {
      const result = await callAI(textarea.value, instruction, voice);
      textarea.value = result;
      updatePreview();
      aiInput.value = '';
    } catch (e) {
      console.error('AI error:', e);
      alert('AI request failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      aiBody.hidden = false;
      aiLoading.hidden = true;
      aiSubmit.disabled = false;
    }
  });

  // Cmd/Ctrl+S to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      editor.querySelector('.editor-btn-save')?.dispatchEvent(new Event('click'));
    }
  });

  document.body.appendChild(editor);
  currentEditor = editor;
  textarea.focus();
}

export function closeEditor(): void {
  if (currentEditor) {
    currentEditor.remove();
    currentEditor = null;
  }
}

async function callAI(content: string, instruction: string, voice: string): Promise<string> {
  // Get worker URL from config
  const config = SITE_CONFIG as Record<string, unknown>;
  const workerUrl = (config.worker_url as string) || 'https://chat.ellyseum.me';

  // Build system prompt
  let systemPrompt = `You are a writing assistant helping edit a markdown blog post.
The user will give you the current content and an instruction for how to modify it.
Return ONLY the modified markdown content - no explanations, no code fences, just the content.
Preserve the frontmatter exactly as-is unless the instruction specifically asks to change it.`;

  if (voice) {
    const voiceGuides: Record<string, string> = {
      casual: 'Write in a casual, conversational tone. Use contractions and informal language.',
      professional: 'Write in a professional, polished tone. Be clear and authoritative.',
      witty: 'Write with wit and humor. Add clever observations and playful language.',
    };
    systemPrompt += `\n\nVoice style: ${voiceGuides[voice] || voice}`;
  }

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the current content:\n\n${content}\n\n---\n\nInstruction: ${instruction}` },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || content;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
