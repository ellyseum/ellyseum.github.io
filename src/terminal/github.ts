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

  // Where posts live in the target repo: '' for repo root, or e.g. '_posts'
  // for the Jekyll default. Both reads and writes go through this.
  private postsPath: string;
  // Where drafts live. Defaults to 'drafts' (the layout fetch-content.sh
  // expects). Set 'cms.content_drafts_path' in site.yml to override.
  private draftsPath: string;

  constructor(token: string) {
    this.token = token;

    const config = SITE_CONFIG as Record<string, unknown>;

    // Fall back to site.repository ("owner/repo") when explicit cms.*
    // overrides aren't set. This makes the CMS commit to the same repo
    // the site was generated from by default.
    const repoString = (config.repository as string) || '';
    const slashIdx = repoString.indexOf('/');
    const defaultOwner = slashIdx >= 0 ? repoString.slice(0, slashIdx) : '';
    const defaultRepo = slashIdx >= 0 ? repoString.slice(slashIdx + 1) : '';

    this.owner = (config.github_owner as string) || defaultOwner;
    this.repo = (config.content_repo as string) || defaultRepo;
    this.branch = 'main';
    this.postsPath = (config.content_posts_path as string) || '';
    this.draftsPath = (config.content_drafts_path as string) || 'drafts';
  }

  // Compose a content-repo-relative path for a post/draft filename. Public
  // so plugins can build the same paths the client uses for read/write.
  postFilePath(filename: string): string {
    return this.postsPath ? `${this.postsPath}/${filename}` : filename;
  }

  draftFilePath(filename: string): string {
    return this.draftsPath ? `${this.draftsPath}/${filename}` : filename;
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
        // 401/403 are expected for expired/revoked tokens - don't spam console
        return false;
      }

      const data = await response.json();

      // Check if we have push access
      return data.permissions?.push === true;
    } catch {
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
      const filename = `${year}-${month}-${day}-${cleanSlug}.md`;
      filePath = this.postFilePath(filename);
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
    // List posts at the configured path. Empty postsPath means repo root.
    const listPath = this.postsPath || '';
    const response = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${listPath}?ref=${this.branch}`
    );

    if (!response.ok) {
      throw new Error('Failed to list posts');
    }

    const allFiles = await response.json();
    // At repo root the listing includes everything; narrow to YYYY-MM-DD-*.md
    // before matching the slug so we don't accidentally delete README.md etc.
    const postFiles = (allFiles as { name: string }[]).filter(f =>
      /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f.name)
    );
    const file = postFiles.find(f => f.name.includes(slug)) as
      | { name: string; path: string; sha: string }
      | undefined;

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

  async deleteFile(filePath: string, message: string): Promise<boolean> {
    const file = await this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const response = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${filePath}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message,
          sha: file.sha,
          branch: this.branch,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete file');
    }

    return true;
  }

  async publishDraft(slug: string): Promise<boolean> {
    // List drafts at the configured drafts path
    const response = await this.fetch(
      `/repos/${this.owner}/${this.repo}/contents/${this.draftsPath}?ref=${this.branch}`
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

    // Create at the configured posts path
    const postPath = this.postFilePath(draftFile.name);
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
