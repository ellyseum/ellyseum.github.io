#!/usr/bin/env node
/**
 * Generate about/index.md from site.yml
 * Creates the About page with content from config
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parse } from 'yaml';

const SITE_YML = '_data/site.yml';
const OUTPUT = 'about/index.md';

try {
  const yaml = readFileSync(SITE_YML, 'utf-8');
  const config = parse(yaml);

  const { about, skills, contact, site } = config;

  if (!about) {
    console.warn('No about section in site.yml — skipping about page generation');
    process.exit(0);
  }

  // Convert markdown bold/italic to HTML for Jekyll
  const processMarkdown = (text) => {
    return text
      .replace(/\*\*_([^_]+)_\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  };

  // Build skills HTML
  const skillsHtml = skills
    ? skills.map(s => `        <span class="skill-tag">${s}</span>`).join('\n')
    : '';

  // Build contact links HTML
  let contactHtml = '';
  if (contact) {
    const links = [];
    if (contact.github) {
      links.push(`        <a href="${contact.github}" class="about-link" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>`);
    }
    if (contact.linkedin) {
      links.push(`        <a href="${contact.linkedin}" class="about-link" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>`);
    }
    if (contact.portfolio) {
      links.push(`        <a href="${contact.portfolio}" class="about-link" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l-6 7 6 7M16 5l6 7-6 7M14 3l-4 18"/></svg>
          Portfolio
        </a>`);
    }
    contactHtml = links.join('\n');
  }

  // Convert multiline YAML to paragraphs
  const toParagraphs = (text) => {
    return text
      .split(/\n\n+/)
      .map(p => `      <p>\n        ${processMarkdown(p.trim())}\n      </p>`)
      .join('\n\n');
  };

  const output = `---
layout: default
title: About
permalink: /about/
---
<div class="page">
  <div class="page-container">
    <h1 class="page-title">About Me</h1>

    <div class="page-content">
${toParagraphs(about.intro)}

      <h2>What I Work On</h2>

${toParagraphs(about.work)}

      <h2>This Site</h2>

${toParagraphs(about.site_description)}

      <h2>Technical Background</h2>

      <div class="skills-grid">
${skillsHtml}
      </div>

      <h2 class="connect-heading">Connect</h2>

      <div class="about-links">
${contactHtml}
      </div>
    </div>
  </div>
</div>
`;

  mkdirSync('about', { recursive: true });
  writeFileSync(OUTPUT, output);
  console.log(`Generated ${OUTPUT}`);
} catch (err) {
  console.error('Error generating about page:', err.message);
  process.exit(1);
}
