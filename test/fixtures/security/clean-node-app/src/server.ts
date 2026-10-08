import express from 'express';
import cors from 'cors';
import { z } from 'zod';

const app = express();
app.use(express.json());

// 1. Strict CORS with explicit allowed origin
app.use(cors({ origin: ['https://secuai.dev'] }));

declare const db: any;
declare const authMiddleware: any;
declare const requireAdmin: any;

const IdParamSchema = z.string().uuid();

// 2. Parameterized SQL query with schema validation
app.get('/api/users/:id', async (req, res) => {
  const parseResult = IdParamSchema.safeParse(req.params.id);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const query = 'SELECT * FROM users WHERE id = $1';
  const user = await db.query(query, [parseResult.data]);
  res.json(user);
});

// 3. Authenticated and Authorized destructive route
app.delete('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const parseResult = IdParamSchema.safeParse(req.params.id);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  await db.query('DELETE FROM users WHERE id = $1', [parseResult.data]);
  res.status(204).end();
});

// 4. Redacted logging without credential leakage
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  console.log("User login attempt for account:", email, "[REDACTED]");
  res.json({ success: true });
});

export default app;
