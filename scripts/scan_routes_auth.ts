import express from 'express';
import app from '../src/server/app';

function getAppRoutes(app: any) {
  const routes: { method: string; path: string; middleware: string[] }[] = [];

  function print(path: string, layer: any) {
    if (layer.route) {
      const route = layer.route;
      const methods = Object.keys(route.methods).map(m => m.toUpperCase());
      methods.forEach(method => {
        routes.push({
          method,
          path: path + route.path,
          middleware: route.stack.map((s: any) => s.name || 'anonymous')
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routePath = path;
      if (layer.regexp) {
        const match = layer.regexp.toString().match(/^\/\^\\?(.*?)\\\/\?\(\?=\/\|\$\)\/i?/);
        if (match && match[1]) {
          routePath += match[1].replace(/\\\//g, '/');
        }
      }
      layer.handle.stack.forEach((stackItem: any) => {
        print(routePath, stackItem);
      });
    }
  }

  if (app._router && app._router.stack) {
    app._router.stack.forEach((layer: any) => {
      print('', layer);
    });
  }

  return routes;
}

const allRoutes = getAppRoutes(app);
console.log(`TOTAL REGISTERED ROUTES: ${allRoutes.length}\n`);

allRoutes.forEach((r, idx) => {
  const hasAuth = r.middleware.some(m => m.includes('requireAuth') || m.includes('requireRole') || m.includes('authenticate'));
  console.log(`${idx + 1}. [${r.method}] ${r.path} | Middleware: ${r.middleware.join(', ')} | Auth: ${hasAuth ? 'PROTECTED' : 'UNPROTECTED'}`);
});
