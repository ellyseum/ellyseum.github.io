interface PostData {
  title: string;
  subtitle: string;
  url: string;
  date: string;
  dateFormatted: string;
  excerpt: string;
  tags: string[];
}

export class SearchFilter {
  private posts: PostData[] = [];
  private filtered: PostData[] = [];
  private page = 1;
  private pageSize = 5;
  private filters = { tags: new Set<string>(), query: '', dateFrom: '', dateTo: '', dateExact: '' };

  private inputEl: HTMLInputElement | null = null;
  private filtersEl: HTMLElement | null = null;
  private resultsEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private paginationEl: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isTyping = false;

  init(): void {
    const dataEl = document.querySelector('.site-content #posts-data');
    if (!dataEl) return;

    try {
      this.posts = JSON.parse(dataEl.textContent || '[]');
    } catch {
      return;
    }

    this.inputEl = document.getElementById('search-input') as HTMLInputElement;
    this.filtersEl = document.getElementById('search-filters');
    this.resultsEl = document.getElementById('search-results');
    this.countEl = document.getElementById('search-count');
    this.paginationEl = document.getElementById('search-pagination');

    if (!this.inputEl || !this.resultsEl) return;

    // Parse URL params
    const params = new URLSearchParams(location.search);
    const tags = params.get('tags');
    const q = params.get('q');
    const date = params.get('date');

    if (tags) {
      tags.split(',').forEach(t => this.filters.tags.add(t.trim()));
    }
    if (q) this.filters.query = q;
    if (date) this.filters.dateExact = date;

    // Build input display from parsed filters
    this.syncInputFromFilters();

    this.inputEl.addEventListener('input', () => {
      // Update chips immediately (no debounce), skip animations while typing
      this.isTyping = true;
      this.parseInputToFilters();
      this.renderFilters();
      this.renderCount();

      // Debounce the card search
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.isTyping = false;
        this.renderSearchResults();
      }, 400);
    });

    this.render();
  }

  private syncInputFromFilters(): void {
    if (!this.inputEl) return;
    const parts: string[] = [];
    this.filters.tags.forEach(t => parts.push(`tag:${t}`));
    if (this.filters.dateExact) parts.push(`date:${this.filters.dateExact}`);
    if (this.filters.dateFrom) parts.push(`from:${this.filters.dateFrom}`);
    if (this.filters.dateTo) parts.push(`to:${this.filters.dateTo}`);
    if (this.filters.query) parts.push(this.filters.query);
    this.inputEl.value = parts.join(' ');
  }

  private parseInputToFilters(): void {
    if (!this.inputEl) return;
    const raw = this.inputEl.value;

    // Reset filters
    this.filters.tags.clear();
    this.filters.query = '';
    this.filters.dateExact = '';
    this.filters.dateFrom = '';
    this.filters.dateTo = '';

    // Parse smart syntax
    const remaining: string[] = [];
    raw.split(/\s+/).forEach(token => {
      if (!token) return;
      const lower = token.toLowerCase();
      if (lower.startsWith('tag:')) {
        this.filters.tags.add(token.slice(4));
      } else if (lower.startsWith('date:')) {
        this.filters.dateExact = this.normalizeDate(token.slice(5));
      } else if (lower.startsWith('from:')) {
        this.filters.dateFrom = this.normalizeDate(token.slice(5));
      } else if (lower.startsWith('to:')) {
        this.filters.dateTo = this.normalizeDate(token.slice(3));
      } else {
        remaining.push(token);
      }
    });
    this.filters.query = remaining.join(' ');
  }

  // Convert various date formats to ISO (YYYY-MM-DD) for comparison
  // Supports: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
  // Partial dates: YYYY, YYYY-MM, MM/YYYY, DD/MM, etc.
  // Ambiguous dates (like 1/1) default to DD/MM
  // Incomplete parts shown as ?? for display
  private normalizeDate(input: string): string {
    if (!input) return '';

    const currentYear = new Date().getFullYear();
    const parts = input.split(/[\/\-]/).filter(p => p !== '');

    // Helper to format number or return ?? if invalid
    const fmt = (n: number, pad = 2) => isNaN(n) ? '??' : String(n).padStart(pad, '0');

    // Single number - could be year or nothing useful
    if (parts.length === 1) {
      const n = parseInt(parts[0], 10);
      if (n >= 1000 && n <= 9999) return String(n); // Year
      return input; // Unknown, return as-is
    }

    // Two parts: could be YYYY-MM, MM-YYYY, DD/MM, MM/DD
    if (parts.length === 2) {
      const [a, b] = parts.map(p => parseInt(p, 10));

      // Check for NaN - incomplete input
      if (isNaN(a) || isNaN(b)) {
        // Return partial display
        return `${fmt(a)}-${fmt(b)}`;
      }

      // YYYY-MM (first is 4 digits)
      if (parts[0].length === 4 && a >= 1000) {
        return `${a}-${fmt(b)}`;
      }

      // MM-YYYY or DD-YYYY (second is 4 digits)
      if (parts[1].length === 4 && b >= 1000) {
        // Treat first as month
        return `${b}-${fmt(a)}`;
      }

      // MM/DD (no year) - default ambiguous to month/day (US format), use current year
      // If first > 12, it must be day; if second > 12, first must be month
      let day: number, month: number;
      if (a > 12) {
        day = a; month = b;
      } else if (b > 12) {
        day = b; month = a;
      } else {
        // Ambiguous - default to MM/DD (US format)
        month = a; day = b;
      }
      return `${currentYear}-${fmt(month)}-${fmt(day)}`;
    }

    // Three parts: full date
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p, 10));

      // Check for NaN - incomplete input
      if (isNaN(a) || isNaN(b) || isNaN(c)) {
        return `${fmt(a)}-${fmt(b)}-${fmt(c)}`;
      }

      // YYYY-MM-DD (first is 4 digits)
      if (parts[0].length === 4 && a >= 1000) {
        return `${a}-${fmt(b)}-${fmt(c)}`;
      }

      // DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY, or MM/DD/YY (last is year)
      // 4-digit year or 2-digit year (assume 2000s)
      if (parts[2].length === 4 || parts[2].length <= 2) {
        let year = c;
        if (parts[2].length <= 2) {
          year = 2000 + c; // 26 -> 2026
        }

        let day: number, month: number;
        // If first > 12, it must be day
        if (a > 12) {
          day = a; month = b;
        } else if (b > 12) {
          // Second > 12, so first is month, second is day
          day = b; month = a;
        } else {
          // Ambiguous - default to MM/DD/YYYY (US format)
          month = a; day = b;
        }
        return `${year}-${fmt(month)}-${fmt(day)}`;
      }
    }

    // Unknown format, return as-is
    return input;
  }

  private async renderSearchResults(): Promise<void> {
    this.applyFilters();
    this.page = 1;

    if (this.resultsEl && this.resultsEl.children.length > 0) {
      await this.animateCardsOut();
    }

    this.renderCards();
    this.renderPagination();
    this.updateURL();

    await this.animateCardsIn();
  }

  toggleTag(tag: string): void {
    if (this.filters.tags.has(tag)) {
      this.filters.tags.delete(tag);
    } else {
      this.filters.tags.add(tag);
    }
    this.syncInputFromFilters();
    this.page = 1;
    this.render();
  }

  removeTag(tag: string): void {
    this.filters.tags.delete(tag);
    this.syncInputFromFilters();
    this.page = 1;
    this.render();
  }

  clearAll(): void {
    this.filters.tags.clear();
    this.filters.query = '';
    this.filters.dateExact = '';
    this.filters.dateFrom = '';
    this.filters.dateTo = '';
    if (this.inputEl) this.inputEl.value = '';
    this.page = 1;
    this.render();
  }

  private handleDateChipClick(e: MouseEvent, chip: HTMLElement, dateType: 'exact' | 'from' | 'to'): void {
    // If clicked on the X, remove the filter
    const target = e.target as HTMLElement;
    if (target.classList.contains('filter-chip-x')) {
      if (dateType === 'exact') this.filters.dateExact = '';
      else if (dateType === 'from') this.filters.dateFrom = '';
      else if (dateType === 'to') this.filters.dateTo = '';
      this.syncInputFromFilters();
      this.page = 1;
      this.render();
      return;
    }

    // Otherwise, open date picker
    const picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'date-chip-picker';

    // Position picker at the chip - make it tiny but visible so browser anchors picker to it
    const rect = chip.getBoundingClientRect();
    picker.style.cssText = `
      position: fixed;
      top: ${rect.bottom}px;
      left: ${rect.left}px;
      width: 1px;
      height: 1px;
      padding: 0;
      border: 0;
      opacity: 0.01;
      z-index: 9999;
    `;

    // Set current value if it's a valid ISO date
    const currentValue = dateType === 'exact' ? this.filters.dateExact
      : dateType === 'from' ? this.filters.dateFrom
      : this.filters.dateTo;
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
      picker.value = currentValue;
    }

    document.body.appendChild(picker);

    const cleanup = () => {
      picker.remove();
    };

    picker.addEventListener('change', () => {
      if (picker.value) {
        if (dateType === 'exact') this.filters.dateExact = picker.value;
        else if (dateType === 'from') this.filters.dateFrom = picker.value;
        else if (dateType === 'to') this.filters.dateTo = picker.value;
        this.syncInputFromFilters();
        this.page = 1;
        this.render();
      }
      cleanup();
    });

    picker.addEventListener('blur', () => {
      setTimeout(cleanup, 150);
    });

    // Focus first, then show picker
    picker.focus();
    picker.showPicker();
  }

  setPage(n: number): void {
    const maxPage = Math.ceil(this.filtered.length / this.pageSize) || 1;
    this.page = Math.max(1, Math.min(n, maxPage));
    this.renderWithPageTransition();
  }

  setPageSize(n: number): void {
    this.pageSize = n;
    this.page = 1;
    this.render();
  }

  private applyFilters(): void {
    this.filtered = this.posts.filter(post => {
      // Tag filter (OR)
      if (this.filters.tags.size > 0) {
        const hasTag = [...this.filters.tags].some(t =>
          post.tags.some(pt => pt.toLowerCase() === t.toLowerCase())
        );
        if (!hasTag) return false;
      }

      // Date exact
      if (this.filters.dateExact) {
        const postDate = post.date.slice(0, 10);
        if (!postDate.startsWith(this.filters.dateExact)) return false;
      }

      // Date range
      if (this.filters.dateFrom) {
        const postDate = post.date.slice(0, 10);
        if (postDate < this.filters.dateFrom) return false;
      }
      if (this.filters.dateTo) {
        const postDate = post.date.slice(0, 10);
        if (postDate > this.filters.dateTo) return false;
      }

      // Text query (title + excerpt)
      if (this.filters.query) {
        const q = this.filters.query.toLowerCase();
        const haystack = (post.title + ' ' + post.subtitle + ' ' + post.excerpt).toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }

  private async render(): Promise<void> {
    this.applyFilters();

    // Update filters and count immediately (no delay)
    this.renderFilters();
    this.renderCount();
    this.updateURL();

    // Animate cards out
    if (this.resultsEl && this.resultsEl.children.length > 0) {
      await this.animateCardsOut();
    }

    this.renderCards();
    this.renderPagination();

    // Animate cards in
    await this.animateCardsIn();
  }

  private async renderWithPageTransition(): Promise<void> {
    this.applyFilters();

    if (this.resultsEl && this.resultsEl.children.length > 0) {
      await this.animateCardsOut();
    }

    this.renderCards();
    this.renderPagination();
    this.updateURL();

    // Smooth scroll to top of results
    this.resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    await this.animateCardsIn();
  }

  private renderFilters(): void {
    if (!this.filtersEl) return;

    const hasFilters = this.filters.tags.size > 0 || this.filters.dateExact || this.filters.dateFrom || this.filters.dateTo;

    // Build list of desired chips with stable IDs (type-based, not content-based)
    const desiredChips: { id: string; type: string; value: string }[] = [];
    let tagIndex = 0;
    this.filters.tags.forEach(tag => {
      desiredChips.push({ id: `tag-${tagIndex++}`, type: 'tag', value: tag });
    });
    if (this.filters.dateExact) desiredChips.push({ id: 'date-exact', type: 'date-exact', value: this.filters.dateExact });
    if (this.filters.dateFrom) desiredChips.push({ id: 'date-from', type: 'date-from', value: this.filters.dateFrom });
    if (this.filters.dateTo) desiredChips.push({ id: 'date-to', type: 'date-to', value: this.filters.dateTo });

    // Get current chips from DOM, indexed by their data-chip-id
    const currentChipsMap = new Map<string, HTMLElement>();
    this.filtersEl.querySelectorAll('.filter-chip:not(.filter-chip-clear)').forEach(chip => {
      const el = chip as HTMLElement;
      if (el.dataset.chipId) {
        currentChipsMap.set(el.dataset.chipId, el);
      }
    });

    // Reset transforms from previous FLIP animations
    const clearBtnExisting = this.filtersEl.querySelector('.filter-chip-clear') as HTMLElement | null;
    this.filtersEl.querySelectorAll('.filter-chip').forEach(chip => {
      (chip as HTMLElement).style.transform = '';
    });

    // Determine which chips to remove, update, or create
    const desiredIds = new Set(desiredChips.map(c => c.id));
    const chipsToRemove: HTMLElement[] = [];
    currentChipsMap.forEach((chip, id) => {
      if (!desiredIds.has(id)) {
        chipsToRemove.push(chip);
      }
    });

    // FLIP: Record all positions before changes
    const positionsBefore = new Map<HTMLElement, { left: number; width: number }>();
    currentChipsMap.forEach(chip => {
      const rect = chip.getBoundingClientRect();
      positionsBefore.set(chip, { left: rect.left, width: rect.width });
    });
    if (clearBtnExisting && hasFilters) {
      const rect = clearBtnExisting.getBoundingClientRect();
      positionsBefore.set(clearBtnExisting, { left: rect.left, width: rect.width });
    }

    // Remove chips that are no longer needed
    chipsToRemove.forEach(el => el.remove());

    // Remove clear button if no filters
    if (!hasFilters) {
      this.filtersEl.querySelector('.filter-chip-clear')?.remove();
      return;
    }

    // Get or create clear button
    let clearBtn = this.filtersEl.querySelector('.filter-chip-clear') as HTMLElement | null;
    const hadNoChips = currentChipsMap.size === 0;

    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.className = 'filter-chip filter-chip-clear';
      clearBtn.dataset.clearAll = '';
      clearBtn.textContent = 'Clear all';
      clearBtn.addEventListener('click', () => this.clearAll());
      if (hadNoChips && !this.isTyping) {
        clearBtn.style.opacity = '0';
        clearBtn.style.transform = 'scale(0.8)';
      }
      this.filtersEl.appendChild(clearBtn);
      if (hadNoChips && !this.isTyping) {
        requestAnimationFrame(() => {
          clearBtn!.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          clearBtn!.style.opacity = '1';
          clearBtn!.style.transform = 'scale(1)';
        });
      }
    }

    // Update or create chips
    const newChips: HTMLElement[] = [];
    desiredChips.forEach(({ id, type, value }) => {
      let chip = currentChipsMap.get(id);

      if (chip) {
        // Update existing chip's value
        const oldValue = chip.dataset.chipValue;
        if (oldValue !== value) {
          chip.dataset.chipValue = value;
          if (type === 'tag') {
            chip.dataset.removeTag = value;
            chip.innerHTML = `${value} <span class="filter-chip-x">&times;</span>`;
          } else if (type === 'date-exact') {
            chip.innerHTML = `${value} <span class="filter-chip-x">&times;</span>`;
          } else if (type === 'date-from') {
            chip.innerHTML = `from: ${value} <span class="filter-chip-x">&times;</span>`;
          } else if (type === 'date-to') {
            chip.innerHTML = `to: ${value} <span class="filter-chip-x">&times;</span>`;
          }
        }
      } else {
        // Create new chip
        chip = document.createElement('button');
        chip.className = 'filter-chip';
        chip.dataset.chipId = id;
        chip.dataset.chipValue = value;

        if (type === 'tag') {
          chip.dataset.removeTag = value;
          chip.innerHTML = `${value} <span class="filter-chip-x">&times;</span>`;
          chip.addEventListener('click', () => this.removeTag(chip!.dataset.removeTag!));
        } else if (type === 'date-exact') {
          chip.dataset.removeDate = 'exact';
          chip.innerHTML = `${value} <span class="filter-chip-x">&times;</span>`;
          chip.addEventListener('click', (e) => this.handleDateChipClick(e, chip!, 'exact'));
        } else if (type === 'date-from') {
          chip.dataset.removeDate = 'from';
          chip.innerHTML = `from: ${value} <span class="filter-chip-x">&times;</span>`;
          chip.addEventListener('click', (e) => this.handleDateChipClick(e, chip!, 'from'));
        } else if (type === 'date-to') {
          chip.dataset.removeDate = 'to';
          chip.innerHTML = `to: ${value} <span class="filter-chip-x">&times;</span>`;
          chip.addEventListener('click', (e) => this.handleDateChipClick(e, chip!, 'to'));
        }

        if (!this.isTyping) {
          chip.style.opacity = '0';
          chip.style.transform = 'scale(0.8)';
        }
        this.filtersEl!.insertBefore(chip, clearBtn);
        newChips.push(chip);
      }
    });

    // FLIP: Animate position and width changes
    const allChips = Array.from(this.filtersEl.querySelectorAll('.filter-chip:not(.filter-chip-clear)')) as HTMLElement[];
    const allToAnimate = hasFilters ? [...allChips, clearBtn!] : allChips;

    allToAnimate.forEach(chip => {
      const before = positionsBefore.get(chip);
      const after = chip.getBoundingClientRect();

      if (before) {
        const deltaX = before.left - after.left;
        const scaleX = before.width / after.width;

        if (deltaX !== 0 || (scaleX !== 1 && !isNaN(scaleX) && isFinite(scaleX))) {
          chip.style.transition = 'none';
          if (deltaX !== 0) {
            chip.style.transform = `translateX(${deltaX}px)`;
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              chip.style.transition = 'transform 0.15s ease';
              chip.style.transform = 'translateX(0)';
            });
          });
        }
      }
    });

    // Animate new chips in (skip fade if typing)
    if (!this.isTyping && newChips.length > 0) {
      requestAnimationFrame(() => {
        newChips.forEach(chip => {
          chip.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          chip.style.opacity = '1';
          chip.style.transform = 'scale(1)';
        });
      });
    }

    // FLIP: Animate chips sliding when removing (skip if typing)
    if (chipsToRemove.length > 0 && !this.isTyping) {
      allToAnimate.forEach(chip => {
        if (newChips.includes(chip)) return; // Skip new chips, already animating
        const before = positionsBefore.get(chip);
        if (!before) return;
        const after = chip.getBoundingClientRect();
        const deltaX = before.left - after.left;
        if (deltaX !== 0) {
          chip.style.transition = 'none';
          chip.style.transform = `translateX(${deltaX}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              chip.style.transition = 'transform 0.25s ease';
              chip.style.transform = 'translateX(0)';
            });
          });
        }
      });
    }
  }

  private renderCount(): void {
    if (!this.countEl) return;
    const count = this.filtered.length;
    this.countEl.textContent = `${count} post${count !== 1 ? 's' : ''} found`;
    this.countEl.classList.toggle('search-count-empty', count === 0);
  }

  private renderCards(): void {
    if (!this.resultsEl) return;

    const start = (this.page - 1) * this.pageSize;
    const pageItems = this.pageSize === 0 ? this.filtered : this.filtered.slice(start, start + this.pageSize);

    if (pageItems.length === 0) {
      this.resultsEl.innerHTML = '<div class="search-empty">No posts found</div>';
      return;
    }

    this.resultsEl.innerHTML = pageItems.map(post => {
      const tagsHtml = post.tags.map(t =>
        `<a href="/search/?tags=${encodeURIComponent(t)}" class="tag search-tag" data-tag="${t}">${t}</a>`
      ).join('');

      const dateISO = post.date.slice(0, 10);

      return `<article class="post-item js-animated" style="opacity: 0; transform: translateY(20px);">
        <h3><a href="${post.url}">${post.title}${post.subtitle ? ` <span class="post-item-subtitle">${post.subtitle}</span>` : ''}</a></h3>
        <a href="/search/?date=${dateISO}" class="post-date-link" data-search-date="${dateISO}"><time datetime="${post.date}">${post.dateFormatted}</time></a>
        ${post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : ''}
        ${tagsHtml ? `<div class="post-item-tags">${tagsHtml}</div>` : ''}
      </article>`;
    }).join('');

    // Bind tag clicks (prevent nav, toggle filter)
    this.resultsEl.querySelectorAll('.search-tag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleTag((el as HTMLElement).dataset.tag!);
      });
    });

    // Bind date clicks - first click sets from:, second click sets to:
    this.resultsEl.querySelectorAll('[data-search-date]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clickedDate = (el as HTMLElement).dataset.searchDate!;

        // Clear dateExact if it was set (legacy behavior)
        if (this.filters.dateExact) {
          this.filters.dateExact = '';
        }

        if (!this.filters.dateFrom) {
          // No from: yet, set it
          this.filters.dateFrom = clickedDate;
        } else if (!this.filters.dateTo) {
          // from: exists, no to: yet
          // If clicked date is before from:, swap them
          if (clickedDate < this.filters.dateFrom) {
            this.filters.dateTo = this.filters.dateFrom;
            this.filters.dateFrom = clickedDate;
          } else {
            this.filters.dateTo = clickedDate;
          }
        } else {
          // Both exist, start fresh with new from:
          this.filters.dateFrom = clickedDate;
          this.filters.dateTo = '';
        }

        this.syncInputFromFilters();
        this.page = 1;
        this.render();
      });
    });
  }

  private renderPagination(): void {
    if (!this.paginationEl) return;

    const total = this.filtered.length;
    const maxPage = this.pageSize === 0 ? 1 : Math.ceil(total / this.pageSize) || 1;

    const pageSizeHtml = this.renderPageSizeSelector();

    if (maxPage <= 1 && this.pageSize !== 0) {
      if (!pageSizeHtml) {
        this.paginationEl.innerHTML = '';
        return;
      }
      this.paginationEl.innerHTML = pageSizeHtml;
      this.bindPageSizeEvents();
      return;
    }

    let pagesHtml = '';
    if (this.pageSize > 0) {
      pagesHtml += `<button class="page-btn page-prev" ${this.page <= 1 ? 'disabled' : ''} data-page="${this.page - 1}">&laquo;</button>`;

      for (let i = 1; i <= maxPage; i++) {
        pagesHtml += `<button class="page-num ${i === this.page ? 'page-num--active' : ''}" data-page="${i}">${i}</button>`;
      }

      pagesHtml += `<button class="page-btn page-next" ${this.page >= maxPage ? 'disabled' : ''} data-page="${this.page + 1}">&raquo;</button>`;
    }

    this.paginationEl.innerHTML = `
      <div class="pagination-pages">${pagesHtml}</div>
      ${pageSizeHtml}
    `;

    // Bind page clicks
    this.paginationEl.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt((btn as HTMLElement).dataset.page!, 10);
        if (!isNaN(p)) this.setPage(p);
      });
    });

    this.bindPageSizeEvents();
  }

  private renderPageSizeSelector(): string {
    const total = this.filtered.length;
    // Only show size options that would actually paginate (total > size), plus "All"
    const allSizes = [5, 10, 15];
    const sizes: number[] = allSizes.filter(s => total > s);
    // Add "All" (0) if there are any size options (meaning some would paginate)
    if (sizes.length > 0) sizes.push(0);

    if (sizes.length === 0) return '';

    return `<div class="page-size-selector">Show: ${sizes.map(s =>
      `<button class="page-size-option ${(s === this.pageSize || (s === 0 && this.pageSize === 0)) ? 'page-size-active' : ''}" data-size="${s}">${s === 0 ? 'All' : s}</button>`
    ).join('<span class="page-size-dot">&middot;</span>')}</div>`;
  }

  private bindPageSizeEvents(): void {
    this.paginationEl?.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = parseInt((btn as HTMLElement).dataset.size!, 10);
        this.setPageSize(s);
      });
    });
  }

  private updateURL(): void {
    const params = new URLSearchParams();
    if (this.filters.tags.size > 0) params.set('tags', [...this.filters.tags].join(','));
    if (this.filters.query) params.set('q', this.filters.query);
    if (this.filters.dateExact) params.set('date', this.filters.dateExact);
    if (this.filters.dateFrom) params.set('from', this.filters.dateFrom);
    if (this.filters.dateTo) params.set('to', this.filters.dateTo);

    const search = params.toString();
    const url = '/search/' + (search ? '?' + search : '');
    history.replaceState({}, '', url);
  }

  private animateCardsOut(): Promise<void> {
    if (!this.resultsEl) return Promise.resolve();
    const cards = this.resultsEl.querySelectorAll('.post-item');
    if (cards.length === 0) return Promise.resolve();

    return new Promise(resolve => {
      cards.forEach(card => {
        const el = card as HTMLElement;
        el.style.transition = 'opacity 150ms ease, transform 150ms ease';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px)';
      });
      setTimeout(resolve, 160);
    });
  }

  private async animateCardsIn(): Promise<void> {
    if (!this.resultsEl) return;
    const cards = this.resultsEl.querySelectorAll('.post-item');
    if (cards.length === 0) return;

    // Set initial state
    cards.forEach(card => {
      const el = card as HTMLElement;
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'none';
    });

    // Force reflow
    this.resultsEl.offsetHeight;

    // Stagger in
    cards.forEach((card, i) => {
      const el = card as HTMLElement;
      setTimeout(() => {
        el.style.transition = 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 50);
    });

    // Wait for last card to finish
    await new Promise(r => setTimeout(r, cards.length * 50 + 400));

    // Clean up inline styles
    cards.forEach(card => {
      const el = card as HTMLElement;
      el.style.transition = '';
      el.style.opacity = '';
      el.style.transform = '';
    });
  }
}
