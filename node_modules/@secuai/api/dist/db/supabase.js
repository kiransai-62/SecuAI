"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceRoleSupabase = exports.supabase = exports.memoryDb = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_js_1 = require("../config.js");
let supabase = null;
exports.supabase = supabase;
let serviceRoleSupabase = null;
exports.serviceRoleSupabase = serviceRoleSupabase;
if (config_js_1.config.supabaseUrl && (config_js_1.config.supabaseServiceKey || config_js_1.config.supabaseAnonKey)) {
    try {
        exports.supabase = supabase = (0, supabase_js_1.createClient)(config_js_1.config.supabaseUrl, config_js_1.config.supabaseServiceKey || config_js_1.config.supabaseAnonKey, {
            auth: { persistSession: false },
        });
        console.log(`[SecuAI Database] Supabase client initialized with URL: ${config_js_1.config.supabaseUrl}`);
    }
    catch (err) {
        console.warn(`[SecuAI Database] Supabase init failed (${err.message}). Using local store.`);
    }
}
else {
    console.log('[SecuAI Database] Running in self-contained local Postgres-compatible store mode.');
}
// Service-role client: STRICTLY for worker background processing ONLY
if (config_js_1.config.supabaseUrl && config_js_1.config.supabaseServiceKey) {
    try {
        exports.serviceRoleSupabase = serviceRoleSupabase = (0, supabase_js_1.createClient)(config_js_1.config.supabaseUrl, config_js_1.config.supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    catch (err) {
        console.warn(`[SecuAI Database] Service role client init failed: ${err.message}`);
    }
}
// In-Memory Database fallback (strictly partitioned by user_id for RLS enforcement)
exports.memoryDb = {
    projects: new Map(),
    scans: new Map(),
    findings: new Map(),
    ai_analysis: new Map(),
    verification_runs: new Map(),
};
// Seed default initial demonstration project
const defaultUserId = '00000000-0000-0000-0000-000000000001';
const defaultProjectId = '11111111-1111-1111-1111-111111111111';
exports.memoryDb.projects.set(defaultProjectId, {
    id: defaultProjectId,
    user_id: defaultUserId,
    name: 'FinTech & AI SaaS Demo App',
    description: 'FinTech & AI SaaS banking demonstration project',
    source_type: 'GITHUB',
    repository_url: 'https://github.com/enterprise/neobank-api',
    repo_url: 'https://github.com/enterprise/neobank-api',
    framework: 'Next.js 15 / Supabase',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});
