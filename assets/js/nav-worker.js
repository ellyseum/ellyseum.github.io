/**
 * Navigation Web Worker
 * Handles fetching and text processing off the main thread
 * Note: Workers don't have DOMParser, so we use regex-based extraction
 */

self.onmessage = async (e) => {
  const { type, url } = e.data;

  if (type === 'parse') {
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

      self.postMessage({
        type: 'parsed',
        url,
        title,
        mainContent,
        processedContent,
        timestamp: Date.now()
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        url,
        error: error.message
      });
    }
  }
};

/**
 * Pre-wrap words in spans so main thread doesn't have to
 */
function preprocessWordsForAnimation(html) {
  // Process text within p, h2, h3, li, blockquote tags
  // Skip pre/code blocks

  const tagPattern = /(<(p|h2|h3|li|blockquote)[^>]*>)([\s\S]*?)(<\/\2>)/gi;

  return html.replace(tagPattern, (match, openTag, tagName, content, closeTag) => {
    // Don't process if it contains code/pre
    if (content.includes('<code') || content.includes('<pre')) {
      return match;
    }

    // Wrap words, but preserve HTML tags
    const processed = content.replace(/(\S+)/g, (word) => {
      // Skip if it looks like an HTML tag
      if (word.startsWith('<') || word.endsWith('>') || word.includes('</') || word.includes('="')) {
        return word;
      }
      // Skip if it's part of an attribute
      if (/^[a-z]+=/.test(word) || /^["']/.test(word)) {
        return word;
      }
      return `<span class="flying-word">${word}</span>`;
    });

    return openTag + processed + closeTag;
  });
}
