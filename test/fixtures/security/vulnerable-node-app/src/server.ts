import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

// 1. Overly Permissive CORS (SEC-CFG-002)
app.use(cors({ origin: '*' }));

// 2. Leaked Supabase Service Role Key (SEC-SEC-001)
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3RkYiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2ODAwMDAwMDAsImV4cCI6MTk5OTAwMDAwMH0.abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

declare const db: any;

// 3. SQL Injection via template literal (SEC-INJ-001)
app.get('/api/users/:id', async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  const user = await db.query(query);
  res.json(user);
});

// 4. Command Injection via exec (SEC-INJ-002)
app.get('/api/ping', (req, res) => {
  const host = req.query.host;
  exec(`ping -c 1 ${host}`, (err, stdout) => {
    res.send(stdout);
  });
});

// 5. Missing Authentication & Authorization on Destructive Route (SEC-AUTH-001)
app.delete('/api/users/:id', async (req, res) => {
  await db.query(`DELETE FROM users WHERE id = ${req.params.id}`);
  res.status(204).end();
});

// 6. Sensitive Data Plaintext Logging (SEC-CFG-003)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  console.log("User login attempt with credentials:", email, password);
  res.json({ success: true });
});

export default app;
