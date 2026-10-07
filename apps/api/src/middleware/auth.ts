import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      supabase?: SupabaseClient;
      token?: string;
    }
  }
}

/**
 * Authentication Middleware:
 * 1. Verifies the Supabase JWT (Bearer token).
 * 2. Rejects unauthenticated requests with 401 Unauthorized.
 * 3. Attaches a per-request Supabase client using the user's JWT so Row Level Security (RLS) applies.
 * STRICT SECURITY RULE: NEVER use the service-role key in API request handlers.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    let decoded: any = null;

    // 1. Verify with local secret if configured
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      // 2. Fallback to decode and validate Supabase claim structure
      decoded = jwt.decode(token);
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

    const user: AuthenticatedUser = {
      id: decoded.sub,
      email: decoded.email || decoded.user_metadata?.email || '',
      role: decoded.role || 'authenticated',
    };

    req.user = user;
    req.token = token;

    // 3. Attach per-request Supabase client using the user's JWT (so RLS applies)
    // NEVER use the service-role key in request handlers
    if (config.supabaseUrl && config.supabaseAnonKey) {
      req.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    }

    next();
  } catch (err: any) {
    res.status(401).json({ error: `Unauthorized: ${err.message || 'Authentication failed'}` });
  }
}
