import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * Resilient lazy component importer with automatic retry and stale-chunk recovery.
 * Resolves errors like "Failed to fetch dynamically imported module: ... [chunk-name]-[hash].js".
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>,
  name: string = 'component'
): LazyExoticComponent<T> {
  return lazy(async () => {
    const key = `tracexmail_chunk_refreshed_${name}`;
    const alreadyRefreshed = Boolean(sessionStorage.getItem(key));

    try {
      const module = await componentImport();
      // Clean up flag on successful resolution
      try {
        sessionStorage.removeItem(key);
      } catch {}
      return module.default ? module : { default: module };
    } catch (error: any) {
      console.warn(`[lazyWithRetry] Error loading lazy module "${name}":`, error);

      const errorMessage = String(error?.message || '');
      const isChunkOrFetchError =
        error?.name === 'ChunkLoadError' ||
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Importing a module script failed') ||
        errorMessage.includes('error loading dynamically imported module') ||
        errorMessage.includes('dynamically imported module') ||
        errorMessage.includes('Failed to fetch');

      if (isChunkOrFetchError) {
        if (!alreadyRefreshed) {
          try {
            sessionStorage.setItem(key, 'true');
          } catch {}
          console.info(`[lazyWithRetry] Stale chunk detected for "${name}". Forcing cache-cleared reload...`);
          window.location.reload();
          // Return a hanging promise while the window reloads
          return new Promise(() => {});
        }
      }

      // Secondary retry after short delay
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const retryModule = await componentImport();
        try {
          sessionStorage.removeItem(key);
        } catch {}
        return retryModule.default ? retryModule : { default: retryModule };
      } catch (finalError) {
        console.error(`[lazyWithRetry] Failed to load "${name}" after retry:`, finalError);
        throw finalError;
      }
    }
  });
}
