/**
 * Unit tests for GitHubClient (src/terminal/github.ts) — the in-browser
 * CMS API client. We mock SITE_CONFIG via vi.mock and stub global fetch
 * to verify the path/slug logic without hitting the real API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// SITE_CONFIG is normally generated at build time and gitignored. Mock it
// per-test so we can vary the cms.* knobs.
vi.mock('@/data/site-config', () => ({
  SITE_CONFIG: {
    author: '',
    email: '',
    github: '',
    linkedin: '',
    domain: '',
    portfolio: '',
    repository: 'alice/blog',
    content_repo: '',
    github_owner: '',
    content_posts_path: '',
    content_drafts_path: '',
  },
}));

import { GitHubClient } from '@/terminal/github';

type FetchMock = ReturnType<typeof vi.fn>;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('GitHubClient', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('path helpers', () => {
    it('postFilePath returns bare filename when postsPath is empty', () => {
      const client = new GitHubClient('tok');
      expect(client.postFilePath('2024-01-15-foo.md')).toBe('2024-01-15-foo.md');
    });

    it('draftFilePath defaults to drafts/ when no path is configured', () => {
      const client = new GitHubClient('tok');
      expect(client.draftFilePath('foo.md')).toBe('drafts/foo.md');
    });
  });

  describe('owner/repo defaults', () => {
    it('falls back to site.repository when cms.* are blank', () => {
      const client = new GitHubClient('tok') as unknown as { owner: string; repo: string };
      expect(client.owner).toBe('alice');
      expect(client.repo).toBe('blog');
    });
  });

  describe('getFileContent', () => {
    it('does not double-append .md when the URL path already has the extension', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({
        content: btoa('hello'),
      }));

      const client = new GitHubClient('tok');
      const result = await client.getFileContent('/drafts/draft-foo.md');

      expect(result).toBe('hello');
      // Path passed to the API should be drafts/draft-foo.md, NOT drafts/draft-foo.md.md
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('contents/drafts/draft-foo.md?');
      expect(url).not.toContain('.md.md');
    });

    it('routes Jekyll URL paths through the configured posts path', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ content: btoa('post body') }));

      const client = new GitHubClient('tok');
      await client.getFileContent('/2024/01/15/my-post/');

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('contents/2024-01-15-my-post.md?');
    });
  });

  describe('deletePost', () => {
    it('matches the slug exactly, not by substring', async () => {
      // Listing returns two posts whose names share a suffix
      fetchMock
        .mockResolvedValueOnce(mockJsonResponse([
          { name: '2024-01-01-about-me.md', path: '2024-01-01-about-me.md', sha: 'sha-about' },
          { name: '2024-01-02-me.md', path: '2024-01-02-me.md', sha: 'sha-me' },
        ]))
        .mockResolvedValueOnce(mockJsonResponse({}));

      const client = new GitHubClient('tok');
      await client.deletePost('me');

      // Second call is the DELETE
      const deleteCall = fetchMock.mock.calls[1];
      const deleteUrl = deleteCall[0] as string;
      const deleteOpts = deleteCall[1] as RequestInit;

      // Should target 2024-01-02-me.md, NOT 2024-01-01-about-me.md
      expect(deleteUrl).toContain('contents/2024-01-02-me.md');
      expect(deleteUrl).not.toContain('about-me');
      expect(deleteOpts.method).toBe('DELETE');
    });

    it('throws when no post matches the slug exactly', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse([
        { name: '2024-01-01-about-me.md', path: '2024-01-01-about-me.md', sha: 'sha' },
      ]));

      const client = new GitHubClient('tok');
      await expect(client.deletePost('me')).rejects.toThrow(/post not found/i);
    });

    it('skips non-post markdown files in the listing (e.g. README.md)', async () => {
      fetchMock
        .mockResolvedValueOnce(mockJsonResponse([
          { name: 'README.md', path: 'README.md', sha: 'sha-readme' },
          { name: '2024-01-15-target.md', path: '2024-01-15-target.md', sha: 'sha-target' },
        ]))
        .mockResolvedValueOnce(mockJsonResponse({}));

      const client = new GitHubClient('tok');
      await client.deletePost('target');

      const deleteUrl = fetchMock.mock.calls[1][0] as string;
      expect(deleteUrl).toContain('2024-01-15-target.md');
      expect(deleteUrl).not.toContain('README.md');
    });
  });

  describe('publishDraft', () => {
    const baseDraft = `---
layout: post
title: "Test"
date: 2024-05-10
draft: true
---

Body text.
`;

    it('publishes to a YYYY-MM-DD-<slug>.md filename even when the draft was undated', async () => {
      // 1) list drafts
      fetchMock.mockResolvedValueOnce(mockJsonResponse([
        { name: 'foo.md', path: 'drafts/foo.md', sha: 'sha-draft' },
      ]));
      // 2) read draft content via getFile()
      fetchMock.mockResolvedValueOnce(mockJsonResponse({
        path: 'drafts/foo.md',
        sha: 'sha-draft',
        content: btoa(baseDraft),
      }));
      // 3) PUT (saveFile) — first checks for existing post (404)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(null, false, 404));
      // 4) PUT actually saves
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));
      // 5) DELETE the draft
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const client = new GitHubClient('tok');
      const ok = await client.publishDraft('foo');
      expect(ok).toBe(true);

      // The PUT should have used the date from frontmatter (2024-05-10)
      const saveCall = fetchMock.mock.calls.find(
        c => (c[1] as RequestInit | undefined)?.method === 'PUT'
      );
      expect(saveCall).toBeDefined();
      const saveUrl = saveCall![0] as string;
      expect(saveUrl).toMatch(/contents\/2024-05-10-foo\.md/);
    });

    it('throws when the DELETE on the draft fails', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse([
        { name: '2024-01-15-foo.md', path: 'drafts/2024-01-15-foo.md', sha: 'sha-draft' },
      ]));
      fetchMock.mockResolvedValueOnce(mockJsonResponse({
        path: 'drafts/2024-01-15-foo.md',
        sha: 'sha-draft',
        content: btoa(baseDraft),
      }));
      fetchMock.mockResolvedValueOnce(mockJsonResponse(null, false, 404)); // saveFile pre-check
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));                 // saveFile PUT
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'forbidden' }, false, 403)); // DELETE fails

      const client = new GitHubClient('tok');
      await expect(client.publishDraft('foo')).rejects.toThrow(/failed to delete draft/i);
    });

    it('strips draft: true from frontmatter (handles quoted and capitalized variants)', async () => {
      const variants = [
        'draft: true',
        'draft: True',
        'draft: "true"',
        "draft: 'true'",
      ];

      for (const variant of variants) {
        const fm = baseDraft.replace('draft: true', variant);

        const localFetch = vi.fn();
        localFetch
          .mockResolvedValueOnce(mockJsonResponse([
            { name: '2024-05-10-x.md', path: 'drafts/2024-05-10-x.md', sha: 's' },
          ]))
          .mockResolvedValueOnce(mockJsonResponse({
            path: 'drafts/2024-05-10-x.md',
            sha: 's',
            content: btoa(fm),
          }))
          .mockResolvedValueOnce(mockJsonResponse(null, false, 404))
          .mockResolvedValueOnce(mockJsonResponse({}))
          .mockResolvedValueOnce(mockJsonResponse({}));
        vi.stubGlobal('fetch', localFetch);

        const client = new GitHubClient('tok');
        await client.publishDraft('x');

        // The PUT body should NOT contain the draft directive
        const putCall = localFetch.mock.calls.find(
          c => (c[1] as RequestInit | undefined)?.method === 'PUT'
        );
        const body = JSON.parse((putCall![1] as RequestInit).body as string);
        const decoded = atob(body.content);
        expect(decoded, `variant: ${variant}`).not.toMatch(/^draft:/m);
      }
    });
  });
});
