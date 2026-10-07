# SecuAI Production Deployment Guide

This guide details the step-by-step procedure for deploying the **SecuAI** application to production across **Supabase**, **Render / Railway** (API + Background Worker container), and **Vercel** (Frontend Web).

---

## 1. Architectural Overview

```
                   ┌───────────────────────────────────────────┐
                   │               Vercel (Web)                │
                   │        React + Vite + Tailwind SPA        │
                   │  Env: VITE_API_URL, VITE_SUPABASE_*       │
                   └─────────────────────┬─────────────────────┘
                                         │
                                         │ HTTPS / Bearer JWT (Strict CORS: WEB_ORIGIN)
                                         ▼
                   ┌───────────────────────────────────────────┐
                   │          Render / Railway (Docker)        │
                   │                                           │
                   │   node:20-slim + Python 3 + isitsecure    │
                   │   Non-root user (`node`)                  │
                   │                                           │
                   │   ┌──────────────────┐ ┌───────────────┐  │
                   │   │   Express API    │ │ Postgres      │  │
                   │   │   (Server-Side   │ │ Polling       │  │
                   │   │   Gemini Calls)  │ │ Worker        │  │
                   │   └────────┬─────────┘ └───────┬───────┘  │
                   │            │                   │          │
                   │       scripts/supervise.js     │          │
                   └────────────┼───────────────────┼──────────┘
                                │                   │
                  RLS User JWT  │                   │ Service Role Key
                                ▼                   ▼
                   ┌───────────────────────────────────────────┐
                   │             Supabase Project              │
                   │   PostgreSQL + Row Level Security (RLS)   │
                   │   Storage Bucket (`uploads`)              │
                   │   Zero Redis / BullMQ Needed              │
                   └───────────────────────────────────────────┘
```

- **Multi-Runtime Container**: Base image `node:20-slim` with Python 3, virtual environment in `/opt/venv`, and pinned `isitsecure` engine.
- **Supervisor**: Dual processes (Express API and background polling Worker) managed concurrently by `scripts/supervise.js`.
- **Security Boundaries**:
  - `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to the background worker for queue management.
  - API request handlers execute exclusively under the requesting user's Supabase JWT via Row Level Security (RLS).
  - Gemini API key is server-side only; never leaked to client bundles.
  - Strict CORS policy restricts requests to the exact `WEB_ORIGIN` domain.

---

## 2. Step 1: Database Setup & Migrations (Supabase)

1. **Create Supabase Project**:
   - Navigate to [Supabase](https://supabase.com) and create a new project.
   - Note your **Project URL**, public **anon** key, and private **service_role** key under **Project Settings -> API**.

2. **Execute Database Migrations**:
   - Open the **SQL Editor** in the Supabase Dashboard.
   - Paste and execute the contents of [`supabase/migrations/001_secuai_schema.sql`](file:///c:/PROJECTS/SecuAI/supabase/migrations/001_secuai_schema.sql).
   - This creates:
     - Custom Enums: `scan_status`, `finding_severity`, `finding_status`.
     - Core Tables: `projects`, `scans`, `findings`, `ai_analysis`, `verification_runs`.
     - Storage Bucket: `uploads` with path-prefix ownership policies.
     - Row Level Security (RLS) policies enforcing multi-tenant isolation.
     - Automated `updated_at` triggers and indexes.

3. **Verify RLS Status**:
   - In Supabase Dashboard, navigate to **Table Editor** and confirm that **RLS is Enabled** on all tables.

---

## 3. Step 2: Deploy API + Worker Container (Render or Railway)

### Option A: Render Deployment (Recommended)

1. **Connect Repository**:
   - Navigate to [Render Dashboard](https://dashboard.render.com/) and click **New -> Blueprint**.
   - Connect your SecuAI repository; Render detects [`render.yaml`](file:///c:/PROJECTS/SecuAI/render.yaml).
   - Alternatively, create a **Web Service** manually pointing to the root [`Dockerfile`](file:///c:/PROJECTS/SecuAI/Dockerfile).

2. **Configure Environment Variables**:
   In the Render service settings, configure:

   | Environment Variable | Example Value | Description |
   | :--- | :--- | :--- |
   | `PORT` | `4000` | Port Express listens on |
   | `NODE_ENV` | `production` | Production runtime flag |
   | `SUPABASE_URL` | `https://xyzcompany.supabase.co` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | `eyJhbGci...` | Public client anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | **Worker only** service key |
   | `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio Gemini API Key |
   | `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model for explanations and diffs |
   | `WEB_ORIGIN` | `https://secuai.vercel.app` | **Strict CORS**: Frontend Vercel URL |
   | `DAST_ALLOWED_HOSTS` | `demo.secuai.dev` | Host allowlist for DAST probes (demo targets only) |

3. **Configure Health Check**:
   - Health Check Path: `/api/health`
   - Render will verify that `GET /api/health` returns `200 OK` before routing traffic.

4. **Deploy**:
   - Trigger deployment. Render will build the multi-stage Docker container and launch `node scripts/supervise.js`.

---

### Option B: Railway Deployment

1. **New Project**:
   - In [Railway](https://railway.app), click **New Project -> Deploy from GitHub repo**.
   - Railway reads [`railway.json`](file:///c:/PROJECTS/SecuAI/railway.json) and uses the root `Dockerfile`.

2. **Set Environment Variables**:
   - In the **Variables** tab, enter all variables from `.env.example` as shown in the table above.

3. **Networking**:
   - In service settings, generate a public domain (e.g. `https://secuai-production.up.railway.app`).
   - The health check path is preset to `/api/health`.

---

## 4. Step 3: Deploy Frontend Web Application (Vercel)

1. **Import Project to Vercel**:
   - Navigate to [Vercel](https://vercel.com) and import your Git repository.
   - Set **Root Directory** to `apps/web`.
   - Framework Preset: **Vite**.
   - Build Command: `npm run build`.
   - Output Directory: `dist`.

2. **Configure Frontend Environment Variables**:
   Under **Project Settings -> Environment Variables**, configure:

   | Variable | Value | Notes |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://secuai-backend.onrender.com` | Backend URL from Step 2 |
   | `VITE_SUPABASE_URL` | `https://xyzcompany.supabase.co` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Public anon key (never service key) |

3. **SPA Routing**:
   - SPA deep routing (e.g. `/projects/:id`, `/scans/:id`, `/findings/:id`) is automatically routed via [`apps/web/vercel.json`](file:///c:/PROJECTS/SecuAI/apps/web/vercel.json).

4. **Deploy**:
   - Click **Deploy**. Note your live frontend URL (e.g. `https://secuai.vercel.app`).
   - **Important**: Return to Render/Railway and ensure `WEB_ORIGIN` exactly matches this URL.

---

## 5. Environment Variables Reference

| Variable | Scope | Required | Security Sensitivity |
| :--- | :--- | :--- | :--- |
| `PORT` | API | Yes | Low |
| `NODE_ENV` | Global | Yes | Low |
| `SUPABASE_URL` | Global | Yes | Low |
| `SUPABASE_ANON_KEY` | API & Web | Yes | Public (Safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker | Yes | **HIGH**: Never expose to client |
| `GEMINI_API_KEY` | API | Yes | **HIGH**: Server-side only |
| `GEMINI_MODEL` | API | No | Low (defaults to `gemini-2.5-flash`) |
| `WEB_ORIGIN` | API | Yes | Medium (Strict CORS policy) |
| `DAST_ALLOWED_HOSTS` | API/Worker | Yes | Medium (Probing restriction) |
| `VITE_API_URL` | Web | Yes | Public |
| `VITE_SUPABASE_URL` | Web | Yes | Public |
| `VITE_SUPABASE_ANON_KEY` | Web | Yes | Public |

---

## 6. Smoke-Test Checklist

Perform these tests on the live production deployment from a **fresh incognito browser session**:

- [ ] **1. API Health Check**:
  ```bash
  curl -i https://<your-backend-domain>/api/health
  ```
  - Verifies HTTP `200 OK` with JSON response: `{"status":"ok","service":"SecuAI API & Worker",...}`.

- [ ] **2. Strict CORS Verification**:
  ```bash
  curl -i -H "Origin: https://unauthorized-evil-domain.com" https://<your-backend-domain>/api/health
  ```
  - Verifies that unauthorized origins are rejected by CORS headers.

- [ ] **3. Fresh Incognito App Launch**:
  - Open a fresh Incognito window in your browser.
  - Navigate to `https://<your-vercel-domain>`.
  - Verify page loads with 0 console errors and rich modern styling.

- [ ] **4. User Authentication & Dashboard**:
  - Sign in or launch demo mode.
  - Confirm `/dashboard` displays:
    - Overall Security Score ring with 150ms animation.
    - Severity counts breakdown (Critical, High, Medium, Low).
    - Recent Scans list.

- [ ] **5. Project & Scan History Flow**:
  - Navigate to `/projects/:id`.
  - Verify scan history table with dates, scores, and status badges.
  - Click "Scan again" or trigger a new scan.
  - Confirm progress stepper transitions: `Cloning` $\rightarrow$ `Static Analysis` $\rightarrow$ `Extracting AST` $\rightarrow$ `Complete`.

- [ ] **6. Finding Detail & AI Explanation**:
  - Click an access control or RLS finding (`/findings/:id`).
  - Verify sections load:
    1. *What's the problem*
    2. *Why it happened*
    3. *Potential impact*
    4. *Evidence* (file, line number, scanner, confidence)
    5. *Recommended fix*
  - Reload finding page; verify cached response loads instantly.

- [ ] **7. Fix Generation & Workspace Patching**:
  - Click **"Generate fix"**.
  - Verify Monospace diff viewer renders unified diff with tinted added/removed lines.
  - Click **"Apply fix"** and confirm dialog:
    - Confirms `git apply` applies cleanly to the isolated scan workspace.
    - Finding status updates to `FIX_APPLIED`.

- [ ] **8. Deterministic Scanner Verification**:
  - Click **"Verify fix"**.
  - Engine executes verification:
    - Status updates to `VERIFIED`.
    - Green banner appears displaying scanner evidence text.
    - Security score animates upwards (e.g. $70 \rightarrow 100$).
    - "Run full re-scan" button is accessible.

- [ ] **9. Live Production Row Level Security (RLS) Test**:
  - Run the RLS test suite against the live production instance:
    ```bash
    TARGET=prod \
    SUPABASE_URL=https://<your-project>.supabase.co \
    SUPABASE_ANON_KEY=<your-anon-key> \
    SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
    npm run test:rls
    ```
  - Confirm 100% pass rate:
    - Unauthenticated anon requests return 0 rows.
    - Tenant A cannot read Tenant B projects/scans/findings.
    - Cross-tenant modifications and spoofed inserts are rejected by PostgreSQL RLS.
