/**
 * Secret Terminal - Konami code reveals a hidden terminal
 *
 * Layer 1: Console easter egg (always loaded - tiny)
 * Layer 2: Terminal UI (lazy loaded on konami code)
 * Layer 3: Editor + GitHub (lazy loaded on auth)
 */

const CONSOLE_ART = `
%c___________.__  .__
\\_   _____/|  | |  | ___.__. ______ ____  __ __  _____        _____   ____
 |    __)_ |  | |  |<   |  |/  ___// __ \\|  |  \\/     \\      /     \\_/ __ \\
 |        \\|  |_|  |_\\___  |\\___ \\\\  ___/|  |  /  Y Y  \\    |  Y Y  \\  ___/
/_______  /|____/____/ ____/____  >\\___  >____/|__|_|  / /\\ |__|_|  /\\___  >
        \\/           \\/         \\/     \\/            \\/  \\/       \\/     \\/
%c=--=--==---=-==--=--=-=-==--=-=--==--=-=--=-==--=-=--==--=--==---=-==--=--==

%c        Looking for secrets? What a CONTRArian.
        Hint: This code is open source — check the header.
`;

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

let konamiIndex = 0;
let terminalModule: typeof import('./terminal') | null = null;
let terminalInstance: import('./terminal').Terminal | null = null;
let konamiUnlocked = false; // Track if konami was ever entered

function printConsoleEasterEgg(): void {
  console.log(
    CONSOLE_ART,
    'color: #a855f7; font-family: monospace; font-size: 10px; line-height: 1.1;',
    'color: #6b7280; font-family: monospace; font-size: 10px;',
    'color: #9ca3af; font-family: monospace; font-size: 11px;'
  );
}

function handleKonamiInput(e: KeyboardEvent): void {
  // Ignore if terminal is already open or user is typing in an input
  if (terminalInstance?.isOpen) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  const expectedKey = KONAMI_CODE[konamiIndex];

  if (e.code === expectedKey) {
    konamiIndex++;

    if (konamiIndex === KONAMI_CODE.length) {
      konamiIndex = 0;
      activateTerminal();
    }
  } else {
    konamiIndex = 0;
  }
}

async function activateTerminal(): Promise<void> {
  // Lazy load the terminal module
  if (!terminalModule) {
    try {
      terminalModule = await import('./terminal');
    } catch (e) {
      console.error('Failed to load terminal:', e);
      return;
    }
  }

  if (!terminalInstance) {
    terminalInstance = new terminalModule.Terminal();
  }

  // Mark as unlocked for backtick shortcut
  if (!konamiUnlocked) {
    konamiUnlocked = true;
    // Store in sessionStorage so backtick works after page nav
    try {
      sessionStorage.setItem('ellyseum_terminal_unlocked', '1');
    } catch {
      // sessionStorage might be unavailable
    }
  }

  terminalInstance.open();
}

function handleBacktick(e: KeyboardEvent): void {
  // Only if terminal was unlocked (konami entered or auth set the flag)
  if (!konamiUnlocked) return;

  // Ignore if typing in input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  if (e.key === '`') {
    e.preventDefault();
    activateTerminal();
  }
}

export function initSecretTerminal(): void {
  // Print console easter egg (always runs - no lazy load needed, it's just a string)
  printConsoleEasterEgg();

  // Check if previously unlocked via konami
  try {
    if (sessionStorage.getItem('ellyseum_terminal_unlocked')) {
      konamiUnlocked = true;
    }
  } catch {
    // Storage might be unavailable
  }

  // Listen for Konami code
  document.addEventListener('keydown', handleKonamiInput);

  // Listen for backtick shortcut (only works if unlocked)
  document.addEventListener('keydown', handleBacktick);

  // Debug: Allow ?terminal=1 for development
  if (new URLSearchParams(window.location.search).has('terminal')) {
    activateTerminal();
  }
}

// Export for external access if needed
export function getTerminal() {
  return terminalInstance;
}
