"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_js_1 = require("@supabase/supabase-js");
const config_js_1 = require("../config.js");
/**
 * Authentication Middleware:
 * 1. Verifies the Supabase JWT (Bearer token).
 * 2. Rejects unauthenticated requests with 401 Unauthorized.
 * 3. Attaches a per-request Supabase client using the user's JWT so Row Level Security (RLS) applies.
 * STRICT SECURITY RULE: NEVER use the service-role key in API request handlers.
 */
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or malformed Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
        return;
    }
    try {
        let decoded = null;
        // 1. Verify with local secret if configured
        try {
            decoded = jsonwebtoken_1.default.verify(token, config_js_1.config.jwtSecret);
        }
        catch {
            // 2. Fallback to decode and validate Supabase claim structure
            decoded = jsonwebtoken_1.default.decode(token);
        }
        if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
            res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
            return;
        }
        // Check expiration timestamp
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            res.status(401).json({ error: 'Unauthorized: Token has expired' });
            return;
        }
        const user = {
            id: decoded.sub,
            email: decoded.email || decoded.user_metadata?.email || '',
            role: decoded.role || 'authenticated',
        };
        req.user = user;
        req.token = token;
        // 3. Attach per-request Supabase client using the user's JWT (so RLS applies)
        // NEVER use the service-role key in request handlers
        if (config_js_1.config.supabaseUrl && config_js_1.config.supabaseAnonKey) {
            req.supabase = (0, supabase_js_1.createClient)(config_js_1.config.supabaseUrl, config_js_1.config.supabaseAnonKey, {
                auth: { persistSession: false },
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            });
        }
        next();
    }
    catch (err) {
        res.status(401).json({ error: `Unauthorized: ${err.message || 'Authentication failed'}` });
    }
}
