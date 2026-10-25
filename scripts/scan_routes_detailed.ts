import { createApp } from '../src/server/app';

async function scan() {
  const app = await createApp({ skipVite: true });

  const routes: { method: string; path: string; hasAuthMiddleware: boolean }[] = [];

  function processLayer(layer: any, currentPath = '') {
    if (layer.route) {
      const path = currentPath + layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .map(m => m.toUpperCase())
        .filter(m => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m));

      const hasAuthMiddleware = layer.route.stack.some((s: any) => {
        const name = s.name || '';
        return name.includes('requireAuth') || name.includes('requireRole');
      });

      methods.forEach(method => {
        routes.push({ method, path, hasAuthMiddleware });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      let extraPath = '';
      if (layer.regexp && layer.regexp.source) {
        const match = layer.regexp.source.match(/^\^\/*([^\\?\/]+)/);
        if (match && match[1]) {
          extraPath = '/' + match[1].replace(/\\\//g, '/');
        }
      }
      layer.handle.stack.forEach((subLayer: any) => {
        processLayer(subLayer, currentPath + extraPath);
      });
    }
  }

  (app as any)._router.stack.forEach((layer: any) => {
    processLayer(layer, '');
  });

  // Filter for /api routes
  const apiRoutes = routes.filter(r => r.path.startsWith('/api'));
  const unprotectedApiRoutes = apiRoutes.filter(r => !r.hasAuthMiddleware && !r.path.startsWith('/api/health'));

  console.log(`TOTAL API ROUTES: ${apiRoutes.length}`);
  console.log(`UNPROTECTED NON-HEALTH API ROUTES: ${unprotectedApiRoutes.length}\n`);

  unprotectedApiRoutes.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.method}] ${r.path}`);
  });
}

scan().catch(console.error);
