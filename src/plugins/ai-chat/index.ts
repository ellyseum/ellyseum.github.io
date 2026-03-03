import type { EllysPlugin } from '@/core/plugin-types';

const aiChat: EllysPlugin = {
  name: 'ai-chat',
  description: 'Two-tier AI chatbot (WebGPU local + Groq cloud)',
  loadStrategy: 'lazy',
  trigger: {
    type: 'custom',
    when: () => new Promise<void>(resolve => {
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        // Mobile: load immediately
        resolve();
        return;
      }

      // Desktop: show placeholder, load on hover
      const placeholder = document.createElement('div');
      placeholder.innerHTML = `
        <button class="chat-toggle-placeholder" style="
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--glow);
          z-index: 200;
          transition: transform 0.3s, box-shadow 0.3s;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </button>
      `;
      const btn = placeholder.firstElementChild as HTMLElement;
      document.body.appendChild(btn);

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = 'var(--glow-strong, 0 6px 30px rgba(139, 92, 246, 0.6))';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.boxShadow = '';
      });

      btn.addEventListener('mouseenter', () => {
        btn.remove();
        resolve();
      }, { once: true });
    }),
  },

  async init() {
    const { initChatWidget } = await import('@/components/chat-widget/chat-widget');
    const widget = initChatWidget();
    widget.preload();
  },
};

export default aiChat;
