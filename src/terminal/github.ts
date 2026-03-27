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

  // Repo-relative directory where posts live. Empty means repo root.
  // Both reads and writes go through this.
  private postsPath: string;
  // Repo-relative directory where drafts live. Set via cms.content_drafts_path
  // in site.yml; fetch-content.sh expects the default.
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
    // Convert a Jekyll URL path to the file path in the content repo,
    // routing posts through postFilePath() and treating other URLs as
    // static pages.

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
      // Static page or any path with an explicit filename. Don't double-append
      // .md if the caller already gave us one (e.g. when the CMS opens a draft
      // path like /drafts/draft-foo.md).
      const cleanPath = urlPath.replace(/^\/|\/$/g, '');
      filePath = cleanPath.endsWith('.md') ? cleanPath : `${cleanPath}.md`;
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

        // Try the directory-index variant for static pages (e.g. /about/ →
        // about/index.md instead of about.md).
        if (!postMatch) {
          const cleanPath = urlPath.replace(/^\/|\/$/g, '');
          const altPath = cleanPath.endsWith('.md')
            ? cleanPath.replace(/\.md$/, '/index.md')
            : `${cleanPath}/index.md`;
          if (altPath !== filePath) {
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
    // Match the slug exactly. endsWith('-slug.md') is too loose: looking
    // for 'me' would happily delete 'about-me.md' (since '-about-me.md'
    // ends with '-me.md'). Anchor on the date prefix instead.
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRe = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escapedSlug}\\.md$`);
    const file = postFiles.find(f => exactRe.test(f.name)) as
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

    const files = await response.json() as { name: string; sha: string; path: string }[];
    // Match the slug exactly. Drafts may or may not carry a date prefix, so
    // accept both "<slug>.md" and "YYYY-MM-DD-<slug>.md" as exact matches.
    const exact = `${slug}.md`;
    const dated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.md$`);
    const draftFile = files.find(f => f.name === exact || dated.test(f.name));

    if (!draftFile) {
      throw new Error(`Draft not found: ${slug}`);
    }

    // Get draft content
    const draft = await this.getFile(draftFile.path);
    if (!draft) {
      throw new Error('Failed to read draft');
    }

    // Remove `draft: true` from frontmatter. Match common YAML variants
    // (true / "true" / True) but anchor at the start of a line so we
    // don't mangle anything in the body that happens to mention draft.
    const content = draft.content.replace(
      /^---([\s\S]*?)^draft:\s*["']?(?:true|True|TRUE)["']?\s*$\n?/m,
      '---$1'
    );

    // Always publish to a YYYY-MM-DD-<slug>.md filename. fetch-content.sh
    // copies posts to _posts/ using that exact pattern; an undated draft
    // filename (from `make draft`) would be silently dropped otherwise.
    // Prefer the date in frontmatter, fall back to today. Anchor `date:`
    // at line start so frontmatter keys like `published-date:` don't match.
    const dateMatch = content.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
    const datePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    const publishedName = dated.test(draftFile.name)
      ? draftFile.name
      : `${datePrefix}-${slug}.md`;
    const postPath = this.postFilePath(publishedName);
    await this.saveFile(postPath, content, `Publish: ${slug}`);

    // Delete draft. Validate the response — silently swallowing a failed
    // delete leaves the post duplicated in both posts and drafts.
    const deleteResponse = await this.fetch(
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

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json().catch(() => ({}));
      throw new Error(
        `Published ${publishedName} but failed to delete draft ${draftFile.path}: ${error.message || deleteResponse.status}`
      );
    }

    return true;
  }
}
