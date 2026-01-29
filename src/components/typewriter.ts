/**
 * Typewriter Effect - Rotating taglines with realistic typing
 * Includes blinking caret that moves with text
 */

import { TAGLINES } from '@/data/taglines';

// Typing speed ranges (ms) - varies for realism
const TYPE_SPEED_MIN = 25;
const TYPE_SPEED_MAX = 65;
const BACKSPACE_SPEED_MIN = 10; // Fast backspace for clearing line
const BACKSPACE_SPEED_MAX = 23;
const TYPO_FIX_BACKSPACE_MIN = 50; // Slower backspace for fixing typos
const TYPO_FIX_BACKSPACE_MAX = 90;
const PAUSE_AFTER_TYPE = 4000; // 4 seconds
const PAUSE_AFTER_BACKSPACE = 300;

// Typo settings
const BASE_TYPO_CHANCE = 0.05; // 5% base chance per character
const TYPO_CHANCE_DECAY_PER_TYPO = 0.005;
const TYPO_CHANCE_DECAY_PER_FIX = 0.01;
const NOTICE_TIMER_MIN = 100; // Time before noticing typo
const NOTICE_TIMER_MAX = 200;
const REALIZE_PAUSE_MIN = 50; // Pause after noticing, before fixing
const REALIZE_PAUSE_MAX = 150;

// Typo type weights: extra key 40%, whitespace 25%, dyslexia 20%, fat finger 15%
const TYPO_EXTRA_KEY = 0.40;
const TYPO_WHITESPACE = 0.25;
const TYPO_DYSLEXIA = 0.20;
// Fat finger is the remaining 15%

// Shift-held typo cascade (independent of other typos, can combine)
// After uppercase: 5% chance. If triggered → next char 3%. If triggered → next char 1%.
// Cascade only continues if the typo actually occurred.
const SHIFT_HELD_CHANCE_1 = 0.05;
const SHIFT_HELD_CHANCE_2 = 0.03;
const SHIFT_HELD_CHANCE_3 = 0.01;

// QWERTY keyboard adjacency map for "fat finger" typos (horizontal neighbors only)
const ADJACENT_KEYS: Record<string, string[]> = {
  // Top row: q w e r t y u i o p
  'q': ['w'],
  'w': ['q', 'e'],
  'e': ['w', 'r'],
  'r': ['e', 't'],
  't': ['r', 'y'],
  'y': ['t', 'u'],
  'u': ['y', 'i'],
  'i': ['u', 'o'],
  'o': ['i', 'p'],
  'p': ['o', '['],
  // Home row: a s d f g h j k l
  'a': ['s'],
  's': ['a', 'd'],
  'd': ['s', 'f'],
  'f': ['d', 'g'],
  'g': ['f', 'h'],
  'h': ['g', 'j'],
  'j': ['h', 'k'],
  'k': ['j', 'l'],
  'l': ['k', ';'],
  // Bottom row: z x c v b n m
  'z': ['x'],
  'x': ['z', 'c'],
  'c': ['x', 'v'],
  'v': ['c', 'b'],
  'b': ['v', 'n'],
  'n': ['b', 'm'],
  'm': ['n', ','],
};

export class Typewriter {
  private element: HTMLElement | null = null;
  private remainingTaglines: string[] = [];
  private currentTagline = '';
  private currentText = '';
  private isTyping = false;
  private isDestroyed = false;
  private timeoutId: number | null = null;
  private typoChance = BASE_TYPO_CHANCE;

  constructor() {
    this.refillTaglines();
    this.currentTagline = this.pickNext();
  }

  private refillTaglines(): void {
    this.remainingTaglines = [...TAGLINES].sort(() => Math.random() - 0.5);
  }

  private pickNext(): string {
    if (this.remainingTaglines.length === 0) {
      this.refillTaglines();
    }
    return this.remainingTaglines.shift()!;
  }

  private resetTypoChance(): void {
    this.typoChance = BASE_TYPO_CHANCE;
  }

  init(): void {
    // IMPORTANT: Scope to .site-content to avoid matching cached prerender divs
    this.element = document.querySelector('.site-content .intro-tagline');
    if (!this.element) return;

    this.isDestroyed = false;
    this.element.classList.add('typewriter-active');

    // Start empty and type fresh
    this.currentText = '';
    this.element.innerHTML = `<span class="typewriter-text"></span><span class="typewriter-caret"></span>`;

    this.startTyping();
  }

  private async startTyping(): Promise<void> {
    if (this.isDestroyed) return;
    this.isTyping = true;

    // Type the current tagline
    await this.type(this.currentTagline);
    if (this.isDestroyed) return;

    this.isTyping = false;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.isDestroyed) return;
    this.timeoutId = window.setTimeout(() => {
      this.cycleToNext();
    }, PAUSE_AFTER_TYPE);
  }

  private async cycleToNext(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.isTyping) return;
    this.isTyping = true;

    // Pick next tagline
    this.currentTagline = this.pickNext();

    // Backspace current text
    await this.backspace();

    // Small pause
    await this.sleep(PAUSE_AFTER_BACKSPACE);

    // Type new text
    await this.type(this.currentTagline);

    this.isTyping = false;
    this.scheduleNext();
  }

  private async backspace(): Promise<void> {
    const textSpan = this.element?.querySelector('.typewriter-text');
    if (!textSpan) return;

    while (this.currentText.length > 0 && !this.isDestroyed) {
      this.currentText = this.currentText.slice(0, -1);
      textSpan.textContent = this.currentText;
      await this.sleep(this.randomSpeed(BACKSPACE_SPEED_MIN, BACKSPACE_SPEED_MAX));
    }
  }

  private async type(text: string): Promise<void> {
    const textSpan = this.element?.querySelector('.typewriter-text');
    if (!textSpan) return;

    this.resetTypoChance();
    let i = 0;

    while (i < text.length && !this.isDestroyed) {
      // Type from current position, possibly with typos
      const result = await this.typeWithTypos(textSpan, text, i);
      if (this.isDestroyed) return;

      if (result.typoStartIndex !== -1) {
        // Had typos - backspace to typo start and continue from there
        const charsToDelete = this.currentText.length - result.typoStartIndex;
        for (let d = 0; d < charsToDelete && !this.isDestroyed; d++) {
          this.currentText = this.currentText.slice(0, -1);
          textSpan.textContent = this.currentText;
          await this.sleep(this.randomSpeed(TYPO_FIX_BACKSPACE_MIN, TYPO_FIX_BACKSPACE_MAX));
        }
        // Decay typo chance after fix
        this.typoChance = Math.max(0, this.typoChance - TYPO_CHANCE_DECAY_PER_FIX);
        // Continue from where the typo started
        i = result.typoStartIndex - (this.currentText.length - result.typoStartIndex);
        // Actually, typoStartIndex is position in currentText, we need position in `text`
        i = result.textIndexAtTypoStart;
      } else {
        // No typos, we're done
        break;
      }
    }
  }

  private async typeWithTypos(
    textSpan: Element,
    text: string,
    startIndex: number
  ): Promise<{ typoStartIndex: number; textIndexAtTypoStart: number }> {
    let typoStartIndex = -1;
    let textIndexAtTypoStart = -1;
    let noticeTimer: number | null = null;
    let noticeTriggered = false;

    const scheduleNotice = () => {
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => {
        noticeTriggered = true;
      }, this.randomSpeed(NOTICE_TIMER_MIN, NOTICE_TIMER_MAX));
    };

    // Shift-held cascade: tracks current chance (0 = inactive)
    // Cascade only continues if the previous shift-held typo actually triggered
    let shiftHeldChance = 0;

    for (let i = startIndex; i < text.length && !this.isDestroyed; i++) {
      // Check if notice timer fired
      if (noticeTriggered) {
        // Pause to "realize" the mistake
        await this.sleep(this.randomSpeed(REALIZE_PAUSE_MIN, REALIZE_PAUSE_MAX));
        return { typoStartIndex, textIndexAtTypoStart };
      }

      const char = text[i];
      const isLowercase = /[a-z]/.test(char);
      const isUppercase = /[A-Z]/.test(char);

      // Check for shift-held typo (independent of regular typos, can combine)
      let shiftHeldTypo = false;
      if (isLowercase && shiftHeldChance > 0) {
        if (Math.random() < shiftHeldChance) {
          shiftHeldTypo = true;
          // Cascade to next level (only if this typo triggered)
          if (shiftHeldChance >= SHIFT_HELD_CHANCE_1) shiftHeldChance = SHIFT_HELD_CHANCE_2;
          else if (shiftHeldChance >= SHIFT_HELD_CHANCE_2) shiftHeldChance = SHIFT_HELD_CHANCE_3;
          else shiftHeldChance = 0; // End of cascade
        } else {
          // Didn't trigger, cascade ends
          shiftHeldChance = 0;
        }
      }

      // Update shift-held for next char
      if (isUppercase) {
        shiftHeldChance = SHIFT_HELD_CHANCE_1; // Start cascade
      } else if (!isLowercase) {
        shiftHeldChance = 0; // Space/punctuation resets
      }
      // If lowercase, shiftHeldChance was already updated above

      const shouldTypo = Math.random() < this.typoChance && /[a-zA-Z]/.test(char);

      if (shouldTypo || shiftHeldTypo) {
        // Generate the typo character
        let typoChar: string;

        if (shiftHeldTypo && !shouldTypo) {
          // Only shift-held typo - uppercase the intended char
          typoChar = char.toUpperCase();
        } else if (shouldTypo) {
          // Regular typo (may combine with shift-held)
          typoChar = this.generateTypo(char, text, i);
          // If also shift-held, uppercase the typo
          if (shiftHeldTypo && /[a-z]/.test(typoChar)) {
            typoChar = typoChar.toUpperCase();
          }
        } else {
          typoChar = char;
        }

        // Check if "typo" is actually the correct character
        if (typoChar === char) {
          // Not a real typo - type it as correct
          this.currentText += char;
          textSpan.textContent = this.currentText;

          let delay = this.randomSpeed(TYPE_SPEED_MIN, TYPE_SPEED_MAX);
          if (',;:'.includes(char)) delay *= 2;
          if ('.!?'.includes(char)) delay *= 3;

          await this.sleep(delay);
        } else {
          // Real typo - record position if first
          if (typoStartIndex === -1) {
            typoStartIndex = this.currentText.length;
            textIndexAtTypoStart = i;
          }

          this.currentText += typoChar;
          textSpan.textContent = this.currentText;

          // Decay typo chance
          this.typoChance = Math.max(0, this.typoChance - TYPO_CHANCE_DECAY_PER_TYPO);

          // Start/reset notice timer
          scheduleNotice();

          await this.sleep(this.randomSpeed(TYPE_SPEED_MIN, TYPE_SPEED_MAX));
        }
      } else {
        // Type correct character
        this.currentText += char;
        textSpan.textContent = this.currentText;

        let delay = this.randomSpeed(TYPE_SPEED_MIN, TYPE_SPEED_MAX);
        if (',;:'.includes(char)) delay *= 2;
        if ('.!?'.includes(char)) delay *= 3;

        await this.sleep(delay);
      }
    }

    // Clear any pending notice timer if we finished without it triggering
    if (noticeTimer !== null) {
      clearTimeout(noticeTimer);
      // If we had typos but finished typing, still need to fix them
      if (typoStartIndex !== -1) {
        await this.sleep(this.randomSpeed(REALIZE_PAUSE_MIN, REALIZE_PAUSE_MAX));
        return { typoStartIndex, textIndexAtTypoStart };
      }
    }

    return { typoStartIndex: -1, textIndexAtTypoStart: -1 };
  }

  private generateTypo(intendedChar: string, text: string, index: number): string {
    const roll = Math.random();

    if (roll < TYPO_EXTRA_KEY) {
      // Extra key - repeat last typed char or intended char
      const lastChar = this.currentText.length > 0
        ? this.currentText[this.currentText.length - 1]
        : intendedChar;
      return lastChar;
    } else if (roll < TYPO_EXTRA_KEY + TYPO_WHITESPACE) {
      // Accidental whitespace
      return ' ';
    } else if (roll < TYPO_EXTRA_KEY + TYPO_WHITESPACE + TYPO_DYSLEXIA) {
      // Dyslexia - swap with next character
      if (index + 1 < text.length && /[a-zA-Z]/.test(text[index + 1])) {
        return text[index + 1]; // Type next char first (will create swap effect)
      }
      return intendedChar; // Fallback
    } else {
      // Fat finger - adjacent key
      const lower = intendedChar.toLowerCase();
      const adjacent = ADJACENT_KEYS[lower];
      if (adjacent && adjacent.length > 0) {
        let typoChar = adjacent[Math.floor(Math.random() * adjacent.length)];
        // Preserve case
        if (intendedChar === intendedChar.toUpperCase() && intendedChar !== intendedChar.toLowerCase()) {
          typoChar = typoChar.toUpperCase();
        }
        return typoChar;
      }
      return intendedChar;
    }
  }

  private randomSpeed(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// Singleton instance
let instance: Typewriter | null = null;

export function initTypewriter(): Typewriter {
  // IMPORTANT: Scope to .site-content to avoid matching cached prerender divs
  const element = document.querySelector('.site-content .intro-tagline');

  // Always destroy existing instance first
  if (instance) {
    instance.destroy();
    instance = null;
  }

  // Only create new instance if element exists (we're on home page)
  if (!element) {
    return new Typewriter(); // Return dummy, won't be used
  }

  instance = new Typewriter();
  instance.init();
  return instance;
}
