"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_STORAGE_BASE = void 0;
exports.uploadScanZip = uploadScanZip;
exports.getScanZipBuffer = getScanZipBuffer;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_js_1 = require("../db/supabase.js");
// Ensure memoryDb.storage exists
if (!supabase_js_1.memoryDb.storage) {
    supabase_js_1.memoryDb.storage = new Map();
}
exports.LOCAL_STORAGE_BASE = path_1.default.resolve('temp', 'storage');
/**
 * Stores uploaded ZIP file to Supabase Storage bucket 'uploads'
 * at path: uploads/{user_id}/{scan_id}.zip
 * Also caches in local storage/memory for worker processing.
 */
async function uploadScanZip(userId, scanId, buffer, supabaseClient) {
    const relativePath = `${userId}/${scanId}.zip`;
    const fullStoragePath = `uploads/${relativePath}`;
    // 1. Upload to Supabase Storage if client is provided
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.storage
                .from('uploads')
                .upload(relativePath, buffer, {
                contentType: 'application/zip',
                upsert: true,
            });
            if (error) {
                console.warn(`[Storage] Supabase storage upload warning: ${error.message}. Saving to fallback store.`);
            }
        }
        catch (err) {
            console.warn(`[Storage] Supabase storage call failed: ${err.message}.`);
        }
    }
    // 2. Always persist in memoryDb and local disk for resilient worker access
    supabase_js_1.memoryDb.storage.set(fullStoragePath, buffer);
    supabase_js_1.memoryDb.storage.set(relativePath, buffer);
    try {
        const localUserDir = path_1.default.join(exports.LOCAL_STORAGE_BASE, 'uploads', userId);
        fs_1.default.mkdirSync(localUserDir, { recursive: true });
        const localFilePath = path_1.default.join(localUserDir, `${scanId}.zip`);
        fs_1.default.writeFileSync(localFilePath, buffer);
    }
    catch (err) {
        console.warn(`[Storage] Local disk write notice:`, err);
    }
    return fullStoragePath;
}
/**
 * Retrieves the uploaded ZIP buffer by storage path
 */
async function getScanZipBuffer(storagePath, supabaseClient) {
    // 1. Check memory store
    const fromMemory = supabase_js_1.memoryDb.storage.get(storagePath);
    if (fromMemory)
        return fromMemory;
    // 2. Check local disk
    const cleanPath = storagePath.replace(/^uploads\//, '');
    const localDiskPath = path_1.default.join(exports.LOCAL_STORAGE_BASE, 'uploads', cleanPath);
    if (fs_1.default.existsSync(localDiskPath)) {
        return fs_1.default.readFileSync(localDiskPath);
    }
    // 3. Download from Supabase Storage if client exists
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.storage
                .from('uploads')
                .download(cleanPath);
            if (!error && data) {
                const arrayBuf = await data.arrayBuffer();
                return Buffer.from(arrayBuf);
            }
        }
        catch (err) {
            console.warn(`[Storage] Supabase download error:`, err);
        }
    }
    return null;
}
