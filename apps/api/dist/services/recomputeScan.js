"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeScan = recomputeScan;
const supabase_js_1 = require("../db/supabase.js");
const shared_1 = require("@secuai/shared");
/**
 * recomputeScan(scanId): Updates scans.security_score + counts based on findings.
 * Called by worker and after every finding status change or verification.
 */
async function recomputeScan(scanId, customDb) {
    const db = customDb || supabase_js_1.serviceRoleSupabase;
    let findingsList = [];
    if (db) {
        try {
            const { data, error } = await db
                .from('findings')
                .select('*')
                .eq('scan_id', scanId);
            if (!error && data) {
                findingsList = data;
            }
        }
        catch (err) {
            console.warn(`[recomputeScan] DB query notice for scan ${scanId}:`, err);
        }
    }
    // Fallback to memory store if no database results found or in memory mode
    if (findingsList.length === 0) {
        findingsList = Array.from(supabase_js_1.memoryDb.findings.values()).filter((f) => f.scan_id === scanId);
    }
    // Calculate deterministic score with category caps, excluded statuses, and clamping
    const result = (0, shared_1.calculateSecurityScore)(findingsList);
    const updates = {
        security_score: result.score,
        critical_count: result.counts.critical,
        high_count: result.counts.high,
        medium_count: result.counts.medium,
        low_count: result.counts.low,
        findings_count: result.counts.total,
    };
    if (db) {
        try {
            await db.from('scans').update(updates).eq('id', scanId);
        }
        catch (err) {
            console.warn(`[recomputeScan] DB update notice for scan ${scanId}:`, err);
        }
    }
    const memScan = supabase_js_1.memoryDb.scans.get(scanId);
    if (memScan) {
        Object.assign(memScan, updates);
    }
    return result;
}
