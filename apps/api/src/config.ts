import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  // Service role key is STRICTLY for the background worker queue management
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  jwtSecret: process.env.JWT_SECRET || 'secuai-production-tenant-secret-2026',
  corsOrigin: process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || '*',
  webOrigin: process.env.WEB_ORIGIN || process.env.CORS_ORIGIN || '',
  dastAllowedHosts: (process.env.DAST_ALLOWED_HOSTS || 'demo.secuai.dev')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
};

/**
 * Masks sensitive tokens and keys to ensure no secrets appear in logs
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '[NONE]';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
