import { ThemeManager, THEMES, type ThemeId } from '@/core/theme-manager';

export function initThemeSwitcher(themeManager: ThemeManager): void {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  // Don't add if already present (SPA navigation)
  if (nav.querySelector('.theme-switcher')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-switcher';

  const button = document.createElement('button');
  button.className = 'theme-switcher-btn';
  button.setAttribute('aria-label', 'Switch theme');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = getButtonIcon(themeManager.getTheme());

  const dropdown = document.createElement('div');
  dropdown.className = 'theme-switcher-dropdown';
  dropdown.setAttribute('role', 'menu');

  THEMES.forEach(theme => {
    const item = document.createElement('button');
    item.className = 'theme-switcher-option';
    item.setAttribute('role', 'menuitem');
    item.dataset.themeId = theme.id;
    item.innerHTML = `${getOptionIcon(theme.id)}<span>${theme.label}</span>`;

    if (theme.id === themeManager.getTheme()) {
      item.classList.add('active');
    }

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      themeManager.setTheme(theme.id);

      // Update active state
      dropdown.querySelectorAll('.theme-switcher-option').forEach(opt => {
        opt.classList.toggle('active', (opt as HTMLElement).dataset.themeId === theme.id);
      });

      updateButtonIcon(button, theme.id);
      closeDropdown();
    });

    dropdown.appendChild(item);
  });

  wrapper.appendChild(button);
  wrapper.appendChild(dropdown);

  // Insert before the GitHub icon
  const githubLink = nav.querySelector('.nav-icon');
  if (githubLink) {
    nav.insertBefore(wrapper, githubLink);
  } else {
    nav.appendChild(wrapper);
  }

  // Toggle dropdown
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrapper.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  function openDropdown() {
    wrapper.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    wrapper.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
  }

  // Close on outside click
  document.addEventListener('click', () => closeDropdown());

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });
}

function getOptionIcon(theme: ThemeId): string {
  const attrs = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  switch (theme) {
    case 'galaxy':
      return `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>`;
    case 'classic-white':
      return `<svg ${attrs}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42"/></svg>`;
    case 'classic-dark':
      return `<svg ${attrs}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
  }
}

function getButtonIcon(theme: ThemeId): string {
  const attrs = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  switch (theme) {
    case 'galaxy':
      return `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>`;
    case 'classic-white':
      return `<svg ${attrs}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42"/></svg>`;
    case 'classic-dark':
      return `<svg ${attrs}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
  }
}

function updateButtonIcon(button: HTMLButtonElement, theme: ThemeId): void {
  button.innerHTML = getButtonIcon(theme);
}
