import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Technical SEO & Forensic Integrity Audits', () => {
  const rootDir = process.cwd();
  const publicKnowledgeDir = path.join(rootDir, 'public', 'knowledge');
  const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');

  const articleFiles = fs
    .readdirSync(publicKnowledgeDir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html');

  it('has at least 6 forensic knowledge articles in public/knowledge', () => {
    expect(articleFiles.length).toBeGreaterThanOrEqual(6);
  });

  articleFiles.forEach((file) => {
    const slug = file.replace(/\.html$/, '');
    const filePath = path.join(publicKnowledgeDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    describe(`Article: ${file}`, () => {
      it('has an exact clean canonical link without .html', () => {
        const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
        expect(canonicalMatch).toBeTruthy();
        expect(canonicalMatch![1]).toBe(`https://tracexmail.vercel.app/knowledge/${slug}`);
        expect(canonicalMatch![1].endsWith('.html')).toBe(false);
      });

      it('has a valid meta description', () => {
        const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        expect(descMatch).toBeTruthy();
        const desc = descMatch![1];
        expect(desc.length).toBeGreaterThan(50);
        // New articles created in this sprint strictly follow 120-160 chars
        if (['reading-authentication-results-header', 'from-reply-to-return-path-mismatch', 'phishing-email-triage-checklist'].includes(slug)) {
          expect(desc.length).toBeGreaterThanOrEqual(120);
          expect(desc.length).toBeLessThanOrEqual(160);
        }
      });

      it('contains both TechArticle and BreadcrumbList structured data (JSON-LD)', () => {
        const jsonLdMatches = [...content.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
        expect(jsonLdMatches.length).toBeGreaterThanOrEqual(2);

        const parsedBlocks = jsonLdMatches.map((m) => {
          try {
            return JSON.parse(m[1].trim());
          } catch (e) {
            throw new Error(`Failed parsing JSON-LD in ${file}: ${e}`);
          }
        });

        const hasTechArticle = parsedBlocks.some((b) => b['@type'] === 'TechArticle');
        const hasBreadcrumb = parsedBlocks.some((b) => b['@type'] === 'BreadcrumbList');

        expect(hasTechArticle).toBe(true);
        expect(hasBreadcrumb).toBe(true);

        const breadcrumbBlock = parsedBlocks.find((b) => b['@type'] === 'BreadcrumbList');
        expect(breadcrumbBlock.itemListElement).toBeInstanceOf(Array);
        expect(breadcrumbBlock.itemListElement.length).toBe(3);
        expect(breadcrumbBlock.itemListElement[0].item).toBe('https://tracexmail.vercel.app/');
        expect(breadcrumbBlock.itemListElement[1].item).toBe('https://tracexmail.vercel.app/knowledge');
        expect(breadcrumbBlock.itemListElement[2].item).toBe(`https://tracexmail.vercel.app/knowledge/${slug}`);
      });

      it('contains at least 500 words of body content', () => {
        const stripped = content
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ');
        const words = stripped.trim().split(/\s+/).filter(Boolean);
        expect(words.length).toBeGreaterThanOrEqual(500);
      });

      it('links to all other 5 articles and the console in the related guides box', () => {
        const otherArticles = articleFiles.filter((f) => f !== file);
        for (const other of otherArticles) {
          const otherSlug = other.replace(/\.html$/, '');
          const expectedLink = `/knowledge/${otherSlug}`;
          expect(content).toContain(`href="${expectedLink}"`);
        }
        expect(content).toContain('href="/"');
      });
    });
  });

  describe('Sitemap Integrity', () => {
    it('exists and only contains clean URLs with exactly one lastmod per url', () => {
      expect(fs.existsSync(sitemapPath)).toBe(true);
      const xml = fs.readFileSync(sitemapPath, 'utf-8');

      // Verify no .html links in sitemap
      const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      for (const loc of locMatches) {
        expect(loc.endsWith('.html')).toBe(false);
      }

      // Verify every knowledge article is present in sitemap
      for (const file of articleFiles) {
        const slug = file.replace(/\.html$/, '');
        const expectedLoc = `https://tracexmail.vercel.app/knowledge/${slug}`;
        expect(locMatches).toContain(expectedLoc);
      }

      // Verify one lastmod YYYY-MM-DD per url
      const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
      expect(urlBlocks.length).toBe(locMatches.length);

      for (const match of urlBlocks) {
        const block = match[1];
        const lastmods = [...block.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
        expect(lastmods.length).toBe(1);
        expect(lastmods[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Internal Links and Clean URL Enforcement', () => {
    it('has no internal /knowledge/*.html links in public HTML and TSX files', () => {
      const filesToCheck = [
        path.join(rootDir, 'index.html'),
        path.join(rootDir, 'public', 'knowledge', 'index.html'),
        path.join(rootDir, 'public', 'about', 'index.html'),
        path.join(rootDir, 'src', 'components', 'KnowledgeBaseView.tsx'),
        path.join(rootDir, 'src', 'components', 'LegalPage.tsx'),
        ...articleFiles.map((f) => path.join(publicKnowledgeDir, f))
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const text = fs.readFileSync(filePath, 'utf-8');
        const matches = text.match(/\/knowledge\/[a-zA-Z0-9_-]+\.html/g);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Static Page Canonicals', () => {
    const staticPages = ['privacy', 'terms', 'cookies', 'contact', 'security', 'domains'];

    staticPages.forEach((page) => {
      it(`ensures /${page} has an exact canonical tag`, () => {
        const pageFile = path.join(rootDir, 'public', page, 'index.html');
        expect(fs.existsSync(pageFile)).toBe(true);
        const html = fs.readFileSync(pageFile, 'utf-8');
        expect(html).toContain(`<link rel="canonical" href="https://tracexmail.vercel.app/${page}" />`);
      });
    });
  });

  describe('Unsupported Claims Audit', () => {
    it('ensures no public files contain forbidden claims', () => {
      const publicFiles = [
        path.join(rootDir, 'index.html'),
        path.join(rootDir, 'public', 'llms.txt'),
        path.join(rootDir, 'public', 'llms-full.txt'),
        path.join(rootDir, 'public', 'about', 'index.html'),
        path.join(rootDir, 'public', 'knowledge', 'index.html'),
        ...articleFiles.map((f) => path.join(publicKnowledgeDir, f))
      ];

      const forbiddenRegex = /court-admissible|peer-reviewed|1-Click SOAR/i;

      for (const file of publicFiles) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const match = content.match(forbiddenRegex);
        if (match) {
          throw new Error(`Found forbidden claim "${match[0]}" in ${file}`);
        }
        expect(match).toBeNull();
      }
    });
  });
});
