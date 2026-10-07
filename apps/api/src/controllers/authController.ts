import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { memoryDb, serviceRoleSupabase } from '../db/supabase.js';
import { config } from '../config.js';

export class AuthController {
  /**
   * POST /api/auth/register - Register a new user with bcrypt password hashing + JWT
   */
  static async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists in memoryDb
    for (const u of memoryDb.users.values()) {
      if (u.email === normalizedEmail) {
        res.status(409).json({ error: 'User already exists with this email' });
        return;
      }
    }

    // Hash password with bcrypt (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    let userId: string = crypto.randomUUID();

    // If Supabase service role is available, register in auth.users
    if (serviceRoleSupabase) {
      try {
        const { data: suUser, error: suErr } = await serviceRoleSupabase.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
        });
        if (suErr && !suErr.message.includes('already exists') && !suErr.message.includes('already been registered')) {
          // If already exists, return 409
          console.warn('[AuthController] Supabase admin user create notice:', suErr.message);
        } else if (suUser?.user?.id) {
          userId = suUser.user.id;
        }
      } catch (err: any) {
        console.warn('[AuthController] Supabase admin registration error:', err.message);
      }
    }

    const newUser = {
      id: userId,
      email: normalizedEmail,
      password_hash,
      created_at: new Date().toISOString(),
    };

    memoryDb.users.set(userId, newUser);

    // Sign JWT token
    const token = jwt.sign(
      {
        sub: userId,
        email: normalizedEmail,
        role: 'authenticated',
        aud: 'authenticated',
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email: normalizedEmail,
      },
      token,
    });
  }

  /**
   * POST /api/auth/login - Authenticate with custom bcrypt verification + JWT issuance
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Check local memoryDb user
    let user = Array.from(memoryDb.users.values()).find((u) => u.email === normalizedEmail);

    if (user) {
      const isMatch = await bcrypt.compare(String(password), user.password_hash);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
        },
        token,
      });
      return;
    }

    // 2. If user not in memoryDb, try Supabase auth if connected
    if (serviceRoleSupabase) {
      try {
        const { data, error } = await serviceRoleSupabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: String(password),
        });

        if (!error && data.session && data.user) {
          // Cache in memoryDb for future fast bcrypt verification
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(String(password), salt);
          memoryDb.users.set(data.user.id, {
            id: data.user.id,
            email: normalizedEmail,
            password_hash: hash,
            created_at: new Date().toISOString(),
          });

          res.json({
            message: 'Login successful',
            user: {
              id: data.user.id,
              email: data.user.email,
            },
            token: data.session.access_token,
          });
          return;
        }
      } catch {}
    }

    // 3. Fallback for hackathon demo credentials (e.g. developer@secuai.dev / SecuAI@2026)
    if (normalizedEmail === 'developer@secuai.dev' && String(password) === 'SecuAI@2026') {
      const demoUserId = '00000000-0000-0000-0000-000000000001';
      const token = jwt.sign(
        {
          sub: demoUserId,
          email: normalizedEmail,
          role: 'authenticated',
          aud: 'authenticated',
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful (Demo Mode)',
        user: {
          id: demoUserId,
          email: normalizedEmail,
        },
        token,
      });
      return;
    }

    res.status(401).json({ error: 'Invalid email or password' });
  }

  /**
   * GET /api/auth/me - Return currently authenticated user profile
   */
  static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ user: req.user });
  }
}
