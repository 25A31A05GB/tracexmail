import { z } from 'zod';
import { logger } from './logger';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().optional().default('3000'),
  ALLOWED_ORIGINS: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  RETENTION_PURGE_INTERVAL_MS: z.string().optional(),
  ENABLE_DEMO_SEED: z.string().optional(),
  ALLOW_DEV_HEADER_AUTH: z.string().optional(),
  ALLOW_MOCK_OAUTH: z.string().optional(),
  PUBSUB_AUDIENCE: z.string().optional(),
  ENABLE_TEST_ENDPOINTS: z.string().optional(),
  ALLOW_PUBLIC_ANALYZE: z.string().optional()
});

export function validateStartupEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ errors: parsed.error.format() }, '[Startup Config] Invalid environment configuration');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[Startup Error] Invalid environment configuration: ${JSON.stringify(parsed.error.format())}`);
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const missing: string[] = [];
    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.trim().length === 0) {
      missing.push('ALLOWED_ORIGINS (must be non-empty list of comma-separated HTTPS origins)');
    }
    const hasDatabase = Boolean(
      process.env.DATABASE_URL ||
      ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
    if (!hasDatabase) {
      missing.push('DATABASE_URL or (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      missing.push('JWT_SECRET (must be at least 32 characters long in production)');
    }
    const encKey = process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEYS;
    if (!encKey || encKey.trim().length === 0) {
      missing.push('TOKEN_ENCRYPTION_KEY or TOKEN_ENCRYPTION_KEYS (AES-256 key required in production)');
    }

    // Call crypto verification check
    try {
      const { verifyStartupKeys } = require('./crypto/encryption');
      const keyCheck = verifyStartupKeys();
      if (!keyCheck.valid) {
        missing.push(...keyCheck.errors);
      }
    } catch (e: any) {
      missing.push(`verifyStartupKeys check failed: ${e.message}`);
    }

    if (missing.length > 0) {
      const err = new Error(
        `[Production Startup Fatal Error] Missing or invalid production security variables:\n` +
        missing.map(m => ` - ${m}`).join('\n')
      );
      logger.error({ missing }, err.message);
      throw err;
    }
  }

  return parsed.data || (process.env as any);
}
