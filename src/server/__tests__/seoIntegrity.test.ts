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

  describe('Crawlability & Logged-In App Noindex Directives (Item 1)', () => {
    it('verifies vercel.json contains X-Robots-Tag noindex headers and .html redirects', () => {
      const vercelJsonPath = path.join(rootDir, 'vercel.json');
      expect(fs.existsSync(vercelJsonPath)).toBe(true);
      const vercel = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));

      // Headers check
      const headers = vercel.headers || [];
      const apiHeader = headers.find((h: any) => h.source === '/api/:path*');
      const authHeader = headers.find((h: any) => h.source === '/auth/:path*');
      const oauthHeader = headers.find((h: any) => h.source === '/oauth/:path*');

      expect(apiHeader).toBeDefined();
      expect(apiHeader.headers.some((kv: any) => kv.key === 'X-Robots-Tag' && kv.value.includes('noindex'))).toBe(true);
      expect(authHeader).toBeDefined();
      expect(authHeader.headers.some((kv: any) => kv.key === 'X-Robots-Tag' && kv.value.includes('noindex'))).toBe(true);
      expect(oauthHeader).toBeDefined();
      expect(oauthHeader.headers.some((kv: any) => kv.key === 'X-Robots-Tag' && kv.value.includes('noindex'))).toBe(true);

      // Redirects check
      const redirects = vercel.redirects || [];
      expect(redirects.some((r: any) => r.source === '/about.html' && r.destination === '/about')).toBe(true);
      expect(redirects.some((r: any) => r.source === '/privacy.html' && r.destination === '/privacy')).toBe(true);
      expect(redirects.some((r: any) => r.source === '/knowledge/:slug.html' && r.destination === '/knowledge/:slug')).toBe(true);
    });

    it('verifies public/robots.txt allows all public routes and disallows /api/, /oauth/, /auth/', () => {
      const robotsPath = path.join(rootDir, 'public', 'robots.txt');
      expect(fs.existsSync(robotsPath)).toBe(true);
      const robots = fs.readFileSync(robotsPath, 'utf-8');

      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Disallow: /oauth/');
      expect(robots).toContain('Disallow: /auth/');
      expect(robots).toContain('Allow: /about');
      expect(robots).toContain('Allow: /knowledge');
      expect(robots).toContain('Allow: /privacy');
      expect(robots).toContain('Allow: /terms');
      expect(robots).toContain('Allow: /cookies');
      expect(robots).toContain('Allow: /domains');
      expect(robots).toContain('Allow: /contact');
      expect(robots).toContain('Allow: /security');
    });

    it('verifies public/auth/callback/index.html includes meta robots noindex', () => {
      const authCallbackPath = path.join(rootDir, 'public', 'auth', 'callback', 'index.html');
      expect(fs.existsSync(authCallbackPath)).toBe(true);
      const html = fs.readFileSync(authCallbackPath, 'utf-8');
      expect(html).toMatch(/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']/i);
    });

    it('verifies every public HTML page has a unique title, description, canonical link, and exactly 1 H1', () => {
      const publicHtmlFiles = [
        path.join(rootDir, 'index.html'),
        path.join(rootDir, 'public', 'about', 'index.html'),
        path.join(rootDir, 'public', 'contact', 'index.html'),
        path.join(rootDir, 'public', 'cookies', 'index.html'),
        path.join(rootDir, 'public', 'domains', 'index.html'),
        path.join(rootDir, 'public', 'privacy', 'index.html'),
        path.join(rootDir, 'public', 'security', 'index.html'),
        path.join(rootDir, 'public', 'terms', 'index.html'),
        path.join(rootDir, 'public', 'knowledge', 'index.html'),
        ...articleFiles.map((f) => path.join(publicKnowledgeDir, f))
      ];

      const titles = new Set<string>();
      const descs = new Set<string>();
      const canonicals = new Set<string>();

      for (const file of publicHtmlFiles) {
        expect(fs.existsSync(file)).toBe(true);
        const content = fs.readFileSync(file, 'utf-8');

        // Title
        const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
        expect(titleMatch, `Missing title in ${file}`).toBeTruthy();
        const title = titleMatch![1].trim();
        expect(titles.has(title), `Duplicate title "${title}" in ${file}`).toBe(false);
        titles.add(title);

        // Description
        const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        expect(descMatch, `Missing description in ${file}`).toBeTruthy();
        const desc = descMatch![1].trim();
        expect(descs.has(desc), `Duplicate description in ${file}`).toBe(false);
        descs.add(desc);

        // Canonical
        const canonMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
        expect(canonMatch, `Missing canonical in ${file}`).toBeTruthy();
        const canon = canonMatch![1].trim();
        expect(canon.endsWith('.html'), `Canonical has .html in ${file}`).toBe(false);
        expect(canonicals.has(canon), `Duplicate canonical "${canon}" in ${file}`).toBe(false);
        canonicals.add(canon);

        // Exactly 1 H1
        const h1Matches = [...content.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
        expect(h1Matches.length, `File ${file} must have exactly 1 <h1>, found ${h1Matches.length}`).toBe(1);
      }
    });

    it('verifies sitemap.xml contains strictly indexable canonical URLs', () => {
      const xml = fs.readFileSync(sitemapPath, 'utf-8');
      const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

      for (const loc of locMatches) {
        expect(loc.endsWith('.html')).toBe(false);
        expect(loc).not.toContain('/auth/');
        expect(loc).not.toContain('/api/');
        expect(loc.endsWith('.txt')).toBe(false);
      }

      // Check all 9 static public pages + 6 knowledge articles = 15 indexable URLs
      expect(locMatches.length).toBe(15);
    });
  });
});
