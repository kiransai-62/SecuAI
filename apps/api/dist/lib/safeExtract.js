"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_UNCOMPRESSED_BYTES = exports.MAX_FILES = void 0;
exports.safeExtractZip = safeExtractZip;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yauzl_1 = __importDefault(require("yauzl"));
const promises_1 = require("stream/promises");
exports.MAX_FILES = 5000;
exports.MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB limit
/**
 * Safely extracts a ZIP archive into a destination directory.
 * Defenses applied:
 * 1. Zip Slip: Rejects entries containing '..' or absolute paths or resolving outside destDir.
 * 2. Prohibited Symlinks: Rejects Unix symbolic links (S_IFLNK 0o120000).
 * 3. File Limit: Rejects archives exceeding 5,000 files.
 * 4. Zip Bomb: Rejects archives exceeding 150MB uncompressed data.
 * 5. Isolation: Extracts strictly inside the target temp directory.
 * 6. Clean Failure: Completely cleans up and deletes destination directory on failure.
 */
async function safeExtractZip(source, destDir) {
    const resolvedDest = path_1.default.resolve(destDir);
    // Ensure destination directory exists
    fs_1.default.mkdirSync(resolvedDest, { recursive: true });
    const cleanupOnFailure = () => {
        try {
            if (fs_1.default.existsSync(resolvedDest)) {
                fs_1.default.rmSync(resolvedDest, { recursive: true, force: true });
            }
        }
        catch (cleanupErr) {
            console.warn(`[safeExtract] Warning: cleanup failed:`, cleanupErr);
        }
    };
    return new Promise((resolve, reject) => {
        let fileCount = 0;
        let totalUncompressedBytes = 0;
        let isAborted = false;
        const handleFailure = (err) => {
            if (isAborted)
                return;
            isAborted = true;
            cleanupOnFailure();
            reject(err);
        };
        const processZip = (zipfile) => {
            zipfile.on('error', (err) => {
                if (err.message.includes('relative path') || err.message.includes('..')) {
                    handleFailure(new Error(`Zip Slip rejected: Path traversal entry found in archive: ${err.message}`));
                    return;
                }
                handleFailure(new Error(`Corrupted or invalid ZIP archive: ${err.message}`));
            });
            zipfile.on('end', () => {
                if (!isAborted) {
                    resolve({
                        fileCount,
                        totalUncompressedBytes,
                        extractedPath: resolvedDest,
                    });
                }
            });
            zipfile.readEntry();
            zipfile.on('entry', async (entry) => {
                if (isAborted)
                    return;
                try {
                    // ------------------------------------------------------------------
                    // 1. Zip Slip Protection: Check for relative traversal and absolute paths
                    // ------------------------------------------------------------------
                    const fileName = entry.fileName;
                    // Reject explicit '..' segments
                    if (fileName.includes('..') ||
                        path_1.default.normalize(fileName).split(/[/\\]/).includes('..')) {
                        zipfile.close();
                        return handleFailure(new Error(`Zip Slip rejected: Path traversal entry found in archive: "${fileName}"`));
                    }
                    // Reject absolute paths
                    if (path_1.default.isAbsolute(fileName) ||
                        fileName.startsWith('/') ||
                        fileName.startsWith('\\') ||
                        /^[a-zA-Z]:/.test(fileName)) {
                        zipfile.close();
                        return handleFailure(new Error(`Zip Slip rejected: Absolute path entry found in archive: "${fileName}"`));
                    }
                    // Ensure target path stays strictly inside resolved destination
                    const targetPath = path_1.default.resolve(resolvedDest, fileName);
                    if (!targetPath.startsWith(resolvedDest + path_1.default.sep) && targetPath !== resolvedDest) {
                        zipfile.close();
                        return handleFailure(new Error(`Zip Slip rejected: Entry "${fileName}" escapes target directory`));
                    }
                    // ------------------------------------------------------------------
                    // 2. Symlink Protection: Reject Unix symbolic links
                    // ------------------------------------------------------------------
                    const mode = (entry.externalFileAttributes >>> 16) & 0o177777;
                    const isSymlink = (mode & 0o170000) === 0o120000;
                    if (isSymlink) {
                        zipfile.close();
                        return handleFailure(new Error(`Symlink rejected: Archive contains prohibited symbolic link: "${fileName}"`));
                    }
                    // ------------------------------------------------------------------
                    // 3. File Count Limit: Max 5,000 files
                    // ------------------------------------------------------------------
                    const isDirectory = /\/$/.test(fileName);
                    if (!isDirectory) {
                        fileCount++;
                        if (fileCount > exports.MAX_FILES) {
                            zipfile.close();
                            return handleFailure(new Error(`File limit exceeded: Archive contains more than ${exports.MAX_FILES.toLocaleString()} files`));
                        }
                    }
                    // ------------------------------------------------------------------
                    // 4. Zip Bomb Protection: Max 150MB uncompressed size
                    // ------------------------------------------------------------------
                    totalUncompressedBytes += entry.uncompressedSize;
                    if (totalUncompressedBytes > exports.MAX_UNCOMPRESSED_BYTES) {
                        zipfile.close();
                        return handleFailure(new Error(`Zip bomb rejected: Uncompressed archive size exceeds limit of 150MB (${(totalUncompressedBytes / (1024 * 1024)).toFixed(1)}MB)`));
                    }
                    // ------------------------------------------------------------------
                    // 5. Extraction into scan temp directory
                    // ------------------------------------------------------------------
                    if (isDirectory) {
                        fs_1.default.mkdirSync(targetPath, { recursive: true });
                        zipfile.readEntry();
                    }
                    else {
                        fs_1.default.mkdirSync(path_1.default.dirname(targetPath), { recursive: true });
                        zipfile.openReadStream(entry, async (err, readStream) => {
                            if (err || !readStream) {
                                zipfile.close();
                                return handleFailure(new Error(`Failed to read ZIP entry "${fileName}": ${err?.message || 'unknown error'}`));
                            }
                            let entryBytesWritten = 0;
                            const writeStream = fs_1.default.createWriteStream(targetPath);
                            readStream.on('data', (chunk) => {
                                entryBytesWritten += chunk.length;
                                if (entryBytesWritten > exports.MAX_UNCOMPRESSED_BYTES) {
                                    readStream.destroy();
                                    writeStream.destroy();
                                    zipfile.close();
                                    handleFailure(new Error(`Zip bomb rejected: Streamed file "${fileName}" exceeds 150MB limit`));
                                }
                            });
                            try {
                                await (0, promises_1.pipeline)(readStream, writeStream);
                                if (!isAborted) {
                                    zipfile.readEntry();
                                }
                            }
                            catch (pipelineErr) {
                                if (!isAborted) {
                                    zipfile.close();
                                    handleFailure(pipelineErr);
                                }
                            }
                        });
                    }
                }
                catch (err) {
                    zipfile.close();
                    handleFailure(err);
                }
            });
        };
        if (Buffer.isBuffer(source)) {
            yauzl_1.default.fromBuffer(source, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return handleFailure(new Error(`Failed to open ZIP buffer: ${err?.message || 'invalid archive'}`));
                }
                processZip(zipfile);
            });
        }
        else {
            if (!fs_1.default.existsSync(source)) {
                return handleFailure(new Error(`ZIP source file not found: ${source}`));
            }
            yauzl_1.default.open(source, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return handleFailure(new Error(`Failed to open ZIP file: ${err?.message || 'invalid archive'}`));
                }
                processZip(zipfile);
            });
        }
    });
}
