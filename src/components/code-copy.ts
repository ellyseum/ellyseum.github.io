/**
 * Code Copy Button - Adds copy functionality to code blocks
 */

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"></polyline>
</svg>`;

export function initCodeCopy(): void {
  // Find all code blocks - both with language class and plain highlight divs
  const codeBlocks = document.querySelectorAll(
    '.post-content div.highlighter-rouge, .post-content div.highlight'
  );

  codeBlocks.forEach((block) => {
    // Skip if already has a copy button
    if (block.querySelector('.code-copy-btn')) return;

    // Skip nested highlight divs (only add to outer container)
    if (block.classList.contains('highlight') && block.parentElement?.classList.contains('highlighter-rouge')) {
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.setAttribute('title', 'Copy code');
    btn.innerHTML = COPY_ICON;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find the code element
      const code = block.querySelector('code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent || '');

        // Show success state
        btn.innerHTML = CHECK_ICON;
        btn.classList.add('copied');

        // Reset after delay
        setTimeout(() => {
          btn.innerHTML = COPY_ICON;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    block.appendChild(btn);
  });
}
