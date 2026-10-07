"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.maskSecret = maskSecret;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
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
    dastAllowedHosts: (process.env.DAST_ALLOWED_HOSTS || 'localhost,127.0.0.1')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
};
/**
 * Masks sensitive tokens and keys to ensure no secrets appear in logs
 */
function maskSecret(secret) {
    if (!secret)
        return '[NONE]';
    if (secret.length <= 8)
        return '****';
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
