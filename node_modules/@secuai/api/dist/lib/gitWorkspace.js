"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWorkspaceGit = initWorkspaceGit;
exports.validateGitDiff = validateGitDiff;
exports.applyGitDiff = applyGitDiff;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
/**
 * Initializes a git repository inside the scan workspace.
 * If finding is provided, ensures the target file exists with baseline content
 * so that git tracking and git apply --check work predictably.
 */
function initWorkspaceGit(workspacePath, finding) {
    try {
        if (!fs_1.default.existsSync(workspacePath)) {
            fs_1.default.mkdirSync(workspacePath, { recursive: true });
        }
        // Ensure the target file exists in workspace if a finding is provided
        if (finding && finding.file_path) {
            const fullTargetFilePath = path_1.default.join(workspacePath, finding.file_path);
            const targetDir = path_1.default.dirname(fullTargetFilePath);
            if (!fs_1.default.existsSync(targetDir)) {
                fs_1.default.mkdirSync(targetDir, { recursive: true });
            }
            if (!fs_1.default.existsSync(fullTargetFilePath)) {
                // Create baseline file content from evidence snippet or appropriate baseline
                const snippet = finding.evidence?.code_snippet ||
                    finding.evidence?.evidence_text ||
                    finding.description ||
                    '// Vulnerable code placeholder\n';
                fs_1.default.writeFileSync(fullTargetFilePath, snippet, 'utf-8');
            }
        }
        const gitDir = path_1.default.join(workspacePath, '.git');
        if (!fs_1.default.existsSync(gitDir)) {
            (0, child_process_1.execSync)('git init', { cwd: workspacePath, stdio: 'ignore' });
            (0, child_process_1.execSync)('git config user.name "SecuAI Bot"', { cwd: workspacePath, stdio: 'ignore' });
            (0, child_process_1.execSync)('git config user.email "bot@secuai.local"', { cwd: workspacePath, stdio: 'ignore' });
            (0, child_process_1.execSync)('git config commit.gpgsign false', { cwd: workspacePath, stdio: 'ignore' });
        }
        // Stage and commit all current workspace files so working tree is clean
        try {
            (0, child_process_1.execSync)('git add -A', { cwd: workspacePath, stdio: 'ignore' });
            (0, child_process_1.execSync)('git commit -m "Initial scan workspace baseline" --allow-empty', {
                cwd: workspacePath,
                stdio: 'ignore',
            });
        }
        catch { }
        return true;
    }
    catch (err) {
        console.warn(`[gitWorkspace] initWorkspaceGit notice for ${workspacePath}:`, err.message);
        return false;
    }
}
/**
 * Validates a unified git diff against the workspace working tree using `git apply --check`.
 * Tests standard -p1 first, and falls back to -p0 if path prefixes differ.
 */
function validateGitDiff(workspacePath, diffText) {
    if (!diffText || typeof diffText !== 'string' || !diffText.trim()) {
        return { valid: false, error: 'Diff text is empty or invalid.' };
    }
    initWorkspaceGit(workspacePath);
    const cleanDiff = diffText.replace(/\r\n/g, '\n').trim() + '\n';
    // 1. Try standard git apply --check (strip 1: a/path -> path)
    try {
        const resP1 = (0, child_process_1.spawnSync)('git', ['apply', '--check', '--unidiff-zero', '-'], {
            cwd: workspacePath,
            input: cleanDiff,
            encoding: 'utf-8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            timeout: 5000,
        });
        if (resP1.status === 0) {
            return { valid: true, strip: 1 };
        }
        // Try without --unidiff-zero
        const resP1Std = (0, child_process_1.spawnSync)('git', ['apply', '--check', '-'], {
            cwd: workspacePath,
            input: cleanDiff,
            encoding: 'utf-8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            timeout: 5000,
        });
        if (resP1Std.status === 0) {
            return { valid: true, strip: 1 };
        }
        // 2. Try with -p0 (for diffs without a/ b/ prefix)
        const resP0 = (0, child_process_1.spawnSync)('git', ['apply', '-p0', '--check', '-'], {
            cwd: workspacePath,
            input: cleanDiff,
            encoding: 'utf-8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            timeout: 5000,
        });
        if (resP0.status === 0) {
            return { valid: true, strip: 0 };
        }
        const err = resP1Std.stderr?.trim() ||
            resP1.stderr?.trim() ||
            resP0.stderr?.trim() ||
            resP1Std.stdout?.trim() ||
            'git apply --check rejected patch hunk';
        return { valid: false, error: err };
    }
    catch (err) {
        return { valid: false, error: err.message || 'Execution error during git apply --check' };
    }
}
/**
 * Applies a verified unified git diff to the workspace directory using `git apply`.
 * NEVER touches user repository or production; strictly limited to workspacePath.
 */
function applyGitDiff(workspacePath, diffText) {
    // Re-run git apply --check first
    const validation = validateGitDiff(workspacePath, diffText);
    if (!validation.valid) {
        return {
            success: false,
            error: `Patch validation failed: ${validation.error || 'git apply --check failed'}`,
        };
    }
    const cleanDiff = diffText.replace(/\r\n/g, '\n').trim() + '\n';
    const args = validation.strip === 0 ? ['apply', '-p0', '-'] : ['apply', '-'];
    try {
        const res = (0, child_process_1.spawnSync)('git', args, {
            cwd: workspacePath,
            input: cleanDiff,
            encoding: 'utf-8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            timeout: 5000,
        });
        if (res.status === 0) {
            // Stage and commit the applied patch in workspace git
            try {
                (0, child_process_1.execSync)('git add -A', { cwd: workspacePath, stdio: 'ignore' });
                (0, child_process_1.execSync)('git commit -m "Applied remediation fix"', { cwd: workspacePath, stdio: 'ignore' });
            }
            catch { }
            return { success: true };
        }
        const err = res.stderr?.trim() || res.stdout?.trim() || 'git apply command failed';
        return { success: false, error: err };
    }
    catch (err) {
        return { success: false, error: err.message || 'Error executing git apply' };
    }
}
