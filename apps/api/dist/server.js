"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const config_js_1 = require("./config.js");
const routes_js_1 = __importDefault(require("./routes.js"));
const worker_js_1 = require("./worker.js");
const app = (0, express_1.default)();
// Security Headers with Helmet
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // For API serving
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow non-browser requests (e.g. Docker/orchestrator health checks, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        const targetOrigins = (config_js_1.config.webOrigin || process.env.WEB_ORIGIN || '')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
        // Enforce configured WEB_ORIGIN
        if (targetOrigins.length > 0) {
            if (targetOrigins.includes('*') || targetOrigins.includes(origin)) {
                return callback(null, true);
            }
            // In non-production, allow local dev servers
            if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        }
        // Permissive fallback in local development when WEB_ORIGIN is not set
        if (process.env.NODE_ENV !== 'production' || origin === 'http://localhost:5173') {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health Check Endpoint (GET /api/health)
app.get(['/api/health', '/health'], (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'SecuAI API & Worker',
        scanner: 'isitsecure subprocess',
        gemini_model: config_js_1.config.geminiModel,
        architecture: 'Postgres Worker Polling (Zero Redis/BullMQ)',
        timestamp: new Date().toISOString(),
    });
});
// Audit Logger (ensures NO secrets appear in logs)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});
// Mount Routes
app.use('/api', routes_js_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[SecuAI API Error]', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
});
// Start Express Server & Worker
const isMain = Boolean(process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js') || process.argv[1]?.includes('server'));
if (isMain && process.env.NODE_ENV !== 'test' && !process.env.SUPPRESS_LISTEN) {
    app.listen(config_js_1.config.port, () => {
        console.log(`\n======================================================`);
        console.log(`🛡️  SecuAI API & Engine Bridge Online`);
        console.log(`⚡  Listening on http://localhost:${config_js_1.config.port}`);
        console.log(`🌐  Strict CORS Target: ${config_js_1.config.webOrigin || '[Localhost/Wildcard]'}`);
        console.log(`🤖  Gemini Server-Side: Active (${config_js_1.config.geminiModel})`);
        console.log(`🔍  Scanner Subprocess: isitsecure (Python)`);
        console.log(`🔐  Supabase Key: ${(0, config_js_1.maskSecret)(config_js_1.config.supabaseServiceKey || config_js_1.config.supabaseAnonKey)}`);
        console.log(`======================================================\n`);
        // Start Postgres polling worker loop unless separated
        if (process.env.START_WORKER !== 'false' && process.env.SEPARATE_WORKER !== 'true') {
            (0, worker_js_1.startWorkerLoop)(2000);
        }
    });
}
exports.default = app;
