/**
 * GitHub API client for editing content
 * Lazy loaded on auth (Layer 3)
 */

import { SITE_CONFIG } from '../data/site-config';

interface GitHubFile {
  path: string;
  sha: string;
  content: string;
}

export class GitHubClient {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;

  private postsPath: string;

  constructor(token: string) {
    this.token = token;

    // Get repo info from site config or defaults
    const config = SITE_CONFIG as Record<string, unknown>;
    const contentRepo = (config.content_repo as string) || 'ellyseum-content';
    const repoOwner = (config.github_owner as string) || 'ellyseum';

    this.owner = repoOwner;
    this.repo = contentRepo;
    this.branch = 'main';
    // Where posts live in the content repo: '' for root, '_posts' for Jekyll default
    this.postsPath = (config.content_posts_path as string) || '';
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.github.com${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  }

  async validateToken(): Promise<boolean> {
    try {
      // Check token validity and repo access
      const response = await this.fetch(`/repos/${this.owner}/${this.repo}`);

      if (!response.ok) {
        console.error('GitHub API error:', response.status, await response.text());
        return false;
      }

      const data = await response.json();

      // Check if we have push access
      return data.permissions?.push === true;
    } catch (e) {
      console.error('Token validation failed:', e);
      return false;
    }
  }

  async getFileContent(urlPath: string): Promise<string | null> {
    // Convert URL path to file path
    // /2024/01/15/my-post/ -> _posts/2024-01-15-my-post.md
    // /about/ -> about/index.md

    let filePath: string;

    // Check if it's a post (has date pattern)
    const postMatch = urlPath.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)/);
    if (postMatch) {
      const [, year, month, day, slug] = postMatch;
      // Remove trailing slash from slug if present
      const cleanSlug = slug.replace(/\/$/, '');
      // Build path: postsPath + YYYY-MM-DD-slug.md
      const filename = `${year}-${month}-${day}-${cleanSlug}.md`;
      filePath = this.postsPath ? `${this.postsPath}/${filename}` : filename;
    } else if (urlPath === '/' || urlPath === '') {
      filePath = 'index.md';
    } else {
      // Static page
      const cleanPath = urlPath.replace(/^\/|\/$/g, '');
      filePath = `${cleanPath}.md`;
    }

    console.log(`[GitHub] Fetching: ${this.owner}/${this.repo}/${filePath}`);

    try {
      const response = await this.fetch(
        `/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${this.branch}`
      );

      console.log(`[GitHub] Response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GitHub] Error fetching ${filePath}:`, errorText);

        // Try without index.md for static pages
        if (!postMatch) {
          const altPath = urlPath.replace(/^\/|\/$/g, '') + '.md';
          console.log(`[GitHub] Trying alt path: ${altPath}`);
          const altResponse = await this.fetch(
            `/repos/${this.owner}/${this.repo}/contents/${altPath}?ref=${this.branch}`
          );

          if (!altResponse.ok) {
            return null;
          }

          const altData = await altResponse.json();
          return atob(altData.content.replace(/\n/g, ''));
        }
        return null;
      }

      const data = await response.json();
      return atob(data.content.replace(/\n/g, ''));
    } catch (e) {
      console.error('[GitHub] Failed to get file content:', e);
      return null;
    }
  }

  async getFile(filePath: string): Promise<GitHubFile | null> {
    try {
      const response = await this.fetch(
        `/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${this.branch}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        path: data.path,
        sha: data.sha,
        content: atob(data.content.replace(/\n/g, '')),
      };
    } catch {
      return null;
    }
  }

  async saveFile(
    filePath: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<boolean> {
    try {
      // Get current file SHA if not provided
      if (!sha) {
        const existing = await this.getFile(filePath);
        sha = existing?.sha;
      }

      const body: Record<string, unknown> = {
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: this.branch,
      };

      if (sha) {
        body.sha = sha;
      }

      const response = await this.fetch(
        `/repos/${this.owner}/${this.repo}/contents/${filePath}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save file');
      }

      return true;
    } catch (e) {
      console.error('Failed to save file:', e);
      throw e;
    }
  }

  async deletePost(slug: string): Promise<boolean> {
    // Find the post file
    const response = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/_posts?ref=${this.branch}`
    );

    if (!response.ok) {
      throw new Error('Failed to list posts');
    }

    const files = await response.json();
    const file = files.find((f: { name: string }) => f.name.includes(slug));

    if (!file) {
      throw new Error(`Post not found: ${slug}`);
    }

    const deleteResponse = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${file.path}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message: `Delete post: ${slug}`,
          sha: file.sha,
          branch: this.branch,
        }),
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      throw new Error(error.message || 'Failed to delete post');
    }

    return true;
  }

  async publishDraft(slug: string): Promise<boolean> {
    // Get the draft file
    const draftPath = `_drafts`;
    const response = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${draftPath}?ref=${this.branch}`
    );

    if (!response.ok) {
      throw new Error('Failed to list drafts');
    }

    const files = await response.json();
    const draftFile = files.find((f: { name: string }) => f.name.includes(slug));

    if (!draftFile) {
      throw new Error(`Draft not found: ${slug}`);
    }

    // Get draft content
    const draft = await this.getFile(draftFile.path);
    if (!draft) {
      throw new Error('Failed to read draft');
    }

    // Remove draft: true from frontmatter
    const content = draft.content.replace(/^(---[\s\S]*?)draft:\s*true\n?([\s\S]*?---)/, '$1$2');

    // Create in _posts
    const postPath = `_posts/${draftFile.name}`;
    await this.saveFile(postPath, content, `Publish: ${slug}`);

    // Delete draft
    await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${draftFile.path}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message: `Publish draft: ${slug}`,
          sha: draftFile.sha,
          branch: this.branch,
        }),
      }
    );

    return true;
  }
}
