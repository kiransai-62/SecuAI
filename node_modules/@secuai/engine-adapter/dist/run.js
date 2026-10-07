"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIsItSecureBinary = resolveIsItSecureBinary;
exports.runScan = runScan;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Resolves the isitsecure executable path across Windows and Linux/macOS environments.
 */
function resolveIsItSecureBinary(customBin) {
    if (customBin && fs_1.default.existsSync(customBin)) {
        return customBin;
    }
    if (process.env.ISITSECURE_BIN && fs_1.default.existsSync(process.env.ISITSECURE_BIN)) {
        return process.env.ISITSECURE_BIN;
    }
    // Windows python scripts path check
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || '';
        const candidates = [
            path_1.default.join(localAppData, 'Python', 'pythoncore-3.11-64', 'Scripts', 'isitsecure.exe'),
            path_1.default.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Python', 'pythoncore-3.11-64', 'Scripts', 'isitsecure.exe'),
            path_1.default.join(process.env.APPDATA || '', 'Python', 'Python311', 'Scripts', 'isitsecure.exe'),
        ];
        for (const cand of candidates) {
            if (fs_1.default.existsSync(cand)) {
                return cand;
            }
        }
    }
    // Fallback to system PATH executable
    return 'isitsecure';
}
/**
 * Spawns the isitsecure CLI without shell, captures JSON report, and enforces timeout.
 *
 * @param workspacePath Path to the target workspace or repository
 * @param options Timeout and binary override options
 */
async function runScan(workspacePath, options = {}) {
    const timeoutMs = options.timeoutMs ?? 60000;
    const bin = resolveIsItSecureBinary(options.isitsecureBin);
    const args = [
        'scan',
        '--repo',
        path_1.default.resolve(workspacePath),
        '--mode',
        'code-only',
        '--llm',
        'none',
        '--output',
        'json',
    ];
    if (options.depth) {
        args.push('--depth', options.depth);
    }
    return new Promise((resolve, reject) => {
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let isTerminated = false;
        // Spawn isitsecure with shell: false and args array (no shell injection)
        const child = (0, child_process_1.spawn)(bin, args, {
            shell: false,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
            },
        });
        const timeoutHandle = setTimeout(() => {
            isTerminated = true;
            try {
                child.kill('SIGTERM');
                // Force kill if process does not exit in 2 seconds
                setTimeout(() => {
                    try {
                        child.kill('SIGKILL');
                    }
                    catch { }
                }, 2000);
            }
            catch { }
            reject(new Error(`Scan timed out after ${timeoutMs}ms on target: ${workspacePath}`));
        }, timeoutMs);
        child.stdout?.on('data', (chunk) => {
            stdoutBuffer += chunk.toString();
        });
        child.stderr?.on('data', (chunk) => {
            stderrBuffer += chunk.toString();
        });
        child.on('error', (err) => {
            if (isTerminated)
                return;
            clearTimeout(timeoutHandle);
            reject(new Error(`Failed to spawn isitsecure process (${bin}): ${err.message}`));
        });
        child.on('close', (code) => {
            if (isTerminated)
                return;
            clearTimeout(timeoutHandle);
            // Attempt to locate and parse the JSON block in stdout
            const firstBrace = stdoutBuffer.indexOf('{');
            const lastBrace = stdoutBuffer.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonSubstring = stdoutBuffer.substring(firstBrace, lastBrace + 1);
                try {
                    const report = JSON.parse(jsonSubstring);
                    resolve(report);
                    return;
                }
                catch (jsonErr) {
                    reject(new Error(`Failed to parse isitsecure JSON output: ${jsonErr.message}. Output was: ${jsonSubstring.slice(0, 300)}`));
                    return;
                }
            }
            if (code !== 0) {
                reject(new Error(`isitsecure exited with code ${code}. Stderr: ${stderrBuffer.slice(0, 500)}`));
                return;
            }
            reject(new Error(`No JSON output was produced by isitsecure. Output: ${stdoutBuffer.slice(0, 500)}`));
        });
    });
}
