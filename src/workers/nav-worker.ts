/**
 * Navigation Web Worker
 * Handles fetching and text processing off the main thread
 * Note: Workers don't have DOMParser, so we use regex-based extraction
 * Supports batch prefetching for mobile (all URLs in one message)
 */

interface ParseMessage {
  type: 'parse';
  url: string;
  originalHref?: string;
}

interface BatchParseMessage {
  type: 'parseBatch';
  urls: string[];
}

interface ParsedResponse {
  type: 'parsed';
  url: string;
  originalHref: string;
  title: string;
  mainContent: string;
  processedContent: string;
  timestamp: number;
}

interface ErrorResponse {
  type: 'error';
  url: string;
  error: string;
}

type WorkerMessage = ParseMessage | BatchParseMessage;

async function parseUrl(url: string, originalHref?: string): Promise<void> {
  try {
    const response = await fetch(url);
    const html = await response.text();

    // Extract title using regex (no DOM in workers)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract main content using regex
    const mainMatch = html.match(/<main[^>]*class="site-content"[^>]*>([\s\S]*?)<\/main>/i);
    const mainContent = mainMatch ? mainMatch[1].trim() : '';

    // Pre-process: wrap words in spans for animation
    const processedContent = preprocessWordsForAnimation(mainContent);

    const response_data: ParsedResponse = {
      type: 'parsed',
      url,
      originalHref: originalHref || url,
      title,
      mainContent,
      processedContent,
      timestamp: Date.now()
    };

    self.postMessage(response_data);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: 'error',
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    self.postMessage(errorResponse);
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'parse') {
    const { url, originalHref } = e.data as ParseMessage;
    await parseUrl(url, originalHref);
  } else if (type === 'parseBatch') {
    const { urls } = e.data as BatchParseMessage;
    // Fetch all URLs in parallel - HTTP/2 will multiplex over one connection
    await Promise.all(urls.map(url => parseUrl(url, url)));
  }
};

/**
 * Pre-wrap words in spans so main thread doesn't have to
 */
function preprocessWordsForAnimation(html: string): string {
  // Process text within p, h2, h3, li, blockquote tags
  // Skip pre/code blocks
  const tagPattern = /(<(p|h2|h3|li|blockquote)[^>]*>)([\s\S]*?)(<\/\2>)/gi;

  return html.replace(tagPattern, (match, openTag, _tagName, content, closeTag) => {
    // Don't process if content contains any inner HTML tags
    // Regex word-splitting can't safely handle tag attributes
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return match;
    }

    // Safe to split: plain text only
    const processed = content.replace(/(\S+)/g, (word: string) => {
      return `<span class="flying-word">${word}</span>`;
    });

    return openTag + processed + closeTag;
  });
}
